"use client";
 
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, Popup, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { HANDLE_HTML, YOU_HTML, haversineKm, personPinHtml, photoPinHtml, pointAtDistanceNorth, spreadOverlaps, vendorPinHtml, zoomForRadius, type MapPerson, type MapVendor } from "./map-shared";
export type { MapPerson, MapVendor } from "./map-shared";
import { MapPin, ShoppingBag } from "@/components/icons";

function divIcon(html: string, size: number) {
  return L.divIcon({ html, className: "sp-map-icon", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

const customerIcon = divIcon(YOU_HTML, 28);
function vendorIcon(closest: boolean, inRange: boolean, index: number) { const p = vendorPinHtml(closest, inRange, index); return divIcon(p.html, p.size); }
function photoPin(vendor: MapVendor, selected: boolean, zoom = 13) { const p = photoPinHtml(vendor, selected, zoom); return divIcon(p.html, p.size); }
function personPin(person: MapPerson, selected: boolean) { const p = personPinHtml(person, selected); return divIcon(p.html, p.size); }
const handleIcon = divIcon(HANDLE_HTML, 20);

/** Keeps the map view centred/zoomed on the customer + radius whenever either
 * changes, without fighting the user's own pan/zoom on every render. */
function RecenterOnRadiusChange({ lat, lng, radiusKm }: { lat: number; lng: number; radiusKm: number }) {
  const map = useMap();
  const lastRadius = useRef(radiusKm);
  useEffect(() => {
    if (lastRadius.current === radiusKm) return;
    lastRadius.current = radiusKm;
    map.flyTo([lat, lng], zoomForRadius(radiusKm), { duration: 0.5 });
  }, [map, lat, lng, radiusKm]);
  return null;
}

/** Zoom in/out and "centre on me", stacked under the trail button. Built as one Leaflet
 * control (the default zoom control sat under the radius chip and could not be moved). */
function MapControls({ lat, lng, radiusKm }: { lat: number; lng: number; radiusKm: number }) {
  const map = useMap();
  useEffect(() => {
    const Control = L.Control.extend({
      onAdd() {
        const box = L.DomUtil.create("div", "sp-map-controls");
        box.style.cssText = "display:flex;flex-direction:column;gap:6px;margin-top:52px;margin-right:12px";
        const make = (label: string, aria: string, onClick: () => void) => {
          const b = L.DomUtil.create("button", "", box) as HTMLButtonElement;
          b.type = "button"; b.textContent = label; b.setAttribute("aria-label", aria); b.title = aria;
          b.style.cssText = "width:36px;height:36px;border-radius:9999px;border:1px solid rgba(255,255,255,.7);background:rgba(255,255,255,.94);color:#1e1719;font:900 18px/1 system-ui;box-shadow:0 2px 8px rgba(0,0,0,.18);cursor:pointer;backdrop-filter:blur(6px)";
          L.DomEvent.on(b, "click", (e) => { L.DomEvent.stop(e); onClick(); });
        };
        make("+", "Zoom in", () => map.zoomIn());
        make("\u2212", "Zoom out", () => map.zoomOut());
        make("\u25CE", "Centre the map on my location", () => map.flyTo([lat, lng], zoomForRadius(radiusKm), { duration: 0.5 }));
        L.DomEvent.disableClickPropagation(box);
        return box;
      },
    });
    const control = new Control({ position: "topright" });
    control.addTo(map);
    return () => { control.remove(); };
  }, [map, lat, lng, radiusKm]);
  return null;
}

/** Reports the map's zoom level so pin sizes can follow it. */
function ZoomWatcher({ onZoom }: { onZoom: (zoom: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const handler = () => onZoom(map.getZoom());
    handler();
    map.on("zoomend", handler);
    return () => { map.off("zoomend", handler); };
  }, [map, onZoom]);
  return null;
}

/** When a vendor is chosen from the list or card, bring its pin into view without
 * fighting the customer's own panning. */
function FlyToSelected({ selectedId, vendors }: { selectedId?: string; vendors: { id: string; lat: number; lng: number }[] }) {
  const map = useMap();
  const last = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!selectedId || last.current === selectedId) return;
    last.current = selectedId;
    const target = vendors.find((v) => v.id === selectedId);
    if (!target) return;
    const point = L.latLng(target.lat, target.lng);
    if (!map.getBounds().pad(-0.15).contains(point)) map.flyTo(point, Math.max(map.getZoom(), 13), { duration: 0.45 });
  }, [map, selectedId, vendors]);
  return null;
}

export function NearbyVendorsMapLeaflet({
  customerLat, customerLng, vendors, radiusKm, onRadiusChange, onSelectVendor,
  height = 420, photoPins = false, onPinClick, selectedId, people, selectedPersonId, onPersonClick,
}: {
  customerLat: number; customerLng: number; vendors: MapVendor[]; radiusKm: number;
  onRadiusChange: (km: number) => void; onSelectVendor?: (vendorId: string) => void;
  height?: number; photoPins?: boolean; onPinClick?: (vendorId: string) => void; selectedId?: string;
  /** When given, the map shows people instead of vendors and the chip counts people. */
  people?: MapPerson[]; selectedPersonId?: string; onPersonClick?: (personId: string) => void;
}) {
  const [dragRadius, setDragRadius] = useState<number | null>(null);
  const [zoom, setZoom] = useState(() => zoomForRadius(radiusKm));
  const effectiveRadius = dragRadius ?? radiusKm;
  // The handle marker's own position must NOT be derived from state that its
  // own drag handler updates (dragRadius) — react-leaflet calls setLatLng()
  // whenever the `position` prop changes, which would fight Leaflet's native
  // drag tracking mid-gesture (observed: the marker moved ~2x the mouse
  // delta). It's driven only by the committed radius, so it stays fully
  // under Leaflet's control during a drag and only snaps once, on release.
  const committedHandlePoint = useMemo(() => pointAtDistanceNorth(customerLat, customerLng, radiusKm), [customerLat, customerLng, radiusKm]);
  const placed = useMemo(() => spreadOverlaps(vendors), [vendors]);
  const placedPeople = useMemo(() => spreadOverlaps(people || []), [people]);
  const closestId = useMemo(() => {
    if (!vendors.length) return "";
    return [...vendors].sort((a, b) => a.distanceKm - b.distanceKm)[0]?.id || "";
  }, [vendors]);

  return (
    <div className="sp-vendor-map relative overflow-hidden rounded-[26px] border border-stone-200/70">
      <MapContainer center={[customerLat, customerLng]} zoom={zoomForRadius(radiusKm)} scrollWheelZoom zoomControl={false} style={{ height: `${height}px`, width: "100%" }} attributionControl={false}>
        {/* Esri World Street Map: a free, no-API-key raster tile set with the
            clean, colour-coded roads/labels look of a mainstream consumer map
            app (the raw-OSM tile style reads as more of a technical basemap,
            and CARTO's free basemap CDN now requires its own API key). */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri &mdash; Esri, HERE, Garmin, USGS, EPA, NPS"
          maxZoom={19}
        />
        <RecenterOnRadiusChange lat={customerLat} lng={customerLng} radiusKm={radiusKm} />
        <MapControls lat={customerLat} lng={customerLng} radiusKm={radiusKm} />
        <ZoomWatcher onZoom={setZoom} />
        <FlyToSelected selectedId={selectedPersonId || selectedId} vendors={people ? placedPeople : placed} />
        <Circle
          center={[customerLat, customerLng]}
          radius={effectiveRadius * 1000}
          pathOptions={{ color: "#c62653", weight: 2, fillColor: "#c62653", fillOpacity: 0.08 }}
        />
        <Marker position={[customerLat, customerLng]} icon={customerIcon}>
          <Popup>You are here</Popup>
        </Marker>
        <Marker
          position={[committedHandlePoint.lat, committedHandlePoint.lng]}
          icon={handleIcon}
          draggable
          eventHandlers={{
            drag: (event) => {
              const marker = event.target as L.Marker;
              const position = marker.getLatLng();
              const next = Math.min(30, Math.max(1, Math.round(haversineKm(customerLat, customerLng, position.lat, position.lng))));
              setDragRadius(next);
            },
            dragend: (event) => {
              const marker = event.target as L.Marker;
              const position = marker.getLatLng();
              const next = Math.min(30, Math.max(1, Math.round(haversineKm(customerLat, customerLng, position.lat, position.lng))));
              onRadiusChange(next);
              setDragRadius(null);
            },
          }}
        />
        {placedPeople.map((person) => (
          <Marker key={`person-${person.id}`} title={`@${person.handle}`} alt={`@${person.handle}`} position={[person.lat, person.lng]} icon={personPin(person, person.id === selectedPersonId)}
            eventHandlers={onPersonClick ? { click: () => onPersonClick(person.id) } : undefined} zIndexOffset={person.id === selectedPersonId ? 1000 : 0} />
        ))}
        {placed.map((vendor, index) => (
          <Marker
            key={vendor.id}
            title={vendor.name}
            alt={vendor.name}
            position={[vendor.lat, vendor.lng]}
            icon={photoPins ? photoPin(vendor, vendor.id === selectedId, zoom) : vendorIcon(vendor.id === closestId, vendor.distanceKm <= effectiveRadius, index)}
            eventHandlers={onPinClick ? { click: () => onPinClick(vendor.id) } : undefined}
            zIndexOffset={vendor.id === selectedId ? 1000 : 0}
          >
            {!onPinClick && <Popup>
              <div className="min-w-40 text-sm">
                <div className="font-black text-[#292124]">{vendor.name}{vendor.id === closestId && <span className="ml-1.5 rounded-full bg-[#f7edf0] px-1.5 py-0.5 text-[10px] font-black text-[#653046]">Closest</span>}</div>
                <div className="mt-1 text-xs text-stone-500">{vendor.distanceKm.toFixed(1)} km away{vendor.verified ? " · Verified" : ""}</div>
                {vendor.productCount ? <div className="mt-0.5 text-xs text-stone-500">{vendor.productCount} product{vendor.productCount === 1 ? "" : "s"} in range</div> : null}
                {onSelectVendor && <button onClick={() => onSelectVendor(vendor.id)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#753b50] px-2 py-1.5 text-xs font-black text-white">View products</button>}
              </div>
            </Popup>}
            <Tooltip direction="top" offset={[0, -8]} className="sp-map-vendor-tooltip">{vendor.name}</Tooltip>
          </Marker>
        ))}
      </MapContainer>
      <div className="absolute left-3 top-3 z-1000 flex items-center gap-1 rounded-full border border-white/70 bg-white/92 py-1 pl-3 pr-1 text-xs font-black text-[#292124] shadow-sm backdrop-blur">
        <MapPin className="size-3.5 shrink-0 text-[#653046]" />
        <span className="whitespace-nowrap" data-testid="map-count">{people ? `${radiusKm} km · ${people.length} ${people.length === 1 ? "person" : "people"} nearby` : `${radiusKm} km · ${vendors.filter((v) => v.distanceKm <= radiusKm).length} vendor${vendors.filter((v) => v.distanceKm <= radiusKm).length === 1 ? "" : "s"} in range`}</span>
        <span className="ml-1 flex shrink-0 items-center gap-0.5">
          <button type="button" aria-label="Decrease radius" onClick={() => onRadiusChange(Math.max(1, radiusKm - 1))} className="grid size-6 place-items-center rounded-full bg-stone-100 text-sm font-black leading-none hover:bg-stone-200">−</button>
          <button type="button" aria-label="Increase radius" onClick={() => onRadiusChange(Math.min(30, radiusKm + 1))} className="grid size-6 place-items-center rounded-full bg-stone-100 text-sm font-black leading-none hover:bg-stone-200">+</button>
        </span>
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 z-1000 flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-full border border-white/70 bg-white/90 px-3 py-1.5 text-[10px] font-bold text-stone-500 shadow-sm backdrop-blur">
        <ShoppingBag className="hidden size-3 shrink-0 text-[#653046] sm:block" /><span className="hidden sm:inline">Drag the pink handle, or use +/&minus; on the chip, to change your radius</span><span className="sm:hidden">Tiles &copy; Esri</span><span className="hidden sm:inline">&middot; Tiles &copy; Esri</span>
      </div>
    </div>
  );
}
