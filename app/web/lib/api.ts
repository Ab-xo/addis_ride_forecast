// Typed client for the forecast API. Where the API lives:
// • NEXT_PUBLIC_API_BASE, if set (e.g. a separately hosted FastAPI server);
// • otherwise the same origin: FastAPI serving the static build (python app/app.py), or the Next.js route
//   handlers in a Vercel / `next start` build;
// • under `npm run dev` of the static build (port 3000), the FastAPI server on port 8000.
export const BASE =
  process.env.NEXT_PUBLIC_API_BASE ??
  (!process.env.NEXT_PUBLIC_SERVER_MODE && typeof window !== "undefined" && window.location.port === "3000"
    ? "http://localhost:8000"
    : "");

export type Zone = { zone: string; type: string; type_label: string; lat: number; lon: number; fare: number };
export type Basemap = { tiles: string; styles: string[]; default: string; attribution: string };
export type Meta = {
  basemap: Basemap;
  team: string;
  model: { name: string; n_features: number; trained_on: string; rmse: number; mae: number; rolling_rmse: number; rolling_rmse_sd: number; n_train: number; baseline_rmse: number };
  trips_per_driver_hour: number;
  first_day: string;
  last_day: string;
  dates: string[];
  zones: Zone[];
};
export type CityZone = {
  zone: string; hourly: number[]; total: number; usual_total: number; peak_hour: number; peak: number;
  has_event: boolean; rain_mm: number;
};
export type City = { date: string; weekday: string; zones: CityZone[] };
export type Hour = {
  hour: number; time: string; forecast: number; lower_80: number; upper_80: number; typical: number;
  drivers: number; drivers_safe: number; fares: number; temp_c: number; rain_mm: number; event: boolean;
};
export type Chip = { kind: "weather" | "rain" | "event" | "none"; icon: string; text: string };
export type EventWindow = { label: string; icon: string; start_hour: number; end_hour: number; venue: string | null };
export type Forecast = {
  zone: string; zone_type: string; date: string; weekday: string; fare: number;
  hours: Hour[]; events: EventWindow[];
  lookup: { chips: Chip[]; summary: string };
  kpis: {
    total: number; usual_total: number; vs_usual_pct: number; peak_hour: string; peak_trips: number;
    peak_range: [number, number]; peak_drivers: number; driver_hours: number; gross_fares: number;
  };
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { detail?: string }).detail ?? `Request failed (${res.status})`);
  return body as T;
}

export const api = {
  meta: () => get<Meta>("/api/meta"),
  city: (date: string) => get<City>(`/api/city?date=${encodeURIComponent(date)}`),
  forecast: (zone: string, date: string) =>
    get<Forecast>(`/api/forecast?zone=${encodeURIComponent(zone)}&date=${encodeURIComponent(date)}`),
};

export const fmt = {
  int: (n: number) => Math.round(n).toLocaleString("en-US"),
  one: (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 }),
  birr: (n: number) => (n >= 1000 ? `${(n / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k` : `${Math.round(n)}`),
  hour: (h: number) => `${String(h).padStart(2, "0")}:00`,
  day: (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    return {
      dow: d.toLocaleDateString("en-GB", { weekday: "short" }),
      num: d.toLocaleDateString("en-GB", { day: "2-digit" }),
      long: d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      weekend: d.getDay() === 0 || d.getDay() === 6,
    };
  },
};
