"use client";
// The ShePlates map on Ola Maps (MapLibre). Same props, same pins and the same controls as the standard map.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin, ShoppingBag } from "@/components/icons";
import { HANDLE_HTML, YOU_HTML, haversineKm, personPinHtml, photoPinHtml, pointAtDistanceNorth, spreadOverlaps, vendorPinHtml, zoomForRadius, type MapPerson, type MapVendor } from "./map-shared";
import { olaAuthNow, type OlaAccess } from "@/lib/ola-client";

// MapLibre zoom levels are one lower than the tile-zoom numbers the pin sizes and radius presets were written for.
const toGl = (z: number) => z - 1;
const toTile = (z: number) => z + 1;

function circle(lat: number, lng: number, km: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  const dLat = km / 111.32, dLng = km / (111.32 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  for (let i = 0; i <= 96; i++) { const a = (i / 96) * 2 * Math.PI; coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]); }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [coords] } };
}
function iconEl(html: string, size: number, label?: string) {
  const d = document.createElement("div");
  d.className = "sp-map-icon"; d.style.width = `${size}px`; d.style.height = `${size}px`; d.innerHTML = html;
  if (label) { d.title = label; d.setAttribute("aria-label", label); }
  return d;
}

/** ShePlates look on top of Ola's "default light" style: warm background, soft water and greens, and none of Ola's
 * own shop and brand markers, so our vendor pins are the only ones on the map. Layers are matched by the ids
 * this style uses; anything that is not found is left as Ola draws it. */
function brand(map: maplibregl.Map) {
  const paint = (id: string, prop: string, value: string) => { try { if (map.getLayer(id)) map.setPaintProperty(id, prop, value); } catch { /* keep Ola's colour */ } };
  const hide = (id: string) => { try { if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none"); } catch { /* keep it */ } };
  try {
    paint("background", "background-color", "#f8f3f1");
    paint("water", "fill-color", "#cfe2ea");
    for (const id of ["waterway_river", "waterway_other", "waterway_tunnel"]) paint(id, "line-color", "#cfe2ea");
    for (const id of ["park", "landcover_grass", "landcover_wood"]) paint(id, "fill-color", "#e3efdc");
    for (const layer of map.getStyle().layers || []) if (/^poi/.test(layer.id) || layer.id === "ola-pois" || layer.id === "3d_model_data") hide(layer.id);
  } catch { /* the style does not allow it: keep Ola's own look */ }
}

export function NearbyVendorsMapOla({
  customerLat, customerLng, vendors, radiusKm, onRadiusChange, onSelectVendor, height = 420, photoPins = false, onPinClick, selectedId, people, selectedPersonId, onPersonClick, access, onFail,
}: {
  customerLat: number; customerLng: number; vendors: MapVendor[]; radiusKm: number; onRadiusChange: (km: number) => void; onSelectVendor?: (vendorId: string) => void;
  height?: number; photoPins?: boolean; onPinClick?: (vendorId: string) => void; selectedId?: string; people?: MapPerson[]; selectedPersonId?: string; onPersonClick?: (personId: string) => void;
  access: OlaAccess; onFail: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [dragRadius, setDragRadius] = useState<number | null>(null);
  const [zoom, setZoom] = useState(() => zoomForRadius(radiusKm));
  const effectiveRadius = dragRadius ?? radiusKm;
  const placed = useMemo(() => spreadOverlaps(vendors), [vendors]);
  const placedPeople = useMemo(() => spreadOverlaps(people || []), [people]);
  const closestId = useMemo(() => (vendors.length ? [...vendors].sort((a, b) => a.distanceKm - b.distanceKm)[0]?.id || "" : ""), [vendors]);
  const latest = useRef({ onRadiusChange, onFail, radiusKm }); latest.current = { onRadiusChange, onFail, radiusKm };

  // the map itself, created once
  useEffect(() => {
    if (!box.current) return;
    const styleUrl = `${access.base}/tiles/vector/v1/styles/${access.style}/style.json`;
    const map = new maplibregl.Map({
      container: box.current, style: styleUrl, center: [customerLng, customerLat], zoom: toGl(zoomForRadius(latest.current.radiusKm)), attributionControl: false, maxZoom: 19, dragRotate: false, pitchWithRotate: false,
      transformRequest: (url) => {
        if (!url.startsWith(access.base)) return { url };
        const auth = olaAuthNow();
        if (auth.token) return { url, headers: { Authorization: `Bearer ${auth.token}` } };
        if (auth.key) return { url: `${url}${url.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(auth.key)}` };
        return { url };
      },
    });
    map.touchZoomRotate.disableRotation();
    let loaded = false;
    // Style warnings (a layer without data) are normal and the map still draws. Only a refused or unreachable
    // service, or a map that never finishes loading, switches to the standard map.
    const giveUp = (why: string) => { if (loaded) return; loaded = true; console.warn("Ola map could not load, using the standard map:", why); latest.current.onFail(); };
    map.on("error", (e) => {
      const err = (e as { error?: Error & { status?: number } }).error;
      if (err?.status === 401 || err?.status === 403 || err?.status === 429) giveUp(`the service answered ${err.status}`);
    });
    const timer = window.setTimeout(() => giveUp("it took too long"), 20_000);
    map.on("load", () => {
      if (loaded) return; loaded = true; window.clearTimeout(timer); brand(map);
      map.addSource("sp-radius", { type: "geojson", data: circle(customerLat, customerLng, latest.current.radiusKm) });
      map.addLayer({ id: "sp-radius-fill", type: "fill", source: "sp-radius", paint: { "fill-color": "#c62653", "fill-opacity": 0.08 } });
      map.addLayer({ id: "sp-radius-line", type: "line", source: "sp-radius", paint: { "line-color": "#c62653", "line-width": 2 } });
      setReady(true);
    });
    map.on("styleimagemissing", (e) => { if (!map.hasImage(e.id)) map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) }); });
    map.on("zoomend", () => setZoom(Math.round(toTile(map.getZoom()))));
    mapRef.current = map;
    return () => { window.clearTimeout(timer); map.remove(); mapRef.current = null; setReady(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access.base, access.style]);

  // the radius circle
  useEffect(() => { const src = mapRef.current?.getSource("sp-radius") as maplibregl.GeoJSONSource | undefined; src?.setData(circle(customerLat, customerLng, effectiveRadius)); }, [ready, customerLat, customerLng, effectiveRadius]);

  // fly to the new radius when it changes (not while dragging)
  const lastRadius = useRef(radiusKm);
  useEffect(() => { if (lastRadius.current === radiusKm) return; lastRadius.current = radiusKm; mapRef.current?.flyTo({ center: [customerLng, customerLat], zoom: toGl(zoomForRadius(radiusKm)), duration: 500 }); }, [radiusKm, customerLat, customerLng]);

  // you, and the drag handle that sets the radius
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return;
    const you = new maplibregl.Marker({ element: iconEl(YOU_HTML, 28, "You are here"), anchor: "center" }).setLngLat([customerLng, customerLat]).addTo(map);
    const handlePoint = pointAtDistanceNorth(customerLat, customerLng, radiusKm);
    const handle = new maplibregl.Marker({ element: iconEl(HANDLE_HTML, 20), anchor: "center", draggable: true }).setLngLat([handlePoint.lng, handlePoint.lat]).addTo(map);
    const radiusAt = () => { const p = handle.getLngLat(); return Math.min(30, Math.max(1, Math.round(haversineKm(customerLat, customerLng, p.lat, p.lng)))); };
    handle.on("drag", () => setDragRadius(radiusAt()));
    handle.on("dragend", () => { latest.current.onRadiusChange(radiusAt()); setDragRadius(null); });
    return () => { you.remove(); handle.remove(); };
  }, [ready, customerLat, customerLng, radiusKm]);

  // vendor pins
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return;
    const created: maplibregl.Marker[] = [];
    placed.forEach((vendor, index) => {
      const pin = photoPins ? photoPinHtml(vendor, vendor.id === selectedId, zoom) : vendorPinHtml(vendor.id === closestId, vendor.distanceKm <= effectiveRadius, index);
      const el = iconEl(pin.html, pin.size, vendor.name);
      if (vendor.id === selectedId) el.style.zIndex = "5";
      const marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([vendor.lng, vendor.lat]);
      const hoverPopup = new maplibregl.Popup({ offset: 18, closeButton: false, closeOnClick: false, className: "sp-map-vendor-tooltip" }).setText(vendor.name);
      el.addEventListener("mouseenter", () => hoverPopup.setLngLat(marker.getLngLat()).addTo(map));
      el.addEventListener("mouseleave", () => hoverPopup.remove());
      if (onPinClick) el.addEventListener("click", (e) => { e.stopPropagation(); onPinClick(vendor.id); });
      else {
        const body = document.createElement("div"); body.className = "min-w-[160px] text-sm";
        const name = document.createElement("div"); name.className = "font-black"; name.textContent = vendor.name + (vendor.id === closestId ? "  · Closest" : ""); body.append(name);
        const meta = document.createElement("div"); meta.className = "mt-1 text-xs text-stone-500"; meta.textContent = `${vendor.distanceKm.toFixed(1)} km away${vendor.verified ? " · Verified" : ""}`; body.append(meta);
        if (onSelectVendor) { const b = document.createElement("button"); b.className = "mt-2 w-full rounded-lg bg-[#753b50] px-2 py-1.5 text-xs font-black text-white"; b.textContent = "View products"; b.onclick = () => onSelectVendor(vendor.id); body.append(b); }
        marker.setPopup(new maplibregl.Popup({ offset: 18, closeButton: false }).setDOMContent(body));
      }
      marker.addTo(map); created.push(marker);
    });
    return () => created.forEach((m) => m.remove());
  }, [ready, placed, photoPins, selectedId, closestId, zoom, effectiveRadius, onPinClick, onSelectVendor]);

  // people pins
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return;
    const created = placedPeople.map((person) => {
      const pin = personPinHtml(person, person.id === selectedPersonId);
      const el = iconEl(pin.html, pin.size, `@${person.handle}`);
      if (person.id === selectedPersonId) el.style.zIndex = "5";
      if (onPersonClick) el.addEventListener("click", (e) => { e.stopPropagation(); onPersonClick(person.id); });
      return new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([person.lng, person.lat]).addTo(map);
    });
    return () => created.forEach((m) => m.remove());
  }, [ready, placedPeople, selectedPersonId, onPersonClick]);

  // bring a newly chosen pin into view
  const lastSelected = useRef<string | undefined>(undefined);
  useEffect(() => {
    const id = selectedPersonId || selectedId; const map = mapRef.current;
    if (!map || !id || lastSelected.current === id) return; lastSelected.current = id;
    const target = [...placed, ...placedPeople].find((p) => p.id === id); if (!target) return;
    const b = map.getBounds(); const w = b.getEast() - b.getWest(), h = b.getNorth() - b.getSouth();
    const inside = target.lng > b.getWest() + w * 0.15 && target.lng < b.getEast() - w * 0.15 && target.lat > b.getSouth() + h * 0.15 && target.lat < b.getNorth() - h * 0.15;
    if (!inside) map.flyTo({ center: [target.lng, target.lat], zoom: Math.max(map.getZoom(), toGl(13)), duration: 450 });
  }, [selectedId, selectedPersonId, placed, placedPeople]);

  const centre = useCallback(() => mapRef.current?.flyTo({ center: [customerLng, customerLat], zoom: toGl(zoomForRadius(radiusKm)), duration: 500 }), [customerLat, customerLng, radiusKm]);
  const inRange = vendors.filter((v) => v.distanceKm <= radiusKm).length;
  const round = "grid size-9 place-items-center rounded-full border border-white/70 bg-white/95 text-lg font-black leading-none text-[#292124] shadow-md backdrop-blur";

  return (
    <div className="sp-vendor-map relative overflow-hidden rounded-[26px] border border-stone-200/70" data-map-engine="ola">
      <div ref={box} style={{ height: `${height}px`, width: "100%" }} />
      <div className="absolute left-3 top-3 z-[5] flex items-center gap-1 rounded-full border border-white/70 bg-white/92 py-1 pl-3 pr-1 text-xs font-black text-[#292124] shadow-sm backdrop-blur">
        <MapPin className="size-3.5 shrink-0 text-[#653046]" />
        <span className="whitespace-nowrap" data-testid="map-count">{people ? `${radiusKm} km · ${people.length} ${people.length === 1 ? "person" : "people"} nearby` : `${radiusKm} km · ${inRange} vendor${inRange === 1 ? "" : "s"} in range`}</span>
        <span className="ml-1 flex shrink-0 items-center gap-0.5">
          <button type="button" aria-label="Decrease radius" onClick={() => onRadiusChange(Math.max(1, radiusKm - 1))} className="grid size-6 place-items-center rounded-full bg-stone-100 text-sm font-black leading-none hover:bg-stone-200">−</button>
          <button type="button" aria-label="Increase radius" onClick={() => onRadiusChange(Math.min(30, radiusKm + 1))} className="grid size-6 place-items-center rounded-full bg-stone-100 text-sm font-black leading-none hover:bg-stone-200">+</button>
        </span>
      </div>
      <div className="absolute right-3 top-3 z-[5] flex flex-col gap-1.5">
        <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => mapRef.current?.zoomIn()} className={round}>+</button>
        <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => mapRef.current?.zoomOut()} className={round}>−</button>
        <button type="button" aria-label="Centre the map on my location" title="Centre the map on my location" onClick={centre} className={round}>◎</button>
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 z-[5] flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-full border border-white/70 bg-white/90 px-3 py-1.5 text-[10px] font-bold text-stone-500 shadow-sm backdrop-blur">
        <ShoppingBag className="hidden size-3 shrink-0 text-[#653046] sm:block" /><span className="hidden sm:inline">Drag the pink handle, or use +/&minus; on the chip, to change your radius</span><span className="sm:hidden">© Ola Maps</span><span className="hidden sm:inline">&middot; © Ola Maps · OpenStreetMap contributors</span>
      </div>
    </div>
  );
}
