// CARTO raster tile proxy (same contract as /api/basemap in app/app.py). The optional CARTO_API_KEY is read
// from the server environment (Vercel → Project Settings → Environment Variables), never sent to the browser.
const STYLES: Record<string, string> = { dark: "dark_all", light: "light_all", voyager: "rastertiles/voyager" };
// 1x1 transparent PNG, returned when CARTO cannot be reached so the map never errors.
const EMPTY = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABpfZFQAAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

export const dynamic = "force-dynamic";

type Params = { style: string; z: string; x: string; y: string };

export async function GET(_req: Request, { params }: { params: Promise<Params> }) {
  const { style, z: zs, x: xs, y: ys } = await params;
  const z = Number(zs), x = Number(xs), y = Number(ys.replace(/\.png$/, ""));
  if (!(style in STYLES)) {
    return Response.json({ detail: `Unknown basemap style '${style}'. Use one of: ${Object.keys(STYLES).join(", ")}.` }, { status: 404 });
  }
  if (![z, x, y].every(Number.isInteger) || z < 0 || z > 20 || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) {
    return Response.json({ detail: "Tile out of range." }, { status: 404 });
  }
  const key = process.env.CARTO_API_KEY?.trim();
  const url = `https://${"abcd"[(x + y) % 4]}.basemaps.cartocdn.com/${STYLES[style]}/${z}/${x}/${y}@2x.png`;
  // Try with the key first; if CARTO rejects the key, the public basemap still serves the tile without it.
  const urls = key ? [`${url}?api_key=${encodeURIComponent(key)}`, url] : [url];
  try {
    for (const u of urls) {
      const r = await fetch(u, { headers: { "User-Agent": "addis-ride-demand/1.0" }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      return new Response(await r.arrayBuffer(), {
        headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400, s-maxage=604800" },
      });
    }
    throw new Error("CARTO unavailable");
  } catch {
    return new Response(EMPTY, { headers: { "Content-Type": "image/png", "Cache-Control": "no-store", "X-Basemap": "offline" } });
  }
}
