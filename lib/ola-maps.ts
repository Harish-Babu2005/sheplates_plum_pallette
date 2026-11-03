// Ola Maps, server side. Credentials never reach the browser except as a short-lived access token.
//   OLA_MAPS_API_KEY        key for the Places and Geocoding calls made from our server
//   OLA_MAPS_CLIENT_ID /
//   OLA_MAPS_CLIENT_SECRET  OAuth credentials: exchanged for a short-lived token the map uses for tiles
//   NEXT_PUBLIC_OLA_MAPS_API_KEY  optional: a domain-restricted key the browser may use directly instead of a token
//   OLA_API_BASE, OLA_TOKEN_URL   overrides (used by the local test server)
const API_BASE = () => (process.env.OLA_API_BASE || "https://api.olamaps.io").replace(/\/$/, "");
const TOKEN_URL = () => process.env.OLA_TOKEN_URL || "https://account.olamaps.io/realms/olamaps/protocol/openid-connect/token";

export const olaConfigured = () => Boolean(process.env.OLA_MAPS_API_KEY || (process.env.OLA_MAPS_CLIENT_ID && process.env.OLA_MAPS_CLIENT_SECRET) || process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY);
export const olaApiBase = API_BASE;

function secondsLeft(jwt: string): number {
  try {
    const part = jwt.split(".")[1]; const claims = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=")));
    const left = Number(claims.exp) - Math.floor(Date.now() / 1000);
    if (Number.isFinite(left) && left > 0) return left;
  } catch { /* not a readable token */ }
  return 300; // unknown: refresh early
}

let cached: { token: string; expiresAt: number } | null = null;
let inflight: Promise<{ token: string; expiresIn: number }> | null = null;

/** A short-lived OAuth token (client credentials). Cached until shortly before it expires. */
export async function olaAccessToken(): Promise<{ token: string; expiresIn: number }> {
  const id = process.env.OLA_MAPS_CLIENT_ID, secret = process.env.OLA_MAPS_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Ola Maps OAuth credentials are not set");
  const now = Date.now();
  if (cached && cached.expiresAt - 60_000 > now) return { token: cached.token, expiresIn: Math.floor((cached.expiresAt - now) / 1000) };
  inflight ||= (async () => {
    const res = await fetch(TOKEN_URL(), {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }), signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Ola Maps sign-in failed (${res.status})`);
    const json = await res.json() as { access_token?: string; expires_in?: number };
    if (!json.access_token) throw new Error("Ola Maps sign-in returned no token");
    // Ola's reply carries only the token; its lifetime is the "exp" claim inside it (about an hour)
    const expiresIn = Number(json.expires_in) > 0 ? Number(json.expires_in) : secondsLeft(json.access_token);
    cached = { token: json.access_token, expiresAt: Date.now() + expiresIn * 1000 };
    return { token: json.access_token, expiresIn };
  })().finally(() => { inflight = null; });
  return inflight;
}

/** One Ola Maps call from the server: the API key when we have one, otherwise the OAuth token. */
export async function olaGet(path: string, params: Record<string, string>, timeoutMs = 6000): Promise<unknown> {
  const url = new URL(`${API_BASE()}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers: Record<string, string> = { Accept: "application/json" };
  const key = process.env.OLA_MAPS_API_KEY;
  if (key) url.searchParams.set("api_key", key);
  else headers.Authorization = `Bearer ${(await olaAccessToken()).token}`;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`Ola Maps returned ${res.status}`);
  return res.json();
}

export type OlaPlace = { address: string; latitude: number; longitude: number };
type Loose = Record<string, unknown>;
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
function coordsOf(item: Loose): { lat: number; lng: number } | null {
  const geometry = (item.geometry || item) as Loose; const loc = (geometry.location || geometry) as Loose;
  const lat = num(loc.lat ?? loc.latitude), lng = num(loc.lng ?? loc.lon ?? loc.longitude);
  return lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
function toPlace(item: Loose): OlaPlace | null {
  const c = coordsOf(item); const address = String(item.formatted_address || item.description || item.name || "").trim();
  return c && address ? { address, latitude: c.lat, longitude: c.lng } : null;
}

/** Address suggestions as you type. Ola returns the position with each suggestion; when it does not, we ask for the place details. */
export async function olaAutocomplete(input: string, near?: { lat: number; lng: number }): Promise<OlaPlace[]> {
  const params: Record<string, string> = { input };
  if (near) { params.location = `${near.lat},${near.lng}`; }
  const raw = await olaGet("/places/v1/autocomplete", params) as Loose;
  const predictions = (Array.isArray(raw.predictions) ? raw.predictions : []) as Loose[];
  const out: OlaPlace[] = [];
  for (const p of predictions.slice(0, 5)) {
    const direct = toPlace(p);
    if (direct) { out.push(direct); continue; }
    const id = String(p.place_id || ""); const description = String(p.description || "").trim();
    if (!id || !description) continue;
    try {
      const det = await olaGet("/places/v1/details", { place_id: id }, 4000) as Loose;
      const c = coordsOf((det.result || det) as Loose);
      if (c) out.push({ address: description, latitude: c.lat, longitude: c.lng });
    } catch { /* skip this suggestion */ }
  }
  return out;
}
/** Share of the typed words (3+ letters) that appear in a result: Ola's geocoder can return a far-away place with a similar name. */
function wordMatch(typed: string, found: string): number {
  const words = typed.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  if (!words.length) return 1;
  const hay = found.toLowerCase();
  return words.filter((w) => hay.includes(w)).length / words.length;
}
export async function olaGeocode(address: string, near?: { lat: number; lng: number }): Promise<OlaPlace | null> {
  const raw = await olaGet("/places/v1/geocode", { address }) as Loose;
  const list = (Array.isArray(raw.geocodingResults) ? raw.geocodingResults : Array.isArray(raw.results) ? raw.results : []) as Loose[];
  for (const item of list) { const p = toPlace(item); if (p && wordMatch(address, p.address) >= 0.6) return p; }
  // nothing in the geocoder matched what was typed: the best address suggestion is a safer answer than a far-away namesake
  const suggestions = await olaAutocomplete(address, near);
  return suggestions.find((p) => wordMatch(address, p.address) >= 0.6) || suggestions[0] || null;
}
export async function olaReverseGeocode(lat: number, lng: number): Promise<OlaPlace | null> {
  const raw = await olaGet("/places/v1/reverse-geocode", { latlng: `${lat},${lng}` }) as Loose;
  const list = (Array.isArray(raw.results) ? raw.results : Array.isArray(raw.geocodingResults) ? raw.geocodingResults : []) as Loose[];
  const first = list.find((item) => String(item.formatted_address || "").trim());
  if (!first) return null;
  return { address: String(first.formatted_address).trim(), latitude: lat, longitude: lng };
}
