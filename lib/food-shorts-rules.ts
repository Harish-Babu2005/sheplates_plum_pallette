// Food Shorts — the rules, as pure functions with no imports so Node can test them
// directly (tests/food-shorts-rules.test.mjs). The database applies the same rules
// in nearby_food_shorts() (supabase/V8_4_FOOD_SHORTS.sql); this module mirrors them
// for local/demo mode and for the customer's own distance chips.

export const MAX_SHORT_SECONDS = 30;
export const MAX_SHORT_BYTES = 30 * 1024 * 1024;
export const MAX_SHORTS_PER_DAY = 10;
export const REACH_OPTIONS_KM = [1, 2, 3, 5, 10, 15, 20, 30] as const;
export const VIEW_RADIUS_OPTIONS_KM = [1, 3, 5, 10, 20, 30] as const;
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;

export type ShortStatus = "active" | "hidden" | "removed";

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (v: number) => (v * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A short is visible when it is live and the viewer is inside BOTH the vendor's
 * reach and the radius the viewer asked for. A viewer with no pin sees nothing. */
export function shortVisibleAtDistance(
  short: { reachKm: number; status: ShortStatus },
  distanceKm: number | null | undefined,
  viewerRadiusKm: number,
): boolean {
  if (short.status !== "active") return false;
  if (distanceKm == null || !Number.isFinite(distanceKm)) return false;
  return distanceKm <= Math.min(short.reachKm, viewerRadiusKm);
}

/** Nearest allowed reach option at or below a store's service radius (never zero). */
export function defaultReachKm(serviceRadiusKm: number | null | undefined): number {
  const radius = Number.isFinite(serviceRadiusKm) && (serviceRadiusKm as number) > 0 ? (serviceRadiusKm as number) : 5;
  const options = [...REACH_OPTIONS_KM].filter((km) => km <= radius);
  return options.length ? options[options.length - 1] : REACH_OPTIONS_KM[0];
}

export type VideoCheck = { ok: true } | { ok: false; message: string };

export function checkVideoFile(file: { type: string; size: number }): VideoCheck {
  if (!(ALLOWED_VIDEO_TYPES as readonly string[]).includes(file.type)) return { ok: false, message: "Use an MP4, MOV or WebM video" };
  if (file.size > MAX_SHORT_BYTES) return { ok: false, message: `That video is ${(file.size / 1048576).toFixed(0)} MB. The limit is ${MAX_SHORT_BYTES / 1048576} MB` };
  if (file.size <= 0) return { ok: false, message: "That video file is empty" };
  return { ok: true };
}

export function checkVideoDuration(seconds: number): VideoCheck {
  if (!Number.isFinite(seconds) || seconds <= 0) return { ok: false, message: "We could not read the length of that video" };
  if (seconds > MAX_SHORT_SECONDS) return { ok: false, message: `That video is ${Math.ceil(seconds)} seconds. A Food Short can be at most ${MAX_SHORT_SECONDS} seconds` };
  return { ok: true };
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function formatDistanceKm(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km)) return "";
  return km < 1 ? `${Math.max(100, Math.round(km * 10) * 100)} m` : `${km.toFixed(1)} km`;
}
