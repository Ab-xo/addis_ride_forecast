"use client";

import {
  Area, Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer,
  Scatter, Tooltip, XAxis, YAxis,
} from "recharts";
import type { EventWindow, Hour } from "@/lib/api";
import { fmt } from "@/lib/api";

const AXIS = { stroke: "rgba(148,163,184,.25)", tick: { fill: "#94a3b8", fontSize: 11 } };
const GRID = <CartesianGrid stroke="rgba(148,163,184,.08)" vertical={false} />;

function Tip({ active, payload }: { active?: boolean; payload?: { payload: Hour }[] }) {
  if (!active || !payload?.length) return null;
  const h = payload[0].payload;
  return (
    <div className="rounded-xl border border-white/10 bg-ink-900/95 px-3.5 py-3 text-xs shadow-2xl backdrop-blur">
      <div className="mb-1.5 text-[13px] font-semibold text-white">{h.time}</div>
      <Row dot="#ff7a45" k="Forecast" v={`${fmt.one(h.forecast)} trips`} />
      <Row dot="rgba(255,122,69,.35)" k="80% range" v={`${Math.round(h.lower_80)}–${Math.round(h.upper_80)}`} />
      <Row dot="#94a3b8" k="Usual day" v={fmt.one(h.typical)} />
      <Row dot="#2bd4a4" k="Drivers" v={`${h.drivers} (safe ${h.drivers_safe})`} />
      <Row dot="#4c9bff" k="Weather" v={`${h.temp_c.toFixed(0)} °C · ${h.rain_mm > 0 ? `${h.rain_mm} mm` : "dry"}`} />
      {h.event && <div className="mt-1.5 text-[11px] font-medium text-sky">● inside an event window</div>}
    </div>
  );
}

function Row({ dot, k, v }: { dot: string; k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-6 py-0.5">
      <span className="flex items-center gap-1.5 text-slate-400"><span className="h-2 w-2 rounded-full" style={{ background: dot }} />{k}</span>
      <span className="font-semibold text-slate-100">{v}</span>
    </div>
  );
}

export function ForecastChart({ hours, events, hour, onHover }: {
  hours: Hour[]; events: EventWindow[]; hour: number; onHover: (h: number) => void;
}) {
  const data = hours.map((h) => ({ ...h, band: [h.lower_80, h.upper_80] as [number, number] }));
  const peak = hours.reduce((a, b) => (b.forecast > a.forecast ? b : a), hours[0]);
  return (
    <ResponsiveContainer width="100%" height={330}>
      <ComposedChart data={data} margin={{ top: 22, right: 12, bottom: 0, left: -12 }}
                     onMouseMove={(s) => { const i = Number(s?.activeTooltipIndex); if (!Number.isNaN(i)) onHover(i); }}>
        <defs>
          <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff7a45" stopOpacity={0.38} />
            <stop offset="100%" stopColor="#ff7a45" stopOpacity={0.06} />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {GRID}
        {events.map((e, i) => (
          <ReferenceArea key={i} x1={e.start_hour} x2={Math.max(e.end_hour, e.start_hour + 0.6)} fill="#4c9bff" fillOpacity={0.12}
                         stroke="#4c9bff" strokeOpacity={0.35} strokeDasharray="3 3"
                         label={{ value: `${e.icon} ${e.label}`, position: "insideTopLeft", fill: "#9cc5ff", fontSize: 11, fontWeight: 600 }} />
        ))}
        <XAxis dataKey="hour" type="number" domain={[0, 23]} ticks={[0, 3, 6, 9, 12, 15, 18, 21]} tickFormatter={fmt.hour} {...AXIS} />
        <YAxis {...AXIS} width={48} />
        <Tooltip content={<Tip />} cursor={{ stroke: "rgba(255,255,255,.25)", strokeWidth: 1 }} />
        <Area dataKey="band" type="monotone" stroke="none" fill="url(#band)" isAnimationActive={false} />
        <Line dataKey="typical" type="monotone" isAnimationActive={false} stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={1.6} dot={false} />
        <Line dataKey="forecast" type="monotone" isAnimationActive={false} stroke="#ff7a45" strokeWidth={3} dot={false} filter="url(#glow)"
              activeDot={{ r: 6, fill: "#fff", stroke: "#ff7a45", strokeWidth: 3 }} />
        <ReferenceLine x={hour} stroke="rgba(255,255,255,.35)" strokeDasharray="2 4" />
        <Scatter data={[peak]} dataKey="forecast" fill="#fff" shape={(p: { cx?: number; cy?: number }) => (
          <g>
            <circle cx={p.cx} cy={p.cy} r={5} fill="#fff" stroke="#ff7a45" strokeWidth={3} />
            <text x={(p.cx ?? 0) + (peak.hour >= 20 ? -8 : peak.hour <= 2 ? 8 : 0)} y={(p.cy ?? 0) - 12} textAnchor={peak.hour >= 20 ? "end" : peak.hour <= 2 ? "start" : "middle"} fill="#fff" fontSize={11} fontWeight={700}>Peak {peak.time}</text>
          </g>
        )} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function DriverChart({ hours, hour }: { hours: Hour[]; hour: number }) {
  const cut = [...hours].map((h) => h.drivers).sort((a, b) => a - b)[Math.floor(hours.length * 0.8)];
  return (
    <ResponsiveContainer width="100%" height={330}>
      <ComposedChart data={hours} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        {GRID}
        <XAxis dataKey="hour" type="number" domain={[-0.5, 23.5]} ticks={[0, 6, 12, 18, 23]} tickFormatter={fmt.hour} {...AXIS} />
        <YAxis {...AXIS} width={44} />
        <Tooltip content={<Tip />} cursor={{ fill: "rgba(255,255,255,.04)" }} />
        <Bar dataKey="drivers" isAnimationActive={false} radius={[5, 5, 2, 2]} barSize={13}>
          {hours.map((h) => (
            <Cell key={h.hour} fill={h.hour === hour ? "#ffffff" : h.drivers >= cut ? "#ff7a45" : "#2c3e63"} />
          ))}
        </Bar>
        <Scatter dataKey="drivers_safe" shape={(p: { cx?: number; cy?: number }) => (
          <line x1={(p.cx ?? 0) - 7} x2={(p.cx ?? 0) + 7} y1={p.cy} y2={p.cy} stroke="#2bd4a4" strokeWidth={2.5} strokeLinecap="round" />
        )} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function Spark({ values, color = "#ff7a45" }: { values: number[]; color?: string }) {
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - (v / max) * 26}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-7 w-24">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
