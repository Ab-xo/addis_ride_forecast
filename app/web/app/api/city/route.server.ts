import { CITY, json, parseDay } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const d = parseDay(new URL(req.url).searchParams.get("date"));
  if ("error" in d) return json({ detail: d.error }, 422, "no-store");
  return json(CITY[d.day]);
}
