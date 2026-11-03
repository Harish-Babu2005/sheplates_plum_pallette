// People and Statuses — the rules, as pure functions with no imports so Node can test them directly
// (tests/people-rules.test.mjs). The database applies the same rules in supabase/V9_3_PEOPLE_STATUS.sql;
// this mirrors them for demo mode, for what the screen shows, and for the privacy promises we make.

export const STATUS_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_ACTIVE_STATUSES = 10;
export const MAX_STATUS_SECONDS = 30;
export const MAP_GRID_DEGREES = 0.005;                       // about 550 m: the finest position ever stored for a person
export const PEOPLE_RADIUS_OPTIONS_KM = [1, 3, 5, 10, 20, 30] as const;
export const MAX_FOLLOWING = 1000;

export type Pin = { lat: number; lng: number };

export function distanceKm(a: Pin, b: Pin): number {
  const rad = (v: number) => (v * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The only position stored for a person who is on the map: snapped to a ~550 m grid, never the exact pin. */
export function coarsen(value: number): number { return Math.round(Math.round(value / MAP_GRID_DEGREES) * MAP_GRID_DEGREES * 1e6) / 1e6; }
export function coarsePin(pin: Pin): Pin { return { lat: coarsen(pin.lat), lng: coarsen(pin.lng) }; }

/** Distances shown for people are rounded to the nearest half kilometre. */
export function halfKm(km: number): number { return Math.round(km * 2) / 2; }
export function formatPeopleDistance(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km)) return "";
  const r = halfKm(km);
  return r <= 0 ? "Under 0.5 km" : `${r} km`;
}

/** "@Priya_Eats " -> "priya_eats". A search needs at least two characters. */
export function normaliseHandleQuery(raw: string | null | undefined): string { return String(raw ?? "").trim().replace(/^@+/, "").toLowerCase(); }
export const searchReady = (raw: string | null | undefined) => normaliseHandleQuery(raw).length >= 2;
export const handleMatches = (handle: string, raw: string | null | undefined) => { const q = normaliseHandleQuery(raw); return q.length === 0 || handle.toLowerCase().startsWith(q); };
export const handleLooksValid = (handle: string) => /^[a-z0-9_]{3,24}$/.test(handle);

// ---------- statuses ----------

export type StatusLike = { expiresAt: string; createdAt?: string };
export function statusExpiry(createdAt: number): string { return new Date(createdAt + STATUS_TTL_MS).toISOString(); }
export function isStatusActive(s: StatusLike, now: number = Date.now()): boolean { return new Date(s.expiresAt).getTime() > now; }

/** "23h left", "45 min left", "Expired": coarse on purpose, like a story. */
export function statusTimeLeft(expiresAt: string, now: number = Date.now()): string {
  const ms = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return "Expired";
  const minutes = Math.floor(ms / 60_000), hours = Math.floor(minutes / 60);
  return hours >= 1 ? `${hours}h left` : `${Math.max(1, minutes)} min left`;
}

export type StatusAudience = {
  authorId: string; viewerId: string; expiresAt: string;
  viewerFollowsAuthor: boolean; authorDiscoverable: boolean; authorPrivateAccount?: boolean; authorPin?: Pin | null; viewerPin?: Pin | null; radiusKm: number; alreadyViewed: boolean;
};
/** Who may watch a status: not the author, not expired, not seen before, and either follows the author or is
 * within the radius of an author who chose to be on the map. */
export function statusVisibleTo(a: StatusAudience, now: number = Date.now()): boolean {
  if (a.authorId === a.viewerId) return false;
  if (new Date(a.expiresAt).getTime() <= now) return false;
  if (a.alreadyViewed) return false;
  if (a.viewerFollowsAuthor) return true;
  if (a.authorPrivateAccount) return false;
  if (!a.authorDiscoverable || !a.authorPin || !a.viewerPin) return false;
  return distanceKm(a.viewerPin, a.authorPin) <= Math.min(a.radiusKm, 30);
}

/** Whether a person is shown on the map at all. */
export function personOnMap(p: { discoverable: boolean; pin?: Pin | null }, viewerPin: Pin | null | undefined, radiusKm: number): boolean {
  return Boolean(p.discoverable && p.pin && viewerPin && distanceKm(viewerPin, p.pin) <= Math.min(radiusKm, 30));
}

/** Rail order: people you follow first, then people nearby; within a group the newest author first, and within an
 * author the oldest status first, like stories. */
export function groupStatuses<T extends { authorId: string; createdAt: string; source?: "following" | "nearby" }>(items: T[]): { authorId: string; source: "following" | "nearby"; items: T[] }[] {
  const byAuthor = new Map<string, T[]>();
  for (const it of items) byAuthor.set(it.authorId, [...(byAuthor.get(it.authorId) || []), it]);
  return [...byAuthor.entries()]
    .map(([authorId, list]) => {
      const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return { authorId, source: (sorted.some((i) => i.source === "following") ? "following" : "nearby") as "following" | "nearby", items: sorted, latest: sorted[sorted.length - 1].createdAt };
    })
    .sort((a, b) => (a.source === b.source ? b.latest.localeCompare(a.latest) : a.source === "following" ? -1 : 1))
    .map(({ authorId, source, items: list }) => ({ authorId, source, items: list }));
}

export function checkStatusVideoSeconds(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return "We could not read the length of that video";
  if (seconds > MAX_STATUS_SECONDS) return `That video is ${Math.ceil(seconds)} seconds. A status can be at most ${MAX_STATUS_SECONDS} seconds`;
  return null;
}
