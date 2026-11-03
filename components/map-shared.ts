// Shared by both map engines (Ola Maps / MapLibre and the standard Leaflet map): the data types, distance helpers
// and the exact markup of every pin, so the two maps look the same.
export type MapVendor = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distanceKm: number;
  verified?: boolean;
  productCount?: number;
  emoji?: string;
  photoUrl?: string;
  kind?: "vendor" | "trial";
  /** Food Shorts from this vendor that the customer may watch (shown as a play badge on the pin). */
  shortCount?: number;
};

/** A customer who chose to be on the map. The position is already coarse (about 550 m) when it arrives. */
export type MapPerson = { id: string; handle: string; lat: number; lng: number; distanceKm: number; following?: boolean; hasStatus?: boolean };

/** Due-north offset approximation — good enough at city scale (matches the
 * precision the app already uses elsewhere for its own haversine helper). */
export function pointAtDistanceNorth(lat: number, lng: number, km: number) {
  return { lat: lat + km / 111.32, lng };
}
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const rad = (v: number) => (v * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Zoom that fits a search circle of the given radius in a typical map viewport. */
export function zoomForRadius(radiusKm: number) {
  return radiusKm <= 1 ? 15 : radiusKm <= 2 ? 14 : radiusKm <= 5 ? 13 : radiusKm <= 10 ? 12 : radiusKm <= 20 ? 11 : 10;
}

/** Vendors that share (almost) the same pin would hide each other. Fan them out on a tiny
 * ring (about 30 m) around the shared point so every pin stays visible and tappable. */
export function spreadOverlaps<T extends { id: string; lat: number; lng: number }>(vendors: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const v of vendors) { const key = `${v.lat.toFixed(4)},${v.lng.toFixed(4)}`; groups.set(key, [...(groups.get(key) || []), v]); }
  return vendors.map((v) => {
    const group = groups.get(`${v.lat.toFixed(4)},${v.lng.toFixed(4)}`) || [v];
    if (group.length < 2) return v;
    const index = group.findIndex((g) => g.id === v.id);
    const angle = (2 * Math.PI * index) / group.length;
    const dLat = (0.03 / 111.32) * Math.sin(angle);
    const dLng = (0.03 / (111.32 * Math.max(0.2, Math.cos((v.lat * Math.PI) / 180)))) * Math.cos(angle);
    return { ...v, lat: v.lat + dLat, lng: v.lng + dLng };
  });
}

export const YOU_HTML = `<span class="sp-map-you"><span class="sp-map-you-pulse"></span><span class="sp-map-you-dot"></span></span>`;
export const HANDLE_HTML = `<span class="sp-map-handle" title="Drag to change your search radius"></span>`;
export function vendorPinHtml(closest: boolean, inRange: boolean, index: number) {
  return { html: `<span class="sp-map-vendor ${closest ? "sp-map-vendor-closest" : ""} ${inRange ? "" : "sp-map-vendor-dim"}" style="--sp-marker-delay:${Math.min(index, 8) * 45}ms">${closest ? '<span class="sp-map-vendor-ring"></span>' : ""}<span class="sp-map-vendor-pin">🏪</span></span>`, size: closest ? 36 : 30 };
}
/** Round "photo" pin used by the Maps tab: the vendor's photo (or a category
 * emoji on a soft tint when they have none), a white ring, and a crimson dot
 * for food-trial pins. Pure inline styles so Leaflet's divIcon needs no CSS file. */
export function photoPinHtml(vendor: MapVendor, selected: boolean, zoom = 13) {
  // pins shrink when zoomed out so a dense neighbourhood stays readable, and grow back as you zoom in
  const base = zoom >= 14 ? 52 : zoom >= 12 ? 42 : zoom >= 11 ? 36 : 30;
  const size = selected ? base + 10 : base;
  const fill = vendor.photoUrl ? `background:url('${vendor.photoUrl.replace(/'/g, "%27")}') center/cover` : "background:linear-gradient(135deg,#fff1f5,#ffd9e4)";
  const inner = vendor.photoUrl ? "" : `<span style="font-size:${Math.round(size * 0.46)}px;line-height:1">${vendor.emoji || "🍽️"}</span>`;
  const shortsBadge = vendor.shortCount ? `<span style="position:absolute;right:-6px;bottom:-4px;min-width:22px;height:20px;padding:0 5px;border-radius:9999px;background:#753b50;color:#fff;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;gap:2px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.25)">&#9654;${vendor.shortCount > 1 ? vendor.shortCount : ""}</span>` : "";
  const badge = vendor.kind === "trial" ? `<span style="position:absolute;right:-2px;top:-2px;width:18px;height:18px;border-radius:9999px;background:#753b50;color:#fff;font-size:10px;display:grid;place-items:center;border:2px solid #fff">🍴</span>` : "";
  return { html: `<span class="sp-map-photo-pin" style="position:relative;display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:9999px;border:3px solid ${selected ? "#753b50" : "#fff"};box-shadow:0 6px 18px rgba(30,10,18,.28);${fill};transition:all .15s" data-shorts="${vendor.shortCount || 0}">${inner}${badge}${shortsBadge}</span>`, size: size };
}
/** A person's pin: a round avatar with their initial. Crimson ring when you follow them, a dot when they have a status. */
export function personPinHtml(person: MapPerson, selected: boolean) {
  const size = selected ? 46 : 38;
  const ring = selected ? "#753b50" : person.following ? "#753b50" : "#a8a29e";
  const dot = person.hasStatus ? `<span style="position:absolute;right:-2px;top:-2px;width:14px;height:14px;border-radius:9999px;background:#22c55e;border:2px solid #fff"></span>` : "";
  const initial = (person.handle[0] || "?").toUpperCase().replace(/[<>&"']/g, "");
  return { html: `<span class="sp-map-person-pin" data-person="${person.id.replace(/[^a-zA-Z0-9_.@-]/g, "")}" style="position:relative;display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:9999px;border:3px solid ${ring};background:linear-gradient(135deg,#fff1f5,#ffd0de);color:#c4123f;font:900 ${Math.round(size * 0.42)}px/1 system-ui;box-shadow:0 6px 18px rgba(30,10,18,.28)">${initial}${dot}</span>`, size: size };
}
