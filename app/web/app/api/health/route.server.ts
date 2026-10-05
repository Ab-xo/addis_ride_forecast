import { META, json } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export function GET() {
  return json({
    status: "ok", model: "LightGBM (Poisson)", source: "pre-computed by app/app.py",
    rows_scored: META.dates.length * META.zones.length * 24, zones: META.zones.length,
    first_day: META.first_day, last_day: META.last_day,
    basemap: { provider: "CARTO", api_key_configured: Boolean(process.env.CARTO_API_KEY) },
  }, 200, "no-store");
}
