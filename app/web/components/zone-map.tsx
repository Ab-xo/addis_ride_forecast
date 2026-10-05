"use client";

import { useMemo, useState } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/maplibre";
import type { StyleSpecification } from "maplibre-gl";
import type { CityZone, Zone } from "@/lib/api";
import { fmt } from "@/lib/api";

// CARTO raster basemap. API key is required for authenticated tile access.
// Offline, the dark background and zone bubbles still render, so the map never breaks the demo.
const CARTO_KEY = "cb1_4bvk_1_d47498fcf315e33364d583df";
export type MapStyle = "dark" | "light" | "voyager";
export const MAP_STYLES: { id: MapStyle; label: string }[] = [
  { id: "dark", label: "Dark" }, { id: "light", label: "Light" }, { id: "voyager", label: "Streets" },
];
const CARTO_PATH: Record<MapStyle, string> = { dark: "dark_all", light: "light_all", voyager: "rastertiles/voyager" };
function tileUrls(style: MapStyle) {
  return ["a", "b", "c", "d"].map((d) => `https://${d}.basemaps.cartocdn.com/${CARTO_PATH[style]}/{z}/{x}/{y}@2x.png?key=${CARTO_KEY}`);
}
function cartoStyle(style: MapStyle): StyleSpecification {
  return {
    version: 8,
    sources: {
      carto: {
        type: "raster",
        tiles: tileUrls(style),
        tileSize: 256,
        maxzoom: 19,
        attribution: "© OpenStreetMap contributors © CARTO",
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": style === "dark" ? "#0b111e" : "#e9edf2" } },
      { id: "carto", type: "raster", source: "carto", paint: { "raster-opacity": style === "dark" ? 0.95 : 0.9 } },
    ],
  };
}

// Blue → violet → orange, by share of the busiest zone at this hour.
function heat(t: number, alpha = 1) {
  const stops = [
    [76, 155, 255],
    [167, 139, 250],
    [255, 122, 69],
  ];
  const x = Math.min(Math.max(t, 0), 1) * (stops.length - 1);
  const i = Math.min(Math.floor(x), stops.length - 2);
  const f = x - i;
  const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

// Where each zone's name tag sits relative to its bubble, so the crowded old-town cluster stays readable.
const LABEL_SIDE: Record<string, "top" | "bottom" | "left" | "right"> = {
  Piassa: "top", "Arat Kilo": "right", Merkato: "left", Lideta: "left", Kazanchis: "bottom", Sarbet: "bottom",
};
const SIDE_CLASS = {
  top: "bottom-full left-1/2 mb-1.5 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-1.5 -translate-x-1/2",
  left: "right-full top-1/2 mr-1.5 -translate-y-1/2",
  right: "left-full top-1/2 ml-1.5 -translate-y-1/2",
};

type Props = {
  zones: Zone[];
  city: CityZone[] | null;
  hour: number;
  selected: string;
  onSelect: (zone: string) => void;
};

export default function ZoneMap({ zones, city, hour, selected, onSelect }: Props) {
  const byZone = useMemo(() => Object.fromEntries((city ?? []).map((c) => [c.zone, c])), [city]);
  const [mapStyle, setMapStyle] = useState<MapStyle>("dark");
  const style = useMemo(() => cartoStyle(mapStyle), [mapStyle]);
  const narrow = typeof window !== "undefined" && window.innerWidth < 640;
  const max = useMemo(() => Math.max(1, ...(city ?? []).map((c) => c.hourly[hour] ?? 0)), [city, hour]);

  return (
    <Map
      initialViewState={{ bounds: [[38.69, 8.988], [38.89, 9.043]], fitBoundsOptions: { padding: narrow ? { top: 100, bottom: 110, left: 12, right: 12 } : { top: 110, bottom: 120, left: 50, right: 50 } } }}
      mapStyle={style}
      style={{ width: "100%", height: "100%" }}
      attributionControl={{ compact: true }}
      dragRotate={false}
      maxZoom={15}
      minZoom={10}
    >
      <NavigationControl position="top-right" showCompass={false} />
      <div className="absolute right-12 top-2.5 z-10 flex gap-1 rounded-xl bg-ink-950/80 p-1 text-[11px] font-semibold backdrop-blur ring-1 ring-white/10">
        {MAP_STYLES.map((m) => (
          <button key={m.id} onClick={() => setMapStyle(m.id)} aria-pressed={mapStyle === m.id}
                  className={`rounded-lg px-2.5 py-1 transition ${mapStyle === m.id ? "bg-accent text-white" : "text-slate-300 hover:bg-white/10"}`}>
            {m.label}
          </button>
        ))}
      </div>
      {zones.map((z) => {
        const c = byZone[z.zone];
        const v = c?.hourly[hour] ?? 0;
        const t = v / max;
        const size = (narrow ? 10 : 14) + (narrow ? 22 : 34) * Math.sqrt(t);
        const isSel = z.zone === selected;
        return (
          <Marker key={z.zone} longitude={z.lon} latitude={z.lat} anchor="center"
                  style={{ zIndex: isSel ? 20 : Math.round(10 * t) }}
                  onClick={(e) => { e.originalEvent.stopPropagation(); onSelect(z.zone); }}>
            <button
              aria-label={`${z.zone}: ${fmt.int(v)} trips at ${fmt.hour(hour)}`}
              className="group relative block focus:outline-none"
              style={{ cursor: "pointer" }}
            >
              <span
                className={`relative block rounded-full transition-all duration-500 ease-out ${isSel ? "pulse" : ""}`}
                style={{
                  width: size, height: size,
                  background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,.55), ${heat(t)} 45%, ${heat(t, 0.8)} 100%)`,
                  boxShadow: isSel
                    ? `0 0 0 3px #fff, 0 0 30px 6px ${heat(t)}`
                    : `0 0 22px 2px ${heat(t, 0.55)}, inset 0 0 0 1px rgba(255,255,255,.25)`,
                  opacity: c ? 0.95 : 0.4,
                }}
              />
              <span
                className={`absolute ${SIDE_CLASS[LABEL_SIDE[z.zone] ?? "bottom"]} whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold backdrop-blur
                  ${isSel ? "bg-white text-ink-950" : `bg-ink-950/75 text-slate-200 group-hover:bg-ink-800 ${narrow ? "hidden group-hover:block" : ""}`}`}
              >
                {z.zone}
                <span className={`ml-1 font-bold ${isSel ? "text-accent" : "text-slate-400"}`}>{c ? fmt.int(v) : "–"}</span>
                {c?.has_event && <span className="ml-1">⚡</span>}
              </span>
            </button>
          </Marker>
        );
      })}
    </Map>
  );
}
