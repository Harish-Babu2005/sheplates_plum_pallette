"use client";
// A small map that shows one place (a delivery pin or a store pin) and, optionally, a service radius around it.
// Used where a person confirms a location. Runs on Ola Maps when it is set up and on the standard map otherwise.
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Circle, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { loadOlaAccess, olaAuthNow, resetOlaAccess, type OlaAccess } from "@/lib/ola-client";
import { YOU_HTML } from "./map-shared";

const pinIcon = L.divIcon({ html: YOU_HTML, className: "sp-map-icon", iconSize: [28, 28], iconAnchor: [14, 14] });
const zoomFor = (radiusKm: number) => (radiusKm <= 0 ? 15 : radiusKm <= 1 ? 14 : radiusKm <= 2 ? 13 : radiusKm <= 5 ? 12 : radiusKm <= 10 ? 11 : radiusKm <= 20 ? 10 : 9);

function ring(lat: number, lng: number, km: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const pts: [number, number][] = []; const dLat = km / 111.32, dLng = km / (111.32 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  for (let i = 0; i <= 96; i++) { const a = (i / 96) * 2 * Math.PI; pts.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]); }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [pts] } };
}

function OlaPin({ lat, lng, radiusKm, access, onFail, onChange }: { lat: number; lng: number; radiusKm: number; access: OlaAccess; onFail: () => void; onChange?: (point: { lat: number; lng: number }) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const fail = useRef(onFail);
  useEffect(() => { fail.current = onFail; }, [onFail]);
  const change = useRef(onChange);
  useEffect(() => { change.current = onChange; }, [onChange]);
  useEffect(() => {
    if (!box.current) return;
    const m = new maplibregl.Map({
      container: box.current, style: `${access.base}/tiles/vector/v1/styles/${access.style}/style.json`, center: [lng, lat], zoom: zoomFor(radiusKm) - 1, attributionControl: false, dragRotate: false,
      transformRequest: (url) => {
        if (!url.startsWith(access.base)) return { url };
        const a = olaAuthNow();
        if (a.token) return { url, headers: { Authorization: `Bearer ${a.token}` } };
        if (a.key) return { url: `${url}${url.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(a.key)}` };
        return { url };
      },
    });
    m.touchZoomRotate.disableRotation();
    let done = false;
    const giveUp = () => { if (done) return; done = true; fail.current(); };
    m.on("error", (e) => { const s = (e as { error?: { status?: number } }).error?.status; if (s === 401 || s === 403 || s === 429) giveUp(); });
    const timer = window.setTimeout(giveUp, 20_000);
    m.on("styleimagemissing", (e) => { if (!m.hasImage(e.id)) m.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) }); });
    m.on("load", () => {
      if (done) return; done = true; window.clearTimeout(timer);
      try {
        m.setPaintProperty("background", "background-color", "#f8f3f1");
        for (const l of m.getStyle().layers || []) if (/^poi/.test(l.id) || l.id === "ola-pois" || l.id === "3d_model_data") m.setLayoutProperty(l.id, "visibility", "none");
      } catch { /* keep Ola's look */ }
      m.addSource("sp-area", { type: "geojson", data: ring(lat, lng, radiusKm) });
      m.addLayer({ id: "sp-area-fill", type: "fill", source: "sp-area", paint: { "fill-color": "#c62653", "fill-opacity": radiusKm > 0 ? 0.08 : 0 } });
      m.addLayer({ id: "sp-area-line", type: "line", source: "sp-area", paint: { "line-color": "#c62653", "line-width": radiusKm > 0 ? 2 : 0 } });
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    const el = document.createElement("div"); el.className = "sp-map-icon"; el.style.width = "28px"; el.style.height = "28px"; el.innerHTML = YOU_HTML;
    marker.current = new maplibregl.Marker({ element: el, anchor: "center", draggable: Boolean(onChange) }).setLngLat([lng, lat]).addTo(m);
    marker.current.on("dragend", () => {
      const position = marker.current?.getLngLat();
      if (position) change.current?.({ lat: Number(position.lat.toFixed(6)), lng: Number(position.lng.toFixed(6)) });
    });
    map.current = m;
    return () => { window.clearTimeout(timer); m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access.base, access.style]);
  useEffect(() => {
    const m = map.current; if (!m) return;
    marker.current?.setLngLat([lng, lat]);
    m.flyTo({ center: [lng, lat], zoom: zoomFor(radiusKm) - 1, duration: 400 });
    const src = m.getSource("sp-area") as maplibregl.GeoJSONSource | undefined; src?.setData(ring(lat, lng, radiusKm));
    if (m.getLayer("sp-area-fill")) { m.setPaintProperty("sp-area-fill", "fill-opacity", radiusKm > 0 ? 0.08 : 0); m.setPaintProperty("sp-area-line", "line-width", radiusKm > 0 ? 2 : 0); }
  }, [lat, lng, radiusKm]);
  return <div ref={box} className="h-full w-full" data-map-engine="ola" />;
}

function Recenter({ lat, lng, radiusKm }: { lat: number; lng: number; radiusKm: number }) { const m = useMap(); useEffect(() => { m.setView([lat, lng], zoomFor(radiusKm), { animate: true }); }, [m, lat, lng, radiusKm]); return null; }
function StandardPin({ lat, lng, radiusKm, onChange }: { lat: number; lng: number; radiusKm: number; onChange?: (point: { lat: number; lng: number }) => void }) {
  return <div className="h-full w-full" data-map-engine="standard"><MapContainer center={[lat, lng]} zoom={zoomFor(radiusKm)} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }} attributionControl={false}>
    <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
    <Recenter lat={lat} lng={lng} radiusKm={radiusKm} />
    {radiusKm > 0 && <Circle center={[lat, lng]} radius={radiusKm * 1000} pathOptions={{ color: "#c62653", weight: 2, fillColor: "#c62653", fillOpacity: 0.08 }} />}
    <Marker position={[lat, lng]} icon={pinIcon} draggable={Boolean(onChange)} eventHandlers={onChange ? { dragend: (event) => { const position = event.target.getLatLng(); onChange({ lat: Number(position.lat.toFixed(6)), lng: Number(position.lng.toFixed(6)) }); } } : undefined} />
  </MapContainer></div>;
}

export function PinMap({ lat, lng, radiusKm = 0, onChange }: { lat: number; lng: number; radiusKm?: number; onChange?: (point: { lat: number; lng: number }) => void }) {
  const [engine, setEngine] = useState<"loading" | "ola" | "standard">("loading");
  const [access, setAccess] = useState<OlaAccess | null>(null);
  useEffect(() => { let alive = true; void loadOlaAccess().then((a) => { if (!alive) return; setAccess(a); setEngine(a ? "ola" : "standard"); }); return () => { alive = false; }; }, []);
  if (engine === "loading") return <div className="grid h-full w-full place-items-center bg-stone-100 text-sm text-stone-400">Loading map…</div>;
  if (engine === "ola" && access) return <OlaPin lat={lat} lng={lng} radiusKm={radiusKm} access={access} onFail={() => { resetOlaAccess(); setEngine("standard"); }} onChange={onChange} />;
  return <StandardPin lat={lat} lng={lng} radiusKm={radiusKm} onChange={onChange} />;
}
