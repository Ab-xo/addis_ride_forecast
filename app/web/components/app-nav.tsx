"use client";

import type { CityZone, Meta, Zone } from "@/lib/api";
import { fmt } from "@/lib/api";

export const NAV = [
  { id: "overview", label: "Overview", title: "Dashboard Overview", icon: "📊" },
  { id: "forecast", label: "Forecast", title: "24-Hour Forecast", icon: "📈" },
  { id: "drivers", label: "Driver Plan", title: "Driver Plan", icon: "🚗" },
  { id: "table", label: "Data Table", title: "Hourly Data Table", icon: "📋" },
] as const;
export type Section = (typeof NAV)[number]["id"];

type Props = {
  meta: Meta | null;
  zone?: string;
  zoneInfo?: Zone;
  city?: CityZone[] | null;
  hour?: number;
  active: Section | "about";
  // Query string (?zone=..&date=..) carried between the dashboard and the About page.
  query?: string;
  collapsed: boolean;
  mobileOpen: boolean;
  onCollapse: () => void;
  onCloseMobile: () => void;
  onNavigate?: (s: Section) => void;
  onZone?: (z: string) => void;
};

function Label({ children }: { children: React.ReactNode }) {
  return <div className="px-1 pb-2 text-[10.5px] font-semibold uppercase tracking-[.16em] text-slate-500">{children}</div>;
}

// Persistent left navigation: brand, section links, zone picker, all-zones list and the model card.
// Collapses to an icon rail on desktop and slides in over the page on small screens.
export default function AppNav(p: Props) {
  const m = p.meta?.model;
  const better = m ? Math.round(100 * (1 - m.rmse / m.baseline_rmse)) : null;
  const rail = p.collapsed;
  const hour = p.hour ?? 0;
  const max = Math.max(1, ...(p.city ?? []).map((c) => c.hourly[hour] ?? 0));
  const onDashboard = p.active !== "about";
  const item = (on: boolean) => `flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-[14px] font-semibold transition
    ${rail ? "lg:justify-center lg:px-0" : ""}
    ${on ? "border-accent/40 bg-accent/10 text-accent shadow-[0_0_24px_-8px_rgba(255,122,69,.6)]" : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white"}`;

  return (
    <>
      <div onClick={p.onCloseMobile} aria-hidden
           className={`fixed inset-0 z-40 bg-ink-950/60 backdrop-blur-sm transition-opacity lg:hidden ${p.mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`} />
      <aside aria-label="Dashboard navigation"
             className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-white/[.06] bg-ink-900/95 backdrop-blur-xl transition-all duration-300 ease-out
               lg:sticky lg:top-0 lg:z-20 lg:h-screen lg:translate-x-0
               ${p.mobileOpen ? "translate-x-0" : "-translate-x-full"}
               ${rail ? "w-[268px] lg:w-[76px]" : "w-[268px]"}`}>
        {/* Brand */}
        <div className={`flex items-center gap-3 border-b border-white/[.06] py-4 ${rail ? "px-4 lg:justify-center lg:px-0" : "px-4"}`}>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent to-[#ff4d6d] text-xl shadow-lg shadow-accent/30">🚕</div>
          <div className={`min-w-0 flex-1 leading-tight ${rail ? "lg:hidden" : ""}`}>
            <div className="text-[15px] font-bold tracking-tight text-white">Addis Ride</div>
            <div className="text-[11px] font-medium text-slate-500">Demand Forecasting</div>
          </div>
          <button onClick={p.onCollapse} aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}
                  className={`hidden h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 text-slate-400 transition hover:bg-white/10 hover:text-white lg:grid ${rail ? "lg:hidden" : ""}`}>
            ◁
          </button>
          <button onClick={p.onCloseMobile} aria-label="Close menu"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden">✕</button>
        </div>
        {rail && (
          <button onClick={p.onCollapse} aria-label="Expand sidebar"
                  className="mx-auto mt-3 hidden h-9 w-9 place-items-center rounded-xl border border-white/10 text-slate-400 transition hover:bg-white/10 hover:text-white lg:grid">▷</button>
        )}

        <div className="scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto">
          {/* Sections */}
          <nav className={`pt-5 ${rail ? "px-3" : "px-4"}`}>
            {!rail && <Label>Dashboard</Label>}
            <div className="space-y-1">
              {NAV.map((n) => {
                const on = p.active === n.id;
                const inner = <><span className="text-base">{n.icon}</span><span className={rail ? "lg:hidden" : ""}>{n.label}</span></>;
                return onDashboard && p.onNavigate
                  ? <button key={n.id} onClick={() => p.onNavigate?.(n.id)} title={n.label} aria-current={on ? "true" : undefined} className={item(on)}>{inner}</button>
                  : <a key={n.id} href={`/${p.query ?? ""}#${n.id}`} title={n.label} className={item(on)}>{inner}</a>;
              })}
              <a href={`/about/${p.query ?? ""}`} title="About this project" aria-current={!onDashboard ? "page" : undefined} className={item(!onDashboard)}>
                <span className="text-base">ℹ️</span>
                <span className={rail ? "lg:hidden" : ""}>About Project</span>
              </a>
            </div>
          </nav>

          {/* Zone picker + list (hidden on the icon rail) */}
          {onDashboard && <>
          <div className={`mt-5 border-t border-white/[.06] px-4 pt-5 ${rail ? "lg:hidden" : ""}`}>
            <Label>Zone</Label>
            <select value={p.zone} onChange={(e) => p.onZone?.(e.target.value)} aria-label="Zone"
                    className="w-full cursor-pointer rounded-xl border border-white/10 bg-ink-850 px-3.5 py-2.5 text-[15px] font-semibold text-white outline-none transition hover:border-white/20 focus:border-accent/60">
              {p.meta?.zones.map((z) => <option key={z.zone} value={z.zone}>{z.zone}</option>)}
            </select>
            {p.zoneInfo && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                <span className="rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1 text-[12px] font-semibold text-orange-200">{p.zoneInfo.type_label}</span>
                <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[12px] font-semibold text-slate-200">{p.zoneInfo.fare.toFixed(0)} birr</span>
              </div>
            )}
          </div>

          <div className={`mt-5 px-4 pb-4 ${rail ? "lg:hidden" : ""}`}>
            <Label>All zones · {fmt.hour(hour)}</Label>
            <div className="space-y-0.5">
              {p.meta?.zones.map((z) => {
                const v = p.city?.find((c) => c.zone === z.zone)?.hourly[hour] ?? 0;
                const on = z.zone === p.zone;
                return (
                  <button key={z.zone} onClick={() => p.onZone?.(z.zone)}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition ${on ? "bg-white/[.07] text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: on ? "#ff7a45" : `rgba(76,155,255,${0.35 + 0.65 * v / max})` }} />
                    <span className="flex-1 truncate font-medium">{z.zone}</span>
                    <span className="tabular-nums text-[12px] text-slate-500">{p.city ? fmt.int(v) : "–"}</span>
                  </button>
                );
              })}
            </div>
          </div>
          </>}
        </div>

        {/* Model card */}
        {m && (
          <div className={`border-t border-white/[.06] px-4 py-4 ${rail ? "lg:hidden" : ""}`}>
            <Label>Model</Label>
            <div className="px-1 text-[13px] font-semibold text-white">{m.name}</div>
            <div className="px-1 text-[11.5px] leading-snug text-slate-500">{m.n_features} features · trained {m.trained_on}</div>
            <div className="mt-2.5 flex gap-2">
              <span className="rounded-lg border border-mint/30 bg-mint/10 px-2.5 py-1 text-[12px] font-semibold text-emerald-200">RMSE {m.rmse}</span>
              <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[12px] font-semibold text-slate-200">{better}% vs baseline</span>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
