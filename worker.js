const RANGES = { "6h": 6, "24h": 24, "7d": 168 };
const reply = (body, status, origin) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": origin, vary: "Origin" } });
const point = item => Number.isFinite(Number(item?.value)) && item?.created_at && !Number.isNaN(Date.parse(item.created_at)) ? { value: Number(item.value), timestamp: new Date(item.created_at).toISOString() } : null;
async function feed(env, key, limit) {
  if (!key) return [];
  const url = `https://io.adafruit.com/api/v2/${encodeURIComponent(env.ADAFRUIT_IO_USERNAME)}/feeds/${encodeURIComponent(key)}/data?limit=${limit}`;
  const response = await fetch(url, { headers: { "X-AIO-Key": env.ADAFRUIT_IO_KEY, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (response.status === 404) return [];
  if (!response.ok) throw Error("upstream failure");
  const body = await response.json();
  if (!Array.isArray(body)) throw Error("invalid upstream response");
  return body.map(point).filter(Boolean).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}
export default { async fetch(request, env) {
  const url = new URL(request.url), origin = request.headers.get("Origin") || env.ALLOWED_ORIGIN || "";
  const allowed = !request.headers.get("Origin") || origin.replace(/\/$/, "") === (env.ALLOWED_ORIGIN || "").replace(/\/$/, "");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": origin, "access-control-allow-methods": "GET, OPTIONS", vary: "Origin" } });
  if (!allowed) return reply({ error: { message: "This origin is not allowed." } }, 403, origin);
  if (request.method !== "GET") return reply({ error: { message: "Only GET is supported." } }, 405, origin);
  if (url.pathname === "/api/health") return reply({ status: "ok", service: "osw-weather-api" }, 200, origin);
  if (!["/api/weather", "/api/history"].includes(url.pathname)) return reply({ error: { message: "Endpoint not found." } }, 404, origin);
  const range = url.searchParams.get("range") || "24h";
  if (!RANGES[range]) return reply({ error: { message: "range must be 6h, 24h, or 7d." } }, 400, origin);
  if (!env.ADAFRUIT_IO_USERNAME || !env.ADAFRUIT_IO_KEY) return reply({ error: { message: "Worker credentials are not configured." } }, 500, origin);
  const pressureInstalled = env.PRESSURE_SENSOR_INSTALLED === "true", limit = range === "7d" ? 1000 : 500;
  const results = await Promise.allSettled([feed(env, env.TEMPERATURE_FEED_KEY, limit), feed(env, env.HUMIDITY_FEED_KEY, limit), pressureInstalled ? feed(env, env.PRESSURE_FEED_KEY, limit) : Promise.resolve([])]);
  const values = i => results[i].status === "fulfilled" ? results[i].value : [];
  const cutoff = Date.now() - RANGES[range] * 3600000, filtered = i => values(i).filter(x => Date.parse(x.timestamp) >= cutoff).reverse();
  if (url.pathname === "/api/history") return reply({ range, retrievedAt: new Date().toISOString(), temperature: filtered(0), humidity: filtered(1), pressure: pressureInstalled ? filtered(2) : [], partial: results.some(x => x.status === "rejected") }, 200, origin);
  const latest = (i, unit, installed = true) => !installed ? { value: null, unit, status: "sensor_not_installed", timestamp: null } : results[i].status !== "fulfilled" ? { value: null, unit, status: "unavailable", timestamp: null } : !values(i)[0] ? { value: null, unit, status: "no_data", timestamp: null } : { ...values(i)[0], unit, status: Date.now() - Date.parse(values(i)[0].timestamp) > 7200000 ? "stale" : "valid" };
  const successful = results[0].status === "fulfilled" || results[1].status === "fulfilled";
  return reply({ temperature: latest(0, "°C"), humidity: latest(1, "%"), pressure: latest(2, "hPa", pressureInstalled), partial: results.some(x => x.status === "rejected") }, successful ? 200 : 502, origin);
} };
