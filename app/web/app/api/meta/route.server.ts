import { META, json } from "@/lib/server-data";

export function GET() {
  return json(META);
}
