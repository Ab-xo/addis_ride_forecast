import { FORECASTS, json, parseDay, parseZone } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const z = parseZone(q.get("zone"));
  if ("error" in z) return json({ detail: z.error }, 422, "no-store");
  const d = parseDay(q.get("date"));
  if ("error" in d) return json({ detail: d.error }, 422, "no-store");
  return json(FORECASTS[`${z.zone}|${d.day}`]);
}
