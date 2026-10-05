// Server-only helpers for the Vercel deployment. The JSON files in data/ are the FastAPI app's own responses
// for every possible request (written by `python app/export_static_api.py`), so these handlers return exactly
// what app/app.py would.
import meta from "@/data/meta.json";
import city from "@/data/city.json";
import forecasts from "@/data/forecasts.json";

export const META = meta as { dates: string[]; zones: { zone: string }[]; first_day: string; last_day: string } & Record<string, unknown>;
export const CITY = city as Record<string, unknown>;
export const FORECASTS = forecasts as Record<string, unknown>;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function json(body: unknown, status = 200, cache = "public, max-age=300, s-maxage=86400") {
  return Response.json(body, { status, headers: { "Cache-Control": cache } });
}

// Same rules and messages as parse_day() / parse_zone() in app/app.py.
export function parseDay(raw: string | null): { day: string } | { error: string } {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec((raw ?? "").trim());
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  if (!m || !d || d.getUTCMonth() !== +m[2] - 1) {
    return { error: `“${raw ?? ""}” is not a date we can read. Use YYYY-MM-DD, e.g. 2025-11-05.` };
  }
  const day = d.toISOString().slice(0, 10);
  if (day < META.first_day || day > META.last_day) {
    const label = `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    return { error: `We only forecast 1–14 November 2025, so ${label} isn't available. Please pick a day in that fortnight.` };
  }
  return { day };
}

export function parseZone(raw: string | null): { zone: string } | { error: string } {
  const zone = META.zones.find((z) => z.zone.toLowerCase() === (raw ?? "").trim().toLowerCase());
  return zone ? { zone: zone.zone } : { error: `“${raw ?? ""}” isn't one of our 12 zones.` };
}
