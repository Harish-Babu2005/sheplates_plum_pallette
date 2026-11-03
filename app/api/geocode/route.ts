import { NextResponse } from "next/server";
import { olaAutocomplete, olaConfigured, olaGeocode, olaReverseGeocode } from "@/lib/ola-maps";

type NominatimPlace = {
  display_name?: string;
  lat?: string;
  lon?: string;
};

const headers = {
  Accept: "application/json",
  "Accept-Language": "en-IN,en;q=0.9",
  "User-Agent": "ShePlates/3.1 (hyperlocal-commerce; contact: support@sheplates.com)",
};

export async function GET(request: Request) {
  const input = new URL(request.url).searchParams;
  const lat = Number(input.get("lat"));
  const lng = Number(input.get("lng"));
  const query = input.get("q")?.trim();
  const suggest = input.get("suggest") === "1";

  if (suggest) {
    if (!query || query.length < 3) return NextResponse.json({ suggestions: [] });
    if (olaConfigured() && (process.env.OLA_MAPS_API_KEY || process.env.OLA_MAPS_CLIENT_ID)) {
      try {
        const near = input.get("lat") !== null && input.get("lng") !== null && Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? { lat, lng } : undefined;
        const found = await olaAutocomplete(query, near);
        if (found.length) return NextResponse.json({ suggestions: found, attribution: "Ola Maps" }, { headers: { "Cache-Control": "private, max-age=120" } });
      } catch (error) { console.warn("Ola autocomplete failed, using the standard search", error instanceof Error ? error.message : error); }
    }
    const endpoint = new URL("https://nominatim.openstreetmap.org/search");
    endpoint.searchParams.set("q", query);
    endpoint.searchParams.set("format", "jsonv2");
    endpoint.searchParams.set("limit", "5");
    endpoint.searchParams.set("countrycodes", "in");
    endpoint.searchParams.set("addressdetails", "1");
    try {
      const response = await fetch(endpoint, { headers, signal: AbortSignal.timeout(6000) });
      if (!response.ok) throw new Error(`Map provider returned ${response.status}`);
      const raw = await response.json() as NominatimPlace[];
      const suggestions = (Array.isArray(raw) ? raw : [])
        .filter((place) => place?.lat && place?.lon && place?.display_name)
        .map((place) => ({ address: place.display_name as string, latitude: Number(place.lat), longitude: Number(place.lon) }));
      return NextResponse.json({ suggestions }, { headers: { "Cache-Control": "private, max-age=120" } });
    } catch {
      return NextResponse.json({ suggestions: [] });
    }
  }

  if (olaConfigured() && (process.env.OLA_MAPS_API_KEY || process.env.OLA_MAPS_CLIENT_ID)) {
    try {
      if (query) { const hit = await olaGeocode(query); if (hit) return NextResponse.json({ ...hit, attribution: "Ola Maps" }, { headers: { "Cache-Control": "private, max-age=300" } }); }
      else if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) { const hit = await olaReverseGeocode(lat, lng); if (hit) return NextResponse.json({ ...hit, attribution: "Ola Maps" }, { headers: { "Cache-Control": "private, max-age=300" } }); }
    } catch (error) { console.warn("Ola geocoding failed, using the standard search", error instanceof Error ? error.message : error); }
  }

  let endpoint: URL;
  if (query) {
    endpoint = new URL("https://nominatim.openstreetmap.org/search");
    endpoint.searchParams.set("q", query);
    endpoint.searchParams.set("format", "jsonv2");
    endpoint.searchParams.set("limit", "1");
    endpoint.searchParams.set("countrycodes", "in");
    endpoint.searchParams.set("addressdetails", "1");
  } else if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    endpoint = new URL("https://nominatim.openstreetmap.org/reverse");
    endpoint.searchParams.set("lat", String(lat));
    endpoint.searchParams.set("lon", String(lng));
    endpoint.searchParams.set("format", "jsonv2");
    endpoint.searchParams.set("zoom", "18");
    endpoint.searchParams.set("addressdetails", "1");
    endpoint.searchParams.set("layer", "address");
  } else {
    return NextResponse.json({ error: "Provide a valid address or latitude/longitude." }, { status: 400 });
  }

  try {
    const response = await fetch(endpoint, { headers, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Map provider returned ${response.status}`);
    const raw = await response.json() as NominatimPlace | NominatimPlace[];
    const place = Array.isArray(raw) ? raw[0] : raw;
    if (!place?.lat || !place?.lon) return NextResponse.json({ error: "Address not found." }, { status: 404 });
    return NextResponse.json({
      address: place.display_name || query || "Selected location",
      latitude: Number(place.lat),
      longitude: Number(place.lon),
      attribution: "© OpenStreetMap contributors",
    }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch {
    return NextResponse.json({ error: "The map service is temporarily unavailable. Keep the address and try again." }, { status: 502 });
  }
}
