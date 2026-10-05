"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, fmt, type City, type Forecast, type Meta } from "@/lib/api";
import { DriverChart, ForecastChart, Spark } from "@/components/charts";
import AppNav, { NAV, type Section } from "@/components/app-nav";

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
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [active, setActive] = useState<Section>("overview");

  // Remember whether the nav is collapsed (per browser; the page works the same without storage).
  useEffect(() => {
    try { setCollapsed(localStorage.getItem("nav-collapsed") === "1"); } catch {}
  }, []);
  const toggleCollapsed = useCallback(() => setCollapsed((c) => {
    try { localStorage.setItem("nav-collapsed", c ? "0" : "1"); } catch {}
    return !c;
  }), []);

  // Highlight the nav item of the section in view.
  useEffect(() => {
    const els = NAV.map((n) => document.getElementById(n.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((entries) => {
      const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (hit) setActive(hit.target.id as Section);
    }, { rootMargin: "-35% 0px -60% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [meta]);
  // Arriving from the About page with /#forecast etc.: jump to that section once the page has content.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (fc && NAV.some((n) => n.id === id)) {
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 50);
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, [fc]);
  const navigate = useCallback((s: Section) => {
    setMobileNav(false);
    setActive(s);
    document.getElementById(s)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Initial load: metadata, then zone/date from the URL (?zone=Bole&date=2025-11-05) if valid.
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
        else setNotice(`We only forecast 1–14 November 2025, so “${qd}” can’t be shown. Showing 1 November — pick any day below.`);
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

  // Play the day hour by hour on the map.
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
      <main className="grid min-h-screen place-items-center p-8">
        <div className="glass max-w-md p-8 text-center">
          <div className="text-3xl">🛰️</div>
          <h1 className="mt-3 text-lg font-semibold text-white">Forecast server not reachable</h1>
          <p className="mt-2 text-sm text-slate-400">{error}</p>
          <p className="mt-4 text-xs text-slate-500">Start it from the repository root with <code className="text-accent">python app/app.py</code></p>
        </div>
      </main>
    );
  }

  const k = fc?.kpis;
  const h = fc?.hours[hour];
  const query = zone && date ? `?zone=${encodeURIComponent(zone)}&date=${date}` : "";
  const title = NAV.find((n) => n.id === active)?.title ?? "Dashboard Overview";

  return (
    <div className="bg-grid flex min-h-screen">
      <AppNav meta={meta} zone={zone} zoneInfo={zoneInfo} city={city?.zones ?? null} hour={hour} active={active}
              collapsed={collapsed} mobileOpen={mobileNav} onCollapse={toggleCollapsed} onCloseMobile={() => setMobileNav(false)}
              onNavigate={navigate} onZone={(z) => { setZone(z); setMobileNav(false); }} query={query} />

      <main className="min-w-0 flex-1">
        {/* ── Top bar ─────────────────────────────────────────────── */}
        <header className="sticky top-0 z-30 border-b border-white/[.06] bg-ink-950/75 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3.5 md:px-7">
            <button onClick={() => setMobileNav(true)} aria-label="Open menu"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 lg:hidden">☰</button>
            <div className="min-w-0 leading-tight">
              <h1 className="truncate text-[19px] font-bold tracking-tight text-white">{title}</h1>
              <div className="truncate text-[12px] font-medium text-slate-500">{zone}{date && ` · ${fmt.day(date).long}`}</div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {meta && <>
                <span className="hidden rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-slate-200 md:inline">Team {meta.team}</span>
                <span className="hidden rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-[12px] font-semibold text-orange-200 sm:inline">RMSE {meta.model.rmse}</span>
              </>}
              <a href={`/about/${query}`} aria-label="About this project" title="About this project"
                 className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-accent to-violet text-[12px] font-bold text-white shadow-lg shadow-accent/20 transition hover:scale-105">TD</a>
            </div>
          </div>
        </header>

        <div className="space-y-5 px-4 py-5 md:px-7">
          {notice && (
            <div className="flex items-start gap-3 rounded-2xl border border-sky/30 bg-sky/10 px-4 py-3 text-sm text-sky-100">
              <span>📅</span><span className="flex-1">{notice}</span>
              <button className="text-slate-400 hover:text-white" onClick={() => setNotice(null)} aria-label="Dismiss">✕</button>
            </div>
          )}
          {error && meta && (
            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
          )}

          <section id="overview" className="scroll-mt-24 space-y-5">
            {/* ── Date strip ──────────────────────────────────────── */}
            <div className="scrollbar-thin flex items-center gap-2 overflow-x-auto pb-1">
              <span className="mr-1 shrink-0 text-[10.5px] font-semibold uppercase tracking-[.16em] text-slate-500">Forecast day</span>
              {meta?.dates.map((d) => {
                const f = fmt.day(d);
                const on = d === date;
                return (
                  <button key={d} onClick={() => setDate(d)} aria-pressed={on}
                          className={`flex shrink-0 items-baseline gap-1.5 rounded-xl border px-3 py-1.5 text-[13px] transition
                            ${on ? "glow border-accent bg-accent font-semibold text-white" : "border-white/[.06] bg-ink-850/80 text-slate-300 hover:border-white/15 hover:bg-ink-800"}`}>
                    <span className={`text-[10.5px] font-semibold uppercase ${on ? "text-white/85" : f.weekend ? "text-accent/80" : "text-slate-500"}`}>{f.dow}</span>
                    <span className="font-bold">{f.num}</span>
                  </button>
                );
              })}
            </div>

            {/* ── KPIs ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <Kpi label="Trips expected" value={k ? fmt.int(k.total) : "–"} color="#ff7a45"
                   sub={k ? <span><Delta v={k.vs_usual_pct} /> vs usual {fc?.weekday}</span> : null} />
              <Kpi label="Peak hour" value={k?.peak_hour ?? "–"} color="#4c9bff"
                   sub={k ? `${fmt.int(k.peak_trips)} trips · ${Math.round(k.peak_range[0])}–${Math.round(k.peak_range[1])} range` : null} />
              <Kpi label="Drivers at peak" value={k ? String(k.peak_drivers) : "–"} color="#2bd4a4"
                   sub={k ? `${fmt.int(k.driver_hours)} driver-hours today` : null} />
              <Kpi label="Gross fares" value={k ? `${fmt.birr(k.gross_fares)}` : "–"} unit="birr" color="#a78bfa"
                   sub={fc ? `at ${fc.fare.toFixed(0)} birr/trip avg` : null} />
            </div>

            {/* ── Map + selected zone + leaderboard ───────────────── */}
            <div className="grid gap-5 lg:grid-cols-12">
              <div className="glass relative min-w-0 overflow-hidden lg:col-span-7" style={{ minHeight: 560 }}>
                <div className="absolute inset-0">
                  {meta && <ZoneMap zones={meta.zones} city={city?.zones ?? null} hour={hour} selected={zone} onSelect={pick} />}
                </div>
                <div className="pointer-events-none absolute left-4 top-4 z-10">
                  <div className="rounded-2xl border border-white/10 bg-ink-950/85 px-4 py-3 backdrop-blur">
                    <div className="text-[10.5px] font-semibold uppercase tracking-[.14em] text-slate-500">City demand at {fmt.hour(hour)}</div>
                    <div className="mt-0.5 text-2xl font-bold text-white">{fmt.int(cityHour)} <span className="text-sm font-medium text-slate-400">trips/hr</span></div>
                    <div className="text-xs text-slate-500">{fmt.int(cityTotal)} total today · click a zone</div>
                  </div>
                </div>
                {/* Hour scrubber */}
                <div className="absolute inset-x-4 bottom-4 z-10">
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-ink-950/85 px-4 py-3 backdrop-blur">
                    <button onClick={() => setPlaying((p) => !p)}
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-white shadow-lg shadow-accent/30 transition hover:scale-105"
                            aria-label={playing ? "Pause" : "Play the day"}>
                      {playing ? "❚❚" : "▶"}
                    </button>
                    <div className="flex-1">
                      <input type="range" min={0} max={23} value={hour} className="scrub"
                             onChange={(e) => { setPlaying(false); setHour(Number(e.target.value)); }} aria-label="Hour of day" />
                      <div className="relative mt-1 h-3 text-[10px] font-medium text-slate-500">
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

              <div className="flex min-w-0 flex-col gap-5 lg:col-span-5 lg:h-[560px]">
                {/* Selected zone */}
                <div className="glass shrink-0 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[10.5px] font-semibold uppercase tracking-[.16em] text-slate-500">Selected zone</div>
                      <select value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Selected zone"
                              className="-ml-1 mt-0.5 max-w-full cursor-pointer rounded-lg bg-transparent px-1 text-[26px] font-bold tracking-tight text-white outline-none hover:bg-white/5">
                        {meta?.zones.map((z) => <option key={z.zone} value={z.zone} className="bg-ink-900 text-base">{z.zone}</option>)}
                      </select>
                      {zoneInfo && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1 text-[12px] font-semibold text-orange-200">{zoneInfo.type_label}</span>
                          <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[12px] font-semibold text-slate-200">{zoneInfo.fare.toFixed(0)} birr avg</span>
                        </div>
                      )}
                    </div>
                    {h && (
                      <div className="shrink-0 rounded-2xl border border-white/10 bg-ink-850 px-4 py-2.5 text-right">
                        <div className="text-[10.5px] font-semibold uppercase tracking-[.14em] text-slate-500">At {h.time}</div>
                        <div className="text-2xl font-bold tabular-nums text-accent">{fmt.int(h.forecast)}</div>
                        <div className="text-[11px] text-slate-400">{h.drivers} drivers</div>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 border-t border-white/5 pt-4">
                    <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[.16em] text-slate-500">Context &amp; events</div>
                    <div className="flex flex-wrap gap-2">
                      {fc?.lookup.chips.map((c, i) => (
                        <span key={i} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium
                          ${c.kind === "event" ? "border-sky/30 bg-sky/10 text-sky-100"
                            : c.kind === "rain" ? "border-mint/30 bg-mint/10 text-emerald-100"
                            : "border-white/10 bg-white/5 text-slate-300"}`}>
                          <span>{c.icon}</span>{c.text}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Leaderboard */}
                <div className="glass flex min-h-0 flex-1 flex-col p-5">
                  <div className="mb-2 flex items-baseline justify-between">
                    <h2 className="text-[15px] font-bold tracking-tight text-white">Zone Leaderboard</h2>
                    <span className="text-[12px] text-slate-500">{city?.weekday}</span>
                  </div>
                  <div className="scrollbar-thin -mx-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2">
                    {city?.zones.map((z, i) => {
                      const pct = z.usual_total ? 100 * (z.total / z.usual_total - 1) : 0;
                      const on = z.zone === zone;
                      return (
                        <button key={z.zone} onClick={() => setZone(z.zone)}
                                className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left transition ${on ? "bg-accent/15 ring-1 ring-accent/40" : "hover:bg-white/5"}`}>
                          <span className="w-4 text-xs font-semibold text-slate-500">{i + 1}</span>
                          <span className="min-w-[96px] flex-1 truncate text-[13.5px] font-semibold text-slate-100">{z.zone}{z.has_event && <span className="ml-1.5 text-xs">⚡</span>}</span>
                          <span className="min-w-0 shrink overflow-hidden"><Spark values={z.hourly} color={on ? "#ff7a45" : "#4c9bff"} /></span>
                          <span className="w-12 text-right text-[13.5px] font-bold tabular-nums text-white">{fmt.int(z.total)}</span>
                          <span className="w-12 text-right text-xs"><Delta v={pct} /></span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Forecast curve ───────────────────────────────────────── */}
          <section id="forecast" className="glass scroll-mt-24 p-5">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-white">24-hour forecast · {zone}</h2>
                <p className="text-sm text-slate-400">{fc ? fmt.day(fc.date).long : ""}</p>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                <Legend swatch={<span className="h-0.5 w-5 rounded bg-accent" />} label="Forecast" />
                <Legend swatch={<span className="h-3 w-5 rounded bg-accent/25" />} label="80% range" />
                <Legend swatch={<span className="h-0 w-5 border-t-2 border-dashed border-slate-400" />} label="Usual day (last 8 weeks)" />
                {!!fc?.events.length && <Legend swatch={<span className="h-3 w-5 rounded border border-sky/50 bg-sky/20" />} label="Event window" />}
              </div>
            </div>
            {fc && <ForecastChart hours={fc.hours} events={fc.events} hour={hour} onHover={setHour} />}
          </section>

          {/* ── Driver plan ─────────────────────────────────────────── */}
          <section id="drivers" className="glass scroll-mt-24 p-5">
            <h2 className="text-lg font-bold tracking-tight text-white">Driver plan · {zone}</h2>
            <p className="mb-3 text-sm text-slate-400">
              Bars: forecast ÷ {meta?.trips_per_driver_hour} trips per driver-hour (orange = busiest hours) ·
              <span className="text-mint"> green ticks</span>: safe staffing at the top of the 80% range
            </p>
            <div className="grid gap-5 xl:grid-cols-12">
              <div className="min-w-0 xl:col-span-8">{fc && <DriverChart hours={fc.hours} hour={hour} />}</div>
              {fc && (
                <div className="grid grid-cols-2 content-start gap-3 xl:col-span-4">
                  {SHIFTS.map((s) => {
                    const hs = fc.hours.filter((h) => h.hour >= s.from && h.hour < s.to);
                    const peak = Math.max(...hs.map((h) => h.drivers));
                    const safe = Math.max(...hs.map((h) => h.drivers_safe));
                    const trips = hs.reduce((a, h) => a + h.forecast, 0);
                    const on = hour >= s.from && hour < s.to;
                    return (
                      <div key={s.label}
                           className={`rounded-2xl border p-3 transition ${on ? "border-accent/50 bg-accent/10" : "border-white/5 bg-white/[.03]"}`}>
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">{s.icon} {s.label}</div>
                        <div className="text-[11px] tabular-nums text-slate-500">{fmt.hour(s.from)}–{fmt.hour(s.to % 24)}</div>
                        <div className="mt-2 text-2xl font-bold tabular-nums text-white">{fmt.int(peak)}<span className="ml-1 text-xs font-medium text-slate-400">drivers</span></div>
                        <div className="mt-0.5 text-xs text-slate-400">
                          <span className="text-mint">{fmt.int(safe)} safe</span> · {fmt.int(trips)} trips
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* ── Hourly table ─────────────────────────────────────────── */}
          <section id="table" className="glass scroll-mt-24 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-white">Hourly data table · {zone}</h2>
                <p className="text-sm text-slate-400">Every number behind the charts, ready to export</p>
              </div>
              {fc && (
                <a download={`forecast_${fc.zone.toLowerCase().replace(/ /g, "_")}_${fc.date}.csv`}
                   href={`data:text/csv;charset=utf-8,${encodeURIComponent(toCsv(fc))}`}
                   className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10">⬇ Download CSV</a>
              )}
            </div>
            {fc && (
              <div className="scrollbar-thin max-h-[520px] overflow-auto border-t border-white/5">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-ink-850 text-[11px] uppercase tracking-wider text-slate-500">
                    <tr>{["Hour", "Forecast", "80% range", "Usual", "Drivers", "Safe drivers", "Gross fares", "Temp", "Rain", "Event"].map((c) =>
                      <th key={c} className="whitespace-nowrap px-4 py-2.5 text-right font-semibold first:text-left">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {fc.hours.map((r) => (
                      <tr key={r.hour} onMouseEnter={() => setHour(r.hour)}
                          className={`border-t border-white/5 tabular-nums ${r.hour === hour ? "bg-accent/10" : "hover:bg-white/[.03]"}`}>
                        <td className="px-4 py-2 font-semibold text-slate-200">{r.time}</td>
                        <td className="px-4 py-2 text-right font-bold text-white">{fmt.one(r.forecast)}</td>
                        <td className="px-4 py-2 text-right text-slate-400">{Math.round(r.lower_80)}–{Math.round(r.upper_80)}</td>
                        <td className="px-4 py-2 text-right text-slate-400">{fmt.one(r.typical)}</td>
                        <td className="px-4 py-2 text-right text-slate-200">{r.drivers}</td>
                        <td className="px-4 py-2 text-right text-mint">{r.drivers_safe}</td>
                        <td className="px-4 py-2 text-right text-slate-200">{fmt.int(r.fares)}</td>
                        <td className="px-4 py-2 text-right text-slate-400">{r.temp_c.toFixed(1)}°</td>
                        <td className="px-4 py-2 text-right text-slate-400">{r.rain_mm > 0 ? r.rain_mm : "–"}</td>
                        <td className="px-4 py-2 text-right">{r.event ? <span className="text-sky">●</span> : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <footer className="flex flex-wrap items-center justify-between gap-3 px-1 pb-4 pt-2 text-xs text-slate-500">
            <span>Team {meta?.team} · Qiyas Data Science &amp; AI Hackathon · LightGBM on {meta?.model.n_features} forecast-time features, trained {meta?.model.trained_on}</span>
            <span>Validation RMSE {meta?.model.rmse} · MAE {meta?.model.mae} · rolling {meta?.model.rolling_rmse} · synthetic data</span>
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

function Kpi({ label, value, unit, sub, color }: { label: string; value: string; unit?: string; sub: React.ReactNode; color: string }) {
  return (
    <div className="glass relative overflow-hidden p-4">
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-2xl" style={{ background: color }} />
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.12em] text-slate-500">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />{label}
      </div>
      <div className="mt-2 text-[32px] font-bold leading-none tracking-tight text-white">
        {value}{unit && <span className="ml-1.5 text-base font-semibold text-slate-400">{unit}</span>}
      </div>
      <div className="mt-2 text-xs text-slate-400">{sub}</div>
    </div>
  );
}

function Delta({ v }: { v: number }) {
  const up = v >= 0;
  return <span className={`font-semibold ${up ? "text-mint" : "text-rose-400"}`}>{up ? "▲" : "▼"} {Math.abs(v).toFixed(0)}%</span>;
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return <span className="flex items-center gap-2">{swatch}{label}</span>;
}
