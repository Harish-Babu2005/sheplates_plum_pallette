"use client";
// The map used across the app. It runs on Ola Maps when the server has Ola credentials, and on the standard map
// otherwise (or if Ola cannot be reached), so the app always has a working map.
import { useEffect, useState } from "react";
import { loadOlaAccess, resetOlaAccess, type OlaAccess } from "@/lib/ola-client";
import { NearbyVendorsMapLeaflet } from "./nearby-vendors-map-leaflet";
import { NearbyVendorsMapOla } from "./nearby-vendors-map-ola";
import type { MapPerson, MapVendor } from "./map-shared";
import { uniqueValidMapPins } from "@/lib/connect-map";

export type { MapPerson, MapVendor } from "./map-shared";

type Props = {
  customerLat: number; customerLng: number; vendors: MapVendor[]; radiusKm: number; onRadiusChange: (km: number) => void; onSelectVendor?: (vendorId: string) => void;
  height?: number; photoPins?: boolean; onPinClick?: (vendorId: string) => void; selectedId?: string; people?: MapPerson[]; selectedPersonId?: string; onPersonClick?: (personId: string) => void;
};

export function NearbyVendorsMap(raw: Props) {
  // Drop pins with invalid coordinates and repeated ids (a vendor can arrive from both the marketplace and Connect lists).
  const props = { ...raw, vendors: uniqueValidMapPins(raw.vendors), people: raw.people ? uniqueValidMapPins(raw.people) : raw.people };
  const [engine, setEngine] = useState<"loading" | "ola" | "standard">("loading");
  const [access, setAccess] = useState<OlaAccess | null>(null);
  useEffect(() => {
    let alive = true;
    void loadOlaAccess().then((a) => { if (!alive) return; setAccess(a); setEngine(a ? "ola" : "standard"); });
    return () => { alive = false; };
  }, []);
  if (engine === "loading") return <div className="grid place-items-center rounded-[26px] border border-stone-200/70 bg-stone-50 text-sm text-stone-400" style={{ height: `${props.height ?? 420}px` }}>Loading map…</div>;
  if (engine === "ola" && access) return <NearbyVendorsMapOla {...props} access={access} onFail={() => { resetOlaAccess(); setEngine("standard"); }} />;
  return <NearbyVendorsMapLeaflet {...props} />;
}
