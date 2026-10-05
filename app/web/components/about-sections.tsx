"use client";

import type { Meta } from "@/lib/api";
import { ABLATION, DATASETS, FINDINGS, LIMITATIONS, MODELS, PIPELINE, TEAM } from "@/lib/project";

export const ABOUT_SECTIONS = [
  { id: "overview", label: "Overview" }, { id: "data", label: "Data" }, { id: "pipeline", label: "Pipeline" },
  { id: "findings", label: "Findings" }, { id: "model", label: "Model" }, { id: "limits", label: "Limits" }, { id: "team", label: "Team" },
] as const;

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2.5 mt-6 text-[11px] font-semibold uppercase tracking-[.16em] text-slate-500 first:mt-0">{children}</h3>;
}
function Stat({ value, label, tone = "text-white" }: { value: string; label: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[.03] p-3">
      <div className={`text-xl font-bold tabular-nums ${tone}`}>{value}</div>
      <div className="mt-0.5 text-[11.5px] leading-snug text-slate-400">{label}</div>
    </div>
  );
}

function Card({ id, icon, title, className = "", children }: { id: string; icon: string; title: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={`glass scroll-mt-28 p-6 ${className}`}>
      <h2 className="mb-4 flex items-center gap-2.5 text-lg font-bold tracking-tight text-white">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/15 text-[14px] text-accent">{icon}</span>{title}
      </h2>
      {children}
    </section>
  );
}

// The project write-up: business problem, data, pipeline, findings, model, limitations and team.
export default function AboutSections({ meta }: { meta: Meta | null }) {
  const m = meta?.model;
  const better = m ? Math.round(100 * (1 - m.rmse / m.baseline_rmse)) : null;
  const maxRmse = Math.max(...MODELS.map((x) => x.rmse));

  return (
    <div className="grid gap-5 text-sm text-slate-300 lg:grid-cols-2">
          <Card id="overview" icon="◎" title="Overview" className="lg:col-span-2">
              <H>The business problem</H>
              <p className="leading-relaxed">
                Ride demand in Addis Ababa swings by zone, hour, weather and events. Too few drivers means lost rides;
                too many means idle cars. Operators need a dependable hourly forecast <b className="text-white">before</b> the
                demand arrives.
              </p>
              <H>Objective</H>
              <ul className="space-y-1.5">
                {["Forecast hourly trips for 12 zones, 1–14 Nov 2025", "Beat simple rules using only forecast-time inputs",
                  "Turn forecasts into drivers, fares and a range of outcomes"].map((t, i) => (
                  <li key={t} className="flex gap-2.5"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/20 text-[11px] font-bold text-accent">{i + 1}</span>{t}</li>
                ))}
              </ul>
              <H>Headline results</H>
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                <Stat value={m ? `${m.rmse}` : "–"} label="RMSE, trips per zone-hour (18–31 Oct)" tone="text-accent" />
                <Stat value={better !== null ? `−${better}%` : "–"} label={`vs best simple baseline (${m?.baseline_rmse ?? "–"})`} tone="text-mint" />
                <Stat value={m ? `${m.rolling_rmse} ± ${m.rolling_rmse_sd}` : "–"} label="RMSE over 5 rolling 14-day folds" />
                <Stat value="79.8%" label="of actual hours inside the 80% range" />
              </div>
              <H>How to use the dashboard</H>
              <ul className="space-y-1.5 text-[13px] text-slate-400">
                <li>• Pick a <b className="text-slate-200">day</b> in the strip and a <b className="text-slate-200">zone</b> on the map or list.</li>
                <li>• Drag or play the <b className="text-slate-200">hour slider</b> to watch demand move across the city.</li>
                <li>• Weather and events are looked up for you; ⚡ marks a zone with an event that day.</li>
                <li>• Drivers needed = forecast ÷ {meta?.trips_per_driver_hour ?? 1.3} trips per driver-hour.</li>
              </ul>
          </Card>

          <Card id="data" icon="▤" title="Data" className="">
              <H>Four input tables</H>
              <div className="space-y-2.5">
                {DATASETS.map((d) => (
                  <div key={d.name} className="rounded-2xl border border-white/5 bg-white/[.03] p-3.5">
                    <div className="flex items-center gap-2"><span>{d.icon}</span><span className="font-semibold text-white">{d.name}</span></div>
                    <div className="mt-1 text-[12px] font-semibold text-accent">{d.rows} · {d.span}</div>
                    <p className="mt-1 text-[12.5px] leading-snug text-slate-400">{d.note}</p>
                  </div>
                ))}
              </div>
              <H>Coverage</H>
              <div className="grid grid-cols-3 gap-2.5">
                <Stat value={`${meta?.zones.length ?? 12}`} label="zones" />
                <Stat value="10" label="months of history" />
                <Stat value={m ? m.n_train.toLocaleString() : "–"} label="training zone-hours" />
              </div>
              <p className="mt-4 text-[12px] italic text-slate-500">All data is synthetic, provided by the hackathon organisers.</p>
          </Card>

          <Card id="pipeline" icon="⇢" title="Pipeline" className="">
              <H>Six phases</H>
              <ol className="relative space-y-4 border-l border-white/10 pl-5">
                {PIPELINE.map((p, i) => (
                  <li key={p.name} className="relative">
                    <span className="absolute -left-[31px] top-0 grid h-5 w-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-white ring-4 ring-ink-900">{i + 1}</span>
                    <div className="font-semibold text-white">{p.name}</div>
                    <p className="mt-0.5 text-[12.5px] leading-snug text-slate-400">{p.text}</p>
                  </li>
                ))}
              </ol>
              <H>Guardrails</H>
              <div className="flex flex-wrap gap-1.5">
                {["Forecast-time inputs only", "Chronological validation", "Fit on training data only", "random_state = 42"].map((g) => (
                  <span key={g} className="rounded-full border border-mint/30 bg-mint/10 px-2.5 py-1 text-[11.5px] font-medium text-mint">{g}</span>
                ))}
              </div>
          </Card>

          <Card id="findings" icon="✦" title="Key findings" className="lg:col-span-2">
              <H>What the data says</H>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
                {FINDINGS.map((f) => (
                  <div key={f.label} className="rounded-2xl border border-white/5 bg-white/[.03] p-3">
                    <div className="text-lg">{f.icon}</div>
                    <div className={`mt-1 text-lg font-bold tabular-nums ${f.value.startsWith("−") ? "text-sky" : "text-accent"}`}>{f.value}</div>
                    <div className="mt-0.5 text-[11.5px] leading-snug text-slate-400">{f.label}</div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[12.5px] leading-relaxed text-slate-400">
                Effects are local: the same rain that fills cars in Bole empties Merkato's open-air market, which is why the model
                learns weather and event effects per zone type.
              </p>
          </Card>

          <Card id="model" icon="◆" title="Model" className="">
              <H>Validation RMSE, 18–31 Oct (lower is better)</H>
              <div className="space-y-1.5">
                {MODELS.map((x) => (
                  <div key={x.name} className="flex items-center gap-2.5 text-[12.5px]">
                    <span className={`w-[150px] shrink-0 truncate ${x.final ? "font-semibold text-white" : "text-slate-400"}`}>{x.name}</span>
                    <span className="h-2 flex-1 rounded-full bg-white/5">
                      <span className={`block h-2 rounded-full ${x.final ? "bg-accent" : x.baseline ? "bg-slate-500" : "bg-sky"}`}
                            style={{ width: `${(100 * x.rmse) / maxRmse}%` }} />
                    </span>
                    <span className={`w-11 text-right tabular-nums ${x.final ? "font-bold text-accent" : "text-slate-300"}`}>{x.rmse.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-3 text-[11px] text-slate-500">
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-500" />baseline</span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-sky" />model</span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-accent" />final</span>
              </div>
              <H>What each input group adds</H>
              <div className="grid grid-cols-3 gap-2.5">
                {ABLATION.map((a) => <Stat key={a.name} value={a.change} label={`rolling RMSE, ${a.name}`} tone="text-mint" />)}
              </div>
              <H>Final model</H>
              <p className="text-[12.5px] leading-relaxed text-slate-400">
                {m?.name ?? "LightGBM (Poisson)"} on {m?.n_features ?? 36} features, trained {m?.trained_on ?? "1 Jan – 31 Oct 2025"}.
                A Poisson objective suits counts whose spread grows with their level. Ranges come from calibrated residuals.
              </p>
          </Card>

          <Card id="limits" icon="△" title="Limitations & next steps" className="">
              <H>Limitations</H>
              <div className="space-y-2.5">
                {LIMITATIONS.map((l) => (
                  <div key={l.title} className="rounded-2xl border-l-2 border-accent bg-white/[.03] p-3.5">
                    <div className="font-semibold text-white">{l.title}</div>
                    <p className="mt-0.5 text-[12.5px] leading-snug text-slate-400">{l.text}</p>
                  </div>
                ))}
              </div>
              <H>Next steps</H>
              <ul className="space-y-1.5 text-[13px] text-slate-400">
                <li>• A religious-calendar feed, so holiday eves are known in advance</li>
                <li>• Per-zone uncertainty instead of one pooled range width</li>
                <li>• Weekly retraining and live error monitoring</li>
              </ul>
          </Card>

          <Card id="team" icon="☺" title="Team" className="lg:col-span-2">
              <H>Team {meta?.team ?? "teamdev"}</H>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {TEAM.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl bg-white/[.03] px-3 py-2">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-sky/40 to-violet/40 text-[12px] font-bold text-white">
                      {t.name.split(" ").map((w) => w[0]).join("")}
                    </span>
                    <div className="leading-tight">
                      <div className="font-semibold text-white">{t.name}</div>
                      <div className="text-[11.5px] text-slate-500">{t.id}</div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[12px] text-slate-500">Qiyas / IADE AI Training Program · Addis Ababa University</p>
          </Card>
    </div>
  );
}
