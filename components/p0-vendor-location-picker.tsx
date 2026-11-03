"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";

type Place = { address: string; latitude: number; longitude: number };
type PinMapComponent = (props: { lat: number; lng: number; radiusKm?: number }) => ReactElement;

const buttonClass = "inline-flex items-center justify-center rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-xs font-black text-stone-800 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50";

export function P0VendorLocationPicker({
  address,
  locality,
  latitude,
  longitude,
  radiusKm,
  onSave,
}: {
  address: string;
  locality: string;
  latitude: string;
  longitude: string;
  radiusKm: string;
  onSave: (place: Place) => void;
}) {
  const query = useMemo(() => [address, locality].filter(Boolean).join(", ").trim(), [address, locality]);
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [draftPlace, setDraftPlace] = useState<{ place: Place; query: string } | null>(null);
  const [locationError, setLocationError] = useState("");
  const [busy, setBusy] = useState<"search" | "gps" | "">("");
  const [PinMap, setPinMap] = useState<PinMapComponent | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      if (query.length < 3) {
        setSuggestions([]);
        return;
      }
      try {
        const response = await fetch(`/api/geocode?suggest=1&q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error("Address suggestions are unavailable.");
        const result = await response.json() as { suggestions?: Place[] };
        if (active) setSuggestions(result.suggestions || []);
      } catch {
        if (active) setSuggestions([]);
      }
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    let active = true;
    void import("@/components/pin-map").then((module) => {
      if (active) setPinMap(() => module.PinMap);
    }).catch(() => {
      if (active) setLocationError("The map preview could not be loaded. You can still use address search or GPS.");
    });
    return () => { active = false; };
  }, []);

  async function searchAddress() {
    if (query.length < 3) {
      setLocationError("Enter at least 3 characters of the vendor address or locality.");
      return;
    }
    setBusy("search");
    setLocationError("");
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const result = await response.json() as Place & { error?: string };
      if (!response.ok || !Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) {
        throw new Error(result.error || "No map match for that address. Check the spelling and try again.");
      }
      setDraftPlace({ place: result, query });
      setSuggestions([]);
    } catch (caught) {
      setLocationError(caught instanceof Error ? caught.message : "The address could not be found.");
    } finally {
      setBusy("");
    }
  }

  async function getGpsLocation() {
    if (!navigator.geolocation) {
      setLocationError("GPS location is not available in this browser.");
      return;
    }
    setBusy("gps");
    setLocationError("");
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
      });
      const { latitude: lat, longitude: lng } = position.coords;
      let found: Place = { address: `GPS location (${lat.toFixed(6)}, ${lng.toFixed(6)})`, latitude: lat, longitude: lng };
      try {
        const response = await fetch(`/api/geocode?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`);
        const result = await response.json() as Place & { error?: string };
        if (!response.ok) throw new Error(result.error || "Address lookup failed.");
        if (result.address) found = { ...result, latitude: lat, longitude: lng };
      } catch {
        setLocationError("GPS pin found, but its street address could not be looked up. You can still save the exact pin.");
      }
      setDraftPlace({ place: found, query });
      setSuggestions([]);
    } catch (caught) {
      const error = caught as GeolocationPositionError;
      setLocationError(error.code === 1
        ? "Allow location access in your browser to use GPS."
        : error.code === 3 ? "GPS location timed out. Try again or search for the address."
          : "Your current location could not be detected. Try address search instead.");
    } finally {
      setBusy("");
    }
  }

  const currentLat = Number(latitude);
  const currentLng = Number(longitude);
  const selectedDraft = draftPlace?.query === query ? draftPlace.place : null;
  const preview = selectedDraft || (Number.isFinite(currentLat) && Number.isFinite(currentLng) && latitude !== "" && longitude !== ""
    ? { address, latitude: currentLat, longitude: currentLng }
    : null);
  const radius = Number(radiusKm);

  return <section className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50 p-3 sm:col-span-2" aria-label="Set vendor location">
    <div>
      <h3 className="text-sm font-black text-stone-900">Set vendor location</h3>
      <p className="mt-1 text-xs leading-5 text-stone-500">Search for the full business address or use GPS. Confirm the pin before creating this P0 vendor.</p>
    </div>
    {suggestions.length > 0 && <div className="max-h-52 overflow-y-auto rounded-xl border border-stone-200 bg-white p-1.5">
      {suggestions.map((place, index) => {
        const [primary, ...rest] = place.address.split(",");
        return <button type="button" key={`${place.latitude}-${place.longitude}-${index}`} onClick={() => { setDraftPlace({ place, query }); setLocationError(""); setSuggestions([]); }} className="flex w-full items-start gap-2 rounded-lg p-2.5 text-left hover:bg-rose-50">
          <span aria-hidden="true" className="mt-0.5 text-base text-rose-600">●</span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-black text-stone-800">{primary.trim()}</span>
            <span className="mt-0.5 block truncate text-xs text-stone-500">{rest.join(",").trim()}</span>
          </span>
        </button>;
      })}
    </div>}
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => void getGpsLocation()} disabled={busy !== ""} className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-3 py-2.5 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50">
        {busy === "gps" ? "Finding GPS location…" : "Use my actual GPS location"}
      </button>
      <button type="button" onClick={() => void searchAddress()} disabled={busy !== ""} className={buttonClass}>
        {busy === "search" ? "Searching address…" : "Find typed address"}
      </button>
    </div>
    {locationError && <p role="alert" className="text-xs font-semibold text-red-700">{locationError}</p>}
    {preview ? <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="relative h-64 bg-stone-100">
        {PinMap ? <PinMap lat={preview.latitude} lng={preview.longitude} radiusKm={Number.isFinite(radius) ? radius : 0} />
          : <div className="grid h-full place-items-center text-sm text-stone-500">Loading map…</div>}
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-white px-3 py-1.5 text-xs font-black shadow">Vendor location pin</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 px-3 py-2.5 text-xs">
        <span className="mr-auto font-mono text-stone-500">Pin {preview.latitude.toFixed(6)}, {preview.longitude.toFixed(6)}</span>
        <a href={`https://www.google.com/maps?q=${preview.latitude},${preview.longitude}`} target="_blank" rel="noreferrer" className="font-black text-rose-700 hover:underline">Verify in Google Maps ↗</a>
        <a href={`https://www.openstreetmap.org/?mlat=${preview.latitude}&mlon=${preview.longitude}#map=16/${preview.latitude}/${preview.longitude}`} target="_blank" rel="noreferrer" className="font-black text-rose-700 hover:underline">OpenStreetMap ↗</a>
      </div>
    </div> : <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-stone-300 bg-white px-4 text-center text-xs text-stone-500">Search for an address or use GPS to preview the vendor pin here.</div>}
    {preview && <button type="button" onClick={() => { onSave(preview); setDraftPlace(null); setLocationError(""); }} className="w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-black text-white hover:bg-rose-700">
      Save this vendor pin
    </button>}
  </section>;
}
