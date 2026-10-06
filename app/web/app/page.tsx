"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, fmt, type City, type Forecast, type Meta } from "@/lib/api";
import { DriverChart, ForecastChart, Spark } from "@/components/charts";

const ZoneMap = dynamic(() => import("@/components/zone-map"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-slate-500">Loading map…</div>,
});

const SHIFTS = [
  { label: "Night", icon: "🌙", from: 0, to: 6 },
  { label: "Morning", icon: "🌅", from: 6, to: 12 },
  { label: "Afternoon", icon: "☀️", from: 12, to: 18 },
  { label: "Evening", icon: "🌆", from: 18, to: 24 },
];

type View = "overview" | "forecast" | "drivers" | "table";

export default function Page() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [date, setDate] = useState<string>("");
  const [zone, setZone] = useState<string>("");
  const [hour, setHour] = useState<number>(18);
  const [city, setCity] = useState<City | null>(null);
  const [fc, setFc] = useState<Forecast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [view, setView] = useState<View>("overview");

  useEffect(() => {
    api.meta().then((m) => {
      setMeta(m);
      const qs = new URLSearchParams(window.location.search);
      const qz = qs.get("zone");
      const qd = qs.get("date");
      const z = m.zones.find((x) => x.zone.toLowerCase() === (qz ?? "").toLowerCase())?.zone ?? "Kazanchis";
      let d = m.first_day;
      if (qd) {
        if (m.dates.includes(qd)) d = qd;
        else setNotice(`We only forecast 1–14 November 2025, so "${qd}" can't be shown. Showing 1 November.`);
      }
      setZone(z);
      setDate(d);
    }).catch((e) => setError(`Can't reach the forecast server: ${e.message}`));
  }, []);

  useEffect(() => {
    if (!date) return;
    api.city(date).then(setCity).catch((e) => setError(e.message));
  }, [date]);

  useEffect(() => {
    if (!date || !zone) return;
    setError(null);
    api.forecast(zone, date).then(setFc).catch((e) => setError(e.message));
    const url = new URL(window.location.href);
    url.searchParams.set("zone", zone);
    url.searchParams.set("date", date);
    window.history.replaceState(null, "", url.toString());
  }, [zone, date]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setHour((h) => (h + 1) % 24), 650);
    return () => clearInterval(t);
  }, [playing]);

  const zoneInfo = useMemo(() => meta?.zones.find((z) => z.zone === zone), [meta, zone]);
  const cityTotal = useMemo(() => (city?.zones ?? []).reduce((a, z) => a + z.total, 0), [city]);
  const cityHour = useMemo(() => (city?.zones ?? []).reduce((a, z) => a + (z.hourly[hour] ?? 0), 0), [city, hour]);
  const pick = useCallback((z: string) => setZone(z), []);

  if (error && !meta) {
    return (
      <main className="grid min-h-screen place-items-center p-8 bg-ink-950">
        <div className="glass max-w-md p-8 text-center">
          <div className="text-4xl mb-4">🛰️</div>
          <h1 className="text-xl font-bold text-white">Forecast server not reachable</h1>
          <p className="mt-3 text-sm text-slate-400">{error}</p>
          <p className="mt-4 text-xs text-slate-500">Start it with <code className="text-accent px-2 py-1 rounded-lg bg-accent/10">python app/app.py</code></p>
        </div>
      </main>
    );
  }

  const k = fc?.kpis;
  const h = fc?.hours[hour];

  const NAV_ITEMS: { id: View; icon: string; label: string }[] = [
    { id: "overview", icon: "📊", label: "Overview" },
    { id: "forecast", icon: "📈", label: "Forecast" },
    { id: "drivers", icon: "🚗", label: "Driver Plan" },
    { id: "table", icon: "📋", label: "Data Table" },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ════════ SIDEBAR ════════════════════════════════════════════ */}
      <aside className={`sidebar relative flex flex-col transition-all duration-300 ease-out ${sidebarOpen ? "w-[280px]" : "w-0 overflow-visible"} shrink-0`}>

        {/* ── Collapsed pull-tab: always visible on the edge when sidebar is closed ── */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center justify-center gap-1
                       w-7 h-20 rounded-r-2xl
                       bg-gradient-to-b from-accent/90 to-rose/80
                       border border-accent/40 border-l-0
                       shadow-lg shadow-accent/30
                       text-white hover:w-9 hover:shadow-xl hover:shadow-accent/40
                       transition-all duration-200 group"
          >
            <span className="text-[11px] font-bold" style={{ writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)", letterSpacing: "0.08em" }}>MENU</span>
            <span className="text-[10px] mt-0.5">▶</span>
          </button>
        )}

        {/* ── Sidebar body (only rendered when open) ── */}
        {sidebarOpen && (
          <>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent via-rose to-violet text-lg shadow-lg shadow-accent/20">
            🚕
          </div>
          <div className="leading-tight overflow-hidden">
            <div className="text-[15px] font-bold tracking-tight text-white whitespace-nowrap">Addis Ride</div>
            <div className="text-[10px] font-medium text-slate-500 whitespace-nowrap">Demand Forecasting</div>
          </div>
          <button onClick={() => setSidebarOpen(false)}
                  className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition"
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar">
            ◁
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[.18em] text-slate-600">Dashboard</div>
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setView(item.id)}
                    className={`sidebar-nav-item w-full ${view === item.id ? "active" : ""}`}>
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Zone selector (sidebar) */}
        <div className="px-4 py-3 border-t border-white/5">
          <div className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-600 mb-2">Zone</div>
          <select value={zone} onChange={(e) => setZone(e.target.value)}
                  className="w-full rounded-xl bg-ink-800 border border-white/10 px-3 py-2.5 text-sm font-semibold text-white outline-none hover:border-white/20 focus:border-accent/50 transition cursor-pointer">
            {meta?.zones.map((z) => <option key={z.zone} value={z.zone} className="bg-ink-900">{z.zone}</option>)}
          </select>
          {zoneInfo && (
            <div className="mt-2 flex items-center gap-2">
              <span className="badge badge-accent">{zoneInfo.type_label}</span>
              <span className="badge">{zoneInfo.fare.toFixed(0)} birr</span>
            </div>
          )}
        </div>

        {/* Zone list (sidebar) */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-2 border-t border-white/5">
          <div className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-600 mb-2 px-2">All Zones</div>
          <div className="space-y-0.5">
            {city?.zones.map((z, i) => (
              <button key={z.zone} onClick={() => setZone(z.zone)}
                      className={`leader-row w-full text-left ${z.zone === zone ? "active" : ""}`}>
                <span className="w-4 text-[10px] font-bold text-slate-600">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-slate-200 truncate">
                    {z.zone}{z.has_event && <span className="ml-1 text-[10px]">⚡</span>}
                  </div>
                </div>
                <Spark values={z.hourly} color={z.zone === zone ? "#ff7a45" : "#4c9bff"} />
                <span className="text-[11px] font-bold tabular-nums text-white w-10 text-right">{fmt.int(z.total)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Model info (bottom) */}
        {meta && (
          <div className="px-4 py-3 border-t border-white/5 space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-600">Model</div>
            <div className="text-[11px] text-slate-400">
              <span className="text-slate-200 font-semibold">{meta.model.name}</span>
              <br />{meta.model.n_features} features · trained {meta.model.trained_on}
            </div>
            <div className="flex gap-2 mt-1">
              <span className="badge badge-mint">RMSE {meta.model.rmse}</span>
              <span className="badge">{Math.round(100 * (1 - meta.model.rmse / meta.model.baseline_rmse))}% vs baseline</span>
            </div>
          </div>
        )}
          </>
        )}
      </aside>

      {/* ════════ MAIN CONTENT ═══════════════════════════════════════ */}
      <main className="flex-1 min-w-0 overflow-y-auto scrollbar-thin bg-ambient">
        {/* ── Top header bar ─────────────────────────────────────── */}
        <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-950/70 backdrop-blur-xl">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white">
                  {view === "overview" && "Dashboard Overview"}
                  {view === "forecast" && `24-Hour Forecast`}
                  {view === "drivers" && "Driver Planning"}
                  {view === "table" && "Hourly Data"}
                </h1>
                <p className="text-[11px] text-slate-500">
                  {zone} · {date ? fmt.day(date).long : "Loading..."} · {city?.weekday ?? ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {meta && (
                <>
                  <span className="badge">Team {meta.team}</span>
                  <span className="badge badge-accent">RMSE {meta.model.rmse}</span>
                </>
              )}
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-accent to-violet grid place-items-center text-[11px] font-bold text-white shadow-lg">
                TD
              </div>
            </div>
          </div>
        </header>

        <div className="px-6 py-5 space-y-5">
          {/* Notices */}
          {notice && (
            <div className="flex items-start gap-3 glass-sm px-4 py-3 text-sm text-sky-100 border-sky/30 bg-sky/10 animate-in">
              <span>📅</span><span className="flex-1">{notice}</span>
              <button className="text-slate-400 hover:text-white transition" onClick={() => setNotice(null)} aria-label="Dismiss">✕</button>
            </div>
          )}
          {error && meta && (
            <div className="glass-sm px-4 py-3 text-sm text-red-200 border-red-400/30 bg-red-500/10 animate-in">{error}</div>
          )}

          {/* ── Date strip ──────────────────────────────────────── */}
          <section className="animate-in">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Forecast Period</span>
              {date && <span className="text-xs font-semibold text-slate-300">{fmt.day(date).long}</span>}
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
              {meta?.dates.map((d) => {
                const f = fmt.day(d);
                const on = d === date;
                return (
                  <button key={d} onClick={() => setDate(d)}
                          className={`date-pill ${on ? "active" : ""}`}>
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${on ? "text-accent" : f.weekend ? "text-accent/60" : "text-slate-500"}`}>{f.dow}</span>
                    <span className={`text-lg font-bold leading-6 ${on ? "text-white" : "text-slate-300"}`}>{f.num}</span>
                    <span className={`text-[9px] ${on ? "text-accent/80" : "text-slate-600"}`}>Nov</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ══════ VIEW: OVERVIEW ══════════════════════════════════ */}
          {view === "overview" && (
            <>
              {/* KPI row */}
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Kpi label="Total Trips" value={k ? fmt.int(k.total) : "–"} color="#ff7a45" icon="🚀"
                     sub={k ? <span><Delta v={k.vs_usual_pct} /> vs usual {fc?.weekday}</span> : null} delay={0} />
                <Kpi label="Peak Hour" value={k?.peak_hour ?? "–"} color="#4c9bff" icon="⏰"
                     sub={k ? `${fmt.int(k.peak_trips)} trips · ${Math.round(k.peak_range[0])}–${Math.round(k.peak_range[1])} range` : null} delay={1} />
                <Kpi label="Drivers Needed" value={k ? String(k.peak_drivers) : "–"} color="#2bd4a4" icon="🚗"
                     sub={k ? `${fmt.int(k.driver_hours)} driver-hours today` : null} delay={2} />
                <Kpi label="Gross Revenue" value={k ? `${fmt.birr(k.gross_fares)}` : "–"} unit="birr" color="#a78bfa" icon="💰"
                     sub={fc ? `at ${fc.fare.toFixed(0)} birr/trip avg` : null} delay={3} />
              </section>

              {/* Map + Zone panel */}
              <section className="grid gap-5 lg:grid-cols-12 animate-in animate-in-d2">
                <div className="glass relative min-w-0 overflow-hidden lg:col-span-7" style={{ minHeight: 480 }}>
                  <div className="absolute inset-0">
                    {meta && <ZoneMap zones={meta.zones} city={city?.zones ?? null} hour={hour} selected={zone} onSelect={pick} />}
                  </div>
                  {/* Map overlay: city stats */}
                  <div className="pointer-events-none absolute left-4 top-4 z-10">
                    <div className="rounded-2xl border border-white/10 bg-ink-950/80 px-4 py-3 backdrop-blur-lg">
                      <div className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">City demand at {fmt.hour(hour)}</div>
                      <div className="mt-0.5 text-2xl font-bold text-white">{fmt.int(cityHour)} <span className="text-xs font-medium text-slate-400">trips/hr</span></div>
                      <div className="text-[10px] text-slate-500">{fmt.int(cityTotal)} total today · click a zone</div>
                    </div>
                  </div>
                  {/* Hour scrubber */}
                  <div className="absolute inset-x-4 bottom-4 z-10">
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-ink-950/85 px-4 py-3 backdrop-blur-lg">
                      <button onClick={() => setPlaying((p) => !p)}
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-r from-accent to-rose text-white shadow-lg shadow-accent/30 transition hover:scale-110 active:scale-95"
                              aria-label={playing ? "Pause" : "Play the day"}>
                        {playing ? "❚❚" : "▶"}
                      </button>
                      <div className="flex-1">
                        <input type="range" min={0} max={23} value={hour} className="scrub"
                               onChange={(e) => { setPlaying(false); setHour(Number(e.target.value)); }} aria-label="Hour of day" />
                        <div className="relative mt-1 h-3 text-[9px] font-medium text-slate-500">
                          {[0, 3, 6, 9, 12, 15, 18, 21].map((x) => (
                            <span key={x} className={`absolute -translate-x-1/2 ${x % 6 ? "hidden sm:inline" : ""}`}
                                  style={{ left: `calc(9px + (100% - 18px) * ${x / 23})` }}>{fmt.hour(x)}</span>
                          ))}
                        </div>
                      </div>
                      <div className="w-16 text-right text-lg font-bold tabular-nums text-white">{fmt.hour(hour)}</div>
                    </div>
                  </div>
                </div>

                {/* Right panel: zone info + live stats */}
                <div className="min-w-0 space-y-4 lg:col-span-5">
                  {/* Zone header */}
                  <div className="glass p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Selected Zone</div>
                        <select value={zone} onChange={(e) => setZone(e.target.value)}
                                className="-ml-1 mt-0.5 cursor-pointer rounded-lg bg-transparent px-1 text-2xl font-bold tracking-tight text-white outline-none hover:bg-white/5 transition">
                          {meta?.zones.map((z) => <option key={z.zone} value={z.zone} className="bg-ink-900 text-base">{z.zone}</option>)}
                        </select>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="badge badge-accent">{zoneInfo?.type_label}</span>
                          <span className="badge">{zoneInfo?.fare.toFixed(0)} birr avg</span>
                        </div>
                      </div>
                      {h && (
                        <div className="glass-sm px-4 py-3 text-right">
                          <div className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">at {h.time}</div>
                          <div className="text-2xl font-bold text-accent">{fmt.int(h.forecast)}</div>
                          <div className="text-[10px] text-slate-400">{h.drivers} drivers</div>
                        </div>
                      )}
                    </div>
                    {/* Lookup chips */}
                    <div className="mt-4 border-t border-white/5 pt-4">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Context & Events</div>
                      <div className="flex flex-wrap gap-2">
                        {fc?.lookup.chips.map((c, i) => (
                          <span key={i} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold
                            ${c.kind === "event" ? "border-sky/30 bg-sky/10 text-sky-100"
                              : c.kind === "rain" ? "border-mint/30 bg-mint/10 text-emerald-100"
                              : "border-white/10 bg-white/5 text-slate-300"}`}>
                            <span>{c.icon}</span>{c.text}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Quick sparkline leaderboard */}
                  <div className="glass p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-white">Zone Leaderboard</h3>
                      <span className="text-[10px] text-slate-500">{city?.weekday}</span>
                    </div>
                    <div className="space-y-0.5 max-h-[280px] overflow-y-auto scrollbar-thin">
                      {city?.zones.map((z, i) => {
                        const pct = z.usual_total ? 100 * (z.total / z.usual_total - 1) : 0;
                        const on = z.zone === zone;
                        return (
                          <button key={z.zone} onClick={() => setZone(z.zone)}
                                  className={`leader-row w-full text-left ${on ? "active" : ""}`}>
                            <span className="w-5 text-[10px] font-bold text-slate-600">{i + 1}</span>
                            <span className="flex-1 text-[12px] font-semibold text-slate-200">{z.zone}{z.has_event && <span className="ml-1 text-[10px]">⚡</span>}</span>
                            <Spark values={z.hourly} color={on ? "#ff7a45" : "#4c9bff"} />
                            <span className="w-12 text-right text-[11px] font-bold tabular-nums text-white">{fmt.int(z.total)}</span>
                            <span className="w-12 text-right text-[10px]"><Delta v={pct} /></span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>

              {/* Mini forecast preview */}
              <section className="glass p-5 animate-in animate-in-d3">
                <div className="flex items-end justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-white">24-Hour Curve</h2>
                    <p className="text-xs text-slate-400">{zone} · {fc ? fmt.day(fc.date).long : ""}</p>
                  </div>
                  <div className="flex flex-wrap gap-4 text-[10px] text-slate-400">
                    <Legend swatch={<span className="h-0.5 w-5 rounded bg-accent" />} label="Forecast" />
                    <Legend swatch={<span className="h-3 w-5 rounded bg-accent/25" />} label="80% range" />
                    <Legend swatch={<span className="h-0 w-5 border-t-2 border-dashed border-slate-400" />} label="Usual" />
                    {!!fc?.events.length && <Legend swatch={<span className="h-3 w-5 rounded border border-sky/50 bg-sky/20" />} label="Event" />}
                  </div>
                </div>
                {fc && <ForecastChart hours={fc.hours} events={fc.events} hour={hour} onHover={setHour} />}
              </section>
            </>
          )}

          {/* ══════ VIEW: FORECAST ════════════════════════════════════ */}
          {view === "forecast" && (
            <>
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in">
                <Kpi label="Total Trips" value={k ? fmt.int(k.total) : "–"} color="#ff7a45" icon="🚀"
                     sub={k ? <span><Delta v={k.vs_usual_pct} /> vs usual</span> : null} delay={0} />
                <Kpi label="Peak Hour" value={k?.peak_hour ?? "–"} color="#4c9bff" icon="⏰"
                     sub={k ? `${fmt.int(k.peak_trips)} trips` : null} delay={1} />
                <Kpi label="Peak Drivers" value={k ? String(k.peak_drivers) : "–"} color="#2bd4a4" icon="🚗"
                     sub={k ? `${fmt.int(k.driver_hours)} driver-hrs` : null} delay={2} />
                <Kpi label="Revenue" value={k ? `${fmt.birr(k.gross_fares)}` : "–"} unit="birr" color="#a78bfa" icon="💰"
                     sub={fc ? `${fc.fare.toFixed(0)} birr/trip` : null} delay={3} />
              </section>
              <section className="glass p-5 animate-in animate-in-d1">
                <div className="flex items-end justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-white">Hourly Forecast · {zone}</h2>
                    <p className="text-sm text-slate-400">{fc ? fmt.day(fc.date).long : ""}</p>
                  </div>
                  <div className="flex flex-wrap gap-4 text-[10px] text-slate-400">
                    <Legend swatch={<span className="h-0.5 w-5 rounded bg-accent" />} label="Forecast" />
                    <Legend swatch={<span className="h-3 w-5 rounded bg-accent/25" />} label="80% range" />
                    <Legend swatch={<span className="h-0 w-5 border-t-2 border-dashed border-slate-400" />} label="Usual day" />
                    {!!fc?.events.length && <Legend swatch={<span className="h-3 w-5 rounded border border-sky/50 bg-sky/20" />} label="Event window" />}
                  </div>
                </div>
                {fc && <ForecastChart hours={fc.hours} events={fc.events} hour={hour} onHover={setHour} />}
              </section>

              {/* Lookup context */}
              <section className="glass p-5 animate-in animate-in-d2">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Weather & Events Lookup</div>
                <div className="flex flex-wrap gap-2">
                  {fc?.lookup.chips.map((c, i) => (
                    <span key={i} className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-[12px] font-semibold
                      ${c.kind === "event" ? "border-sky/30 bg-sky/10 text-sky-100"
                        : c.kind === "rain" ? "border-mint/30 bg-mint/10 text-emerald-100"
                        : "border-white/10 bg-white/5 text-slate-300"}`}>
                      <span className="text-base">{c.icon}</span>{c.text}
                    </span>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* ══════ VIEW: DRIVERS ═════════════════════════════════════ */}
          {view === "drivers" && (
            <>
              <section className="glass p-5 animate-in">
                <h2 className="text-xl font-bold tracking-tight text-white">Driver Staffing Plan</h2>
                <p className="mb-4 text-sm text-slate-400">
                  Bars: forecast ÷ {meta?.trips_per_driver_hour} trips/driver-hour (orange = busiest) ·
                  <span className="text-mint"> green ticks</span>: safe staffing at 80% upper bound
                </p>
                {fc && <DriverChart hours={fc.hours} hour={hour} />}
              </section>

              {/* Shift cards */}
              {fc && (
                <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in animate-in-d1">
                  {SHIFTS.map((s) => {
                    const hs = fc.hours.filter((h) => h.hour >= s.from && h.hour < s.to);
                    const peak = Math.max(...hs.map((h) => h.drivers));
                    const safe = Math.max(...hs.map((h) => h.drivers_safe));
                    const trips = hs.reduce((a, h) => a + h.forecast, 0);
                    const active = hour >= s.from && hour < s.to;
                    return (
                      <div key={s.label}
                           className={`glass glass-hover p-4 ${active ? "border-accent/30 glow" : ""}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{s.icon}</span>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">{s.label}</span>
                        </div>
                        <div className="text-[10px] tabular-nums text-slate-500 mt-0.5">{fmt.hour(s.from)}–{fmt.hour(s.to % 24)}</div>
                        <div className="mt-3 text-3xl font-bold tabular-nums text-white">{fmt.int(peak)}<span className="ml-1.5 text-xs font-medium text-slate-400">drivers</span></div>
                        <div className="mt-1 text-xs text-slate-400">
                          <span className="text-mint font-semibold">{fmt.int(safe)} safe</span> · {fmt.int(trips)} trips
                        </div>
                      </div>
                    );
                  })}
                </section>
              )}
            </>
          )}

          {/* ══════ VIEW: TABLE ═══════════════════════════════════════ */}
          {view === "table" && fc && (
            <section className="glass overflow-hidden animate-in">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-white">Hourly Data · {zone}</h2>
                  <p className="text-xs text-slate-400">{fmt.day(fc.date).long} — all numbers behind the charts</p>
                </div>
                <a download={`forecast_${fc.zone.toLowerCase().replace(/ /g, "_")}_${fc.date}.csv`}
                   href={`data:text/csv;charset=utf-8,${encodeURIComponent(toCsv(fc))}`}
                   className="glass-sm px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/10 transition flex items-center gap-2">
                  <span>⬇</span> Export CSV
                </a>
              </div>
              <div className="scrollbar-thin max-h-[600px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-ink-850/95 backdrop-blur text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>{["Hour", "Forecast", "80% Range", "Usual", "Drivers", "Safe", "Fares (birr)", "Temp", "Rain", "Event"].map((c) =>
                      <th key={c} className="px-4 py-3 text-right font-bold first:text-left border-b border-white/5">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {fc.hours.map((r) => (
                      <tr key={r.hour} onMouseEnter={() => setHour(r.hour)}
                          className={`border-t border-white/[.04] tabular-nums transition ${r.hour === hour ? "bg-accent/10" : "hover:bg-white/[.03]"}`}>
                        <td className="px-4 py-2.5 font-bold text-slate-200">{r.time}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-white">{fmt.one(r.forecast)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-400">{Math.round(r.lower_80)}–{Math.round(r.upper_80)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-400">{fmt.one(r.typical)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-200">{r.drivers}</td>
                        <td className="px-4 py-2.5 text-right text-mint font-semibold">{r.drivers_safe}</td>
                        <td className="px-4 py-2.5 text-right text-slate-200">{fmt.int(r.fares)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-400">{r.temp_c.toFixed(1)}°</td>
                        <td className="px-4 py-2.5 text-right text-slate-400">{r.rain_mm > 0 ? r.rain_mm : "–"}</td>
                        <td className="px-4 py-2.5 text-right">{r.event ? <span className="text-sky">●</span> : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Footer ─────────────────────────────────────────── */}
          <footer className="flex flex-wrap items-center justify-between gap-3 px-1 pb-4 pt-2 text-[10px] text-slate-600">
            <span>Team {meta?.team} · Qiyas AI Hackathon · {meta?.model.name} · {meta?.model.n_features} features</span>
            <span>Validation RMSE {meta?.model.rmse} · MAE {meta?.model.mae} · synthetic data</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

function toCsv(fc: Forecast) {
  const head = "hour,forecast_trips,lower_80,upper_80,usual_day,drivers_needed,drivers_safe,gross_fares_birr,temp_c,rain_mm,event_window";
  return [head, ...fc.hours.map((r) => [r.time, r.forecast, r.lower_80, r.upper_80, r.typical, r.drivers, r.drivers_safe, r.fares, r.temp_c, r.rain_mm, r.event ? 1 : 0].join(","))].join("\n");
}

function Kpi({ label, value, unit, sub, color, icon, delay = 0 }: {
  label: string; value: string; unit?: string; sub: React.ReactNode; color: string; icon: string; delay?: number;
}) {
  return (
    <div className={`glass glass-hover relative p-5 animate-in animate-in-d${delay}`}>
      <div className="kpi-orb" style={{ background: color }} />
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">
        <span className="text-base">{icon}</span>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        {label}
      </div>
      <div className="mt-3 text-[34px] font-bold leading-none tracking-tight text-white">
        {value}{unit && <span className="ml-1.5 text-sm font-semibold text-slate-400">{unit}</span>}
      </div>
      <div className="mt-2 text-[11px] text-slate-400">{sub}</div>
    </div>
  );
}

function Delta({ v }: { v: number }) {
  const up = v >= 0;
  return <span className={`font-bold ${up ? "text-mint" : "text-rose"}`}>{up ? "▲" : "▼"} {Math.abs(v).toFixed(0)}%</span>;
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return <span className="flex items-center gap-2">{swatch}{label}</span>;
}
