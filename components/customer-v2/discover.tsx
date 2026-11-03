"use client";
// Discovery screens of the redesigned customer portal: Marketplace sections
// (category grid, promo, vendor rows), the Maps tab, the Food Drops tab and the
// Schedules tab wrapper.
import type * as React from "react";
import type { ComponentType } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { isLiveSupabaseMode, loadConnectVendorsNearby, normalizeWhatsAppNumber, trackLiveVendorWhatsAppClick, type ConnectVendor, type WhatsAppClickSource } from "@/lib/supabase";
import { mergeMarketplaceAndConnectPins, uniqueById } from "@/lib/connect-map";
import { BadgeCheck, InfoIcon as Info, List, MapPin, Search, Timer, Zap, MessageCircle, Soup, BowlFood, Fish, Carrot, Basket, Croissant, ChefHat, Drop, Cookie, Sparkles, Star } from "@/components/icons";
import { toast } from "sonner";
import { MARKET_GROUPS } from "@/lib/market-groups";
import { claimedPercent, discountPercent, dropDisplayStatus, foodDropSchedule, formatCountdown, type FoodDrop } from "@/lib/food-drops";
import type { NearbyVendorsMap as NearbyVendorsMapComponent, MapVendor, MapPerson } from "@/components/nearby-vendors-map";
import type { Vendor, V3State } from "@/components/sheplates-v3";
import type { SocialApi } from "@/lib/social";
import type { FoodShort, ShortsApi } from "@/lib/food-shorts";
import type { PeopleApi } from "@/lib/people";
import { PeopleDistanceChips, PersonRow, usePeopleQuery } from "./people";
import { EmptyState, PhotoTile, SectionHeader, SegTabs, Stars, categoryEmoji, haversineKm, money, shortArea, useIsMobile, useTicker, vendorPhoto, vendorRating } from "./kit";

/** True from 1024 px up, where the Maps tab shows the list and the map side by side (W21). */
function useIsWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => { const query = window.matchMedia("(min-width: 1024px)"); const update = () => setWide(query.matches); update(); query.addEventListener("change", update); return () => query.removeEventListener("change", update); }, []);
  return wide;
}

type Coords = { latitude?: number; longitude?: number; address?: string };

export function vendorDistanceKm(profile: Coords, vendor: Vendor) {
  return haversineKm(profile.latitude, profile.longitude, vendor.latitude, vendor.longitude);
}

/* ---------- Marketplace sections ---------- */

const GROUP_ICON: Record<string, ComponentType<{ className?: string }>> = {
  "Ready to Cook": Soup, Meals: BowlFood, "Meat & Seafood": Fish, "Vegetables & Fruits": Carrot, "Grocery & Staples": Basket,
  "Bakery & Desserts": Croissant, "Home Foods": ChefHat, "Beverages & Dairy": Drop, Snacks: Cookie, "Premium & Artisan": Sparkles,
};

export function CategoryGrid({ selected, onSelect }: { selected: string; onSelect: (key: string) => void }) {
  return <section data-tour="categories" aria-label="Browse categories" className="sh k-chips">
    {MARKET_GROUPS.map((group) => {
      const active = selected === group.key;
      const Icon = GROUP_ICON[group.key] ?? Sparkles;
      return <button key={group.key} type="button" aria-label={group.key} aria-pressed={active} onClick={() => onSelect(active ? "All" : group.key)} className={`chip${active ? " on" : ""}`}><Icon className="size-5" />{group.key}</button>;
    })}
  </section>;
}

export function PromoBanner({ onShop }: { onShop: () => void }) {
  return <div className="sh"><section className="promo k-promo" style={{ padding: "18px 22px" }}>
    <div className="col" style={{ gap: 6 }}>
      <span className="pill dark" style={{ width: "max-content" }}><Zap className="size-4" />Food Drops</span>
      <h2 className="h2" style={{ fontSize: 24 }}>Tonight 8 PM to midnight</h2>
      <div className="s">Surplus meals from nearby kitchens at up to 50% off</div>
      <button type="button" onClick={onShop} className="btn xs dark" style={{ width: "max-content", marginTop: 6 }}>See today&apos;s drops</button>
    </div>
    <div className="k-promo-ic"><Zap className="size-10" /></div>
  </section></div>;
}

export function VendorMiniCard({ state, vendor, profile, onOpen }: { state: V3State; vendor: Vendor; profile: Coords; onOpen: (id: string) => void }) {
  const rating = vendorRating(state, vendor.id); const distance = vendorDistanceKm(profile, vendor);
  return <button type="button" onClick={() => onOpen(vendor.id)} aria-label={`Open ${vendor.businessName}`} className="sh k-kcard snap-start text-left">
    <PhotoTile imageUrl={vendorPhoto(state, vendor)} category={vendor.category} className="k-kimg" emojiSize={42} />
    <span className="rate k-krate"><Star className="size-4" />{rating ? rating.average.toFixed(1) : "New"}</span>
    <div className="k-kbody"><div className="h4" style={{ fontSize: 16 }}>{vendor.businessName}</div>
      <div className="s m row g4" style={{ marginTop: 2 }}><MapPin className="size-4" />{distance !== null ? `${distance.toFixed(1)} km` : vendor.category}</div></div>
  </button>;
}

export function VendorRow({ title, vendors, state, profile, onOpen, onSeeAll }: { title: string; vendors: Vendor[]; state: V3State; profile: Coords; onOpen: (id: string) => void; onSeeAll?: () => void }) {
  if (!vendors.length) return null;
  return <section><SectionHeader title={title} action={onSeeAll ? "See all" : undefined} onAction={onSeeAll} />
    <div className="-mx-1 mt-3 flex snap-x gap-3 overflow-x-auto px-1 pb-2 hide-scrollbar">{vendors.map((vendor) => <VendorMiniCard key={vendor.id} state={state} vendor={vendor} profile={profile} onOpen={onOpen} />)}</div>
  </section>;
}

/* ---------- Vendor list card (Maps tab) ---------- */

export function VendorCard({ state, vendor, profile, onOpen, compact = false, connectVendor, onContact, contactPending = false, contactSource = "map" }: { state: V3State; vendor: Vendor; profile: Coords; onOpen: (id: string) => void; compact?: boolean; connectVendor?: ConnectVendor; onContact?: (vendor: ConnectVendor, source: WhatsAppClickSource) => void; contactPending?: boolean; contactSource?: WhatsAppClickSource }) {
  const rating = vendorRating(state, vendor.id); const distance = vendorDistanceKm(profile, vendor);
  const connectNumber = connectVendor?.whatsapp_number ? normalizeWhatsAppNumber(connectVendor.whatsapp_number) : null;
  return <div className={`flex items-center gap-3 rounded-[22px] border border-stone-200/70 bg-white p-3 shadow-sm ${compact ? "" : "sm:p-4"}`}>
    <PhotoTile imageUrl={vendorPhoto(state, vendor)} category={vendor.category} className="size-[72px] shrink-0 rounded-2xl" emojiSize={30} />
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5"><span className="truncate font-black">{vendor.businessName}</span>{vendor.verification === "Verified" && <BadgeCheck className="size-4 shrink-0 text-emerald-600" aria-label="Verified" />}</div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs font-bold text-stone-500">{rating ? <span className="flex items-center gap-1 text-amber-600"><Stars value={rating.average} size={12} />{rating.average.toFixed(1)} <span className="text-stone-400">({rating.count})</span></span> : <span>New on ShePlates</span>}{distance !== null && <span>· {distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}</span>}<span>· {shortArea(vendor.address)}</span></div>
      <div className="mt-1.5 flex flex-wrap gap-1.5"><span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600">{vendor.category}</span>{vendor.delivery && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600">Delivery</span>}{vendor.pickup && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600">Pickup</span>}</div>
    </div>
    <div className="flex shrink-0 flex-col items-end gap-2">{vendor.openToday ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">Open Now</span> : <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-black text-stone-500">Closed</span>}
      <div className="flex items-center gap-2">
        {connectVendor && connectNumber && onContact && <button type="button" disabled={contactPending} onClick={() => onContact(connectVendor, contactSource)} className="inline-flex items-center gap-1 rounded-full bg-[#753b50] px-3 py-1.5 text-xs font-black text-white disabled:opacity-60"><MessageCircle className="size-3" />{contactPending ? "Opening…" : "WhatsApp"}</button>}
        <button type="button" onClick={() => onOpen(vendor.id)} className="rounded-full bg-[#753b50] px-4 py-1.5 text-xs font-black text-white transition hover:bg-[#753b50]">View</button>
      </div></div>
  </div>;
}

function ConnectVendorCard({ vendor, selected, onSelect }: { vendor: ConnectVendor; selected: boolean; onSelect: () => void }) {
  return <button type="button" onClick={onSelect} aria-pressed={selected} className={`flex w-full items-center gap-3 rounded-[22px] border bg-white p-3 text-left shadow-sm transition sm:p-4 ${selected ? "border-[#753b50] ring-2 ring-[#e8cbd5]" : "border-stone-200/70 hover:border-[#e8cbd5]"}`}>
    <PhotoTile imageUrl={vendor.logo_url} category={vendor.category} className="size-[72px] shrink-0 rounded-2xl" emojiSize={30} />
    <span className="min-w-0 flex-1">
      <span className="block truncate font-black">{vendor.vendor_name}</span>
      <span className="mt-0.5 block truncate text-xs font-bold text-stone-500">{vendor.category} · {vendor.distance_km.toFixed(1)} km</span>
      <span className="mt-1 block truncate text-xs text-stone-500">{vendor.locality || vendor.address || "Address unavailable"}</span>
    </span>
  </button>;
}

function ConnectVendorDetails({ vendor, onContact, contactPending, source }: {
  vendor: ConnectVendor;
  onContact: (vendor: ConnectVendor, source: WhatsAppClickSource) => void;
  contactPending: boolean;
  source: WhatsAppClickSource;
}) {
  const whatsappNumber = vendor.whatsapp_number
    ? normalizeWhatsAppNumber(vendor.whatsapp_number)
    : null;
  const durationHours = vendor.operating_hours?.duration_hours;
  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber.slice(1)}?text=${encodeURIComponent(`Hi ${vendor.vendor_name}, I found your business on ShePlates and would like to enquire.`)}`
    : null;
  return <section data-testid="connect-vendor-details" aria-label={`${vendor.vendor_name} details`} className="rounded-3xl bg-white p-4 ring-2 ring-[#753b50] sm:p-5">
    <div className="flex items-start gap-3">
      <PhotoTile imageUrl={vendor.logo_url} category={vendor.category} className="size-16 shrink-0 rounded-2xl" emojiSize={28} />
      <div className="min-w-0 flex-1">
        <h2 className="font-black">{vendor.vendor_name}</h2>
        <p className="mt-0.5 text-xs font-bold text-stone-500">{vendor.category} · {vendor.distance_km.toFixed(1)} km away</p>
        <p className="mt-1 text-xs text-stone-500">{vendor.address || vendor.locality || "Address unavailable"}</p>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap gap-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf5ec] px-3 py-1 text-xs font-semibold text-[#21683b]"><BadgeCheck className="size-4" />Verified by ShePlates</span>{typeof durationHours === "number" && Number.isFinite(durationHours) && <span className="rounded-full bg-[#faf6f4] px-3 py-1 text-xs font-semibold">Open about {durationHours} hours a day</span>}</div>
    {vendor.description && <p className="mt-3 text-sm leading-6 text-stone-600">{vendor.description}</p>}
    {typeof durationHours === "number" && Number.isFinite(durationHours) && <p className="mt-2 text-xs text-stone-500">Operating duration: {durationHours} hours (schedule not specified)</p>}
    {whatsappUrl && <button type="button" disabled={contactPending} onClick={() => onContact(vendor, source)} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 py-2.5 text-[15px] font-bold text-[#292124] transition hover:bg-[#1fb957] disabled:cursor-wait disabled:opacity-70"><MessageCircle className="size-5" />{contactPending ? "Opening WhatsApp…" : "Contact on WhatsApp"}</button>}
    <p className="mt-3 rounded-2xl bg-[#edf3fd] p-3 text-xs font-medium text-[#285fba]">This kitchen takes orders directly on WhatsApp. These orders are arranged with the kitchen and are not paid through ShePlates.</p>
  </section>;
}

/* ---------- Maps tab ---------- */

type MapTab = "Nearby" | "Following" | "Trending" | "Shorts" | "People";
const MAP_TABS = ["Nearby", "Following", "Trending", "Shorts", "People"] as const;
const PEOPLE_FILTERS = ["Everyone", "Following", "With status"] as const;
type PeopleFilter = (typeof PEOPLE_FILTERS)[number];

function LazyMap(props: React.ComponentProps<typeof NearbyVendorsMapComponent>) {
  const [Component, setComponent] = useState<typeof NearbyVendorsMapComponent | null>(null);
  useEffect(() => { let alive = true; import("@/components/nearby-vendors-map").then((mod) => { if (alive) setComponent(() => mod.NearbyVendorsMap); }); return () => { alive = false; }; }, []);
  if (!Component) return <div className="grid h-[330px] place-items-center md:h-[460px] rounded-[26px] border border-stone-200/70 bg-stone-50 text-sm text-stone-400">Loading map…</div>;
  return <Component {...props} />;
}

export function MapsTab({ state, profile, social, shorts, people, peopleRadius, onPeopleRadius, onOpenShorts, locationConfirmed, onOpenVendor, onConfirmLocation, initialTab }: {
  initialTab?: "People";
  shorts: ShortsApi; people: PeopleApi; peopleRadius: number; onPeopleRadius: (km: number) => void; onOpenShorts: (list: FoodShort[], index: number) => void;
  state: V3State; profile: Coords; social: SocialApi; locationConfirmed: boolean;
  onOpenVendor: (id: string) => void; onConfirmLocation: () => void;
}) {
  const [tab, setTab] = useState<MapTab>(initialTab ?? "Nearby");
  const [view, setView] = useState<"map" | "list">("map");
  const [vendorRadius, setVendorRadius] = useState(10);
  const [radiusLoaded, setRadiusLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [peopleFilter, setPeopleFilter] = useState<PeopleFilter>("Everyone");
  const [pendingWhatsAppVendorId, setPendingWhatsAppVendorId] = useState<string | null>(null);
  const whatsappClickLocks = useRef(new Set<string>());
  const mobile = useIsMobile();
  const wide = useIsWide();
  const onPeople = tab === "People";
  const [connectLoad, setConnectLoad] = useState<
    | { locationKey: string; status: "loading" }
    | { locationKey: string; status: "loaded"; vendors: ConnectVendor[] }
    | { locationKey: string; status: "error"; error: string }
    | null
  >(null);
  // Direct-contact (WhatsApp) vendors come from the live database; demo mode has none and should not show an error for that.
  const locationKey = isLiveSupabaseMode() && locationConfirmed &&
    Number.isFinite(profile.latitude) &&
    Number.isFinite(profile.longitude)
    ? `${profile.latitude}:${profile.longitude}`
    : null;
  const currentConnectLoad = connectLoad?.locationKey === locationKey ? connectLoad : null;
  const connectVendors = currentConnectLoad?.status === "loaded" ? currentConnectLoad.vendors : [];
  const connectLoading = Boolean(locationKey && (!currentConnectLoad || currentConnectLoad.status === "loading"));
  const connectError = currentConnectLoad?.status === "error" ? currentConnectLoad.error : null;
  useEffect(() => {
    if (!locationKey) return;
    const requestLocationKey = locationKey;

    let cancelled = false;

    async function loadConnectVendors() {
      setConnectLoad({ locationKey: requestLocationKey, status: "loading" });

      try {
        const vendors = await loadConnectVendorsNearby(
          profile.latitude!,
          profile.longitude!
        );

        if (!cancelled) {
          setConnectLoad({ locationKey: requestLocationKey, status: "loaded", vendors });
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Unable to load Connect vendors:", error);
          setConnectLoad({
            locationKey: requestLocationKey,
            status: "error",
            error: "Connect vendors are temporarily unavailable.",
          });
        }
      }
    }

    void loadConnectVendors();

    return () => {
      cancelled = true;
    };
  }, [locationKey, profile.latitude, profile.longitude]);
  // Restore the saved vendor radius when the Maps tab mounts.
  useEffect(() => {
    try {
      const savedRadius = localStorage.getItem("sheplates-map-vendor-radius-km");

      if (savedRadius !== null) {
        const parsedRadius = Number(savedRadius);

        if (Number.isFinite(parsedRadius) && parsedRadius > 0) {
          queueMicrotask(() => setVendorRadius(parsedRadius));
        }
      }
    } catch (error) {
      console.error("Could not restore map radius:", error);
    } finally {
      setRadiusLoaded(true);
    }
  }, []);

  // Save only after restoring the saved value, so the default doesn't overwrite it.
  useEffect(() => {
    if (!radiusLoaded) return;

    try {
      localStorage.setItem("sheplates-map-vendor-radius-km", String(vendorRadius));
    } catch (error) {
      console.error("Could not save map radius:", error);
    }
  }, [vendorRadius, radiusLoaded]);

  const radius = onPeople ? peopleRadius : vendorRadius;
  const setRadius = onPeople ? onPeopleRadius : setVendorRadius;

  // Shorts the customer may see inside the map radius, grouped by vendor (the data layer already applies each vendor's own reach)
  const shortsByVendor = useMemo(() => {
    const map = new Map<string, FoodShort[]>();
    for (const s of shorts.nearby(vendorRadius)) map.set(s.vendorId, [...(map.get(s.vendorId) || []), s]);
    return map;
  }, [shorts, vendorRadius]);

  const rows = useMemo(() => {
    const activity = (vendorId: string) => (shortsByVendor.get(vendorId)?.length || 0) * 2 + state.foodDrops.filter((d) => d.vendorId === vendorId && dropDisplayStatus(d) === "live").length * 3 + state.orders.filter((o) => o.vendorId === vendorId).length * 0.2;
    let vendors = state.vendors.filter((v) => Number.isFinite(v.latitude) && Number.isFinite(v.longitude));
    const q = query.trim().toLowerCase(); if (q) vendors = vendors.filter((v) => `${v.businessName} ${v.category}`.toLowerCase().includes(q));
    if (tab === "Following") vendors = vendors.filter((v) => social.followed.includes(v.id));
    if (tab === "Shorts") vendors = vendors.filter((v) => shortsByVendor.has(v.id));
    if (onPeople) vendors = [];
    const withDistance = vendors.map((vendor) => ({ vendor, distance: vendorDistanceKm(profile, vendor) ?? 0 }));
    const inRange = withDistance.filter((r) => tab === "Following" || r.distance <= vendorRadius);
    const ordered = tab === "Trending"
      ? inRange.sort((a, b) => activity(b.vendor.id) - activity(a.vendor.id))
      : inRange.sort((a, b) => a.distance - b.distance);
    return uniqueById(ordered, (row) => row.vendor.id);
  }, [state.vendors, state.foodDrops, state.orders, social.followed, tab, query, vendorRadius, onPeople, profile, shortsByVendor]);

  // People who chose to be on the map, inside the radius (the database already limits what it returns)
  const peopleQuery = usePeopleQuery(() => people.nearby(peopleRadius, query), [peopleRadius, query, people.mode, people.hasPin, locationConfirmed], onPeople && locationConfirmed && people.hasPin);
  const nearbyPeople = useMemo(() => peopleQuery.rows
    .map((p) => ({ ...p, following: people.followingIds.has(p.id), requested: people.requestedIds.has(p.id) }))
    .filter((p) => peopleFilter === "Everyone" || (peopleFilter === "Following" ? p.following : Boolean(p.hasStatus))), [peopleQuery.rows, people.followingIds, people.requestedIds, peopleFilter]);
  const selectedPerson = nearbyPeople.find((p) => p.id === selectedId) || nearbyPeople[0];

  const existingMapVendors: MapVendor[] = rows.map(({ vendor, distance }) => ({
    id: vendor.id,
    name: vendor.businessName,
    lat: vendor.latitude!,
    lng: vendor.longitude!,
    distanceKm: distance,
    verified: vendor.verification === "Verified",
    emoji: categoryEmoji(vendor.category),
    photoUrl: vendorPhoto(state, vendor),
    kind: "vendor",
    shortCount: shortsByVendor.get(vendor.id)?.length || 0,
  }));

  const connectRows = uniqueById(connectVendors.filter((vendor) => {
    if (tab !== "Nearby" ||
      !Number.isFinite(vendor.latitude) ||
      !Number.isFinite(vendor.longitude) ||
      vendor.latitude < -90 ||
      vendor.latitude > 90 ||
      vendor.longitude < -180 ||
      vendor.longitude > 180 ||
      !Number.isFinite(vendor.distance_km) ||
      vendor.distance_km < 0 ||
      !Number.isFinite(vendor.service_radius_km) ||
      vendor.service_radius_km < 0 ||
      vendor.distance_km > vendor.service_radius_km ||
      vendor.distance_km > vendorRadius ||
      !vendor.vendor_id.trim()) return false;
    const q = query.trim().toLowerCase();
    return !q || `${vendor.vendor_name} ${vendor.category} ${vendor.locality} ${vendor.address || ""}`.toLowerCase().includes(q);
  }), (vendor) => vendor.vendor_id);
  const connectMapVendors: MapVendor[] = connectRows.map((vendor) => ({
      id: vendor.vendor_id,
      name: vendor.vendor_name,
      lat: vendor.latitude,
      lng: vendor.longitude,
      distanceKm: vendor.distance_km,
      verified: true,
      emoji: categoryEmoji(vendor.category),
      photoUrl: vendor.logo_url || undefined,
      kind: "vendor",
    }));

  // Marketplace data remains authoritative for overlapping pins and product
  // cards; Connect contributes an action only when its eligible RPC row exists.
  const mapVendors: MapVendor[] =
    tab === "People"
      ? []
      : mergeMarketplaceAndConnectPins(existingMapVendors, connectMapVendors);
  const selectedMapVendor = mapVendors.find((vendor) => vendor.id === selectedId) || mapVendors[0];
  const selectedMarketplaceVendor = selectedMapVendor && rows.find((row) => row.vendor.id === selectedMapVendor.id);
  const selectedConnectVendor = selectedMapVendor && connectRows.find((vendor) => vendor.vendor_id === selectedMapVendor.id);
  async function contactConnectVendor(vendor: ConnectVendor, source: WhatsAppClickSource) {
    if (whatsappClickLocks.current.has(vendor.vendor_id)) return;
    const normalizedNumber = vendor.whatsapp_number
      ? normalizeWhatsAppNumber(vendor.whatsapp_number)
      : null;
    if (!normalizedNumber) {
      toast.error("This vendor does not have a valid WhatsApp number.");
      return;
    }
    const message = `Hi ${vendor.vendor_name}, I found your business on ShePlates and would like to enquire.`;
    const whatsappUrl = `https://wa.me/${normalizedNumber.slice(1)}?text=${encodeURIComponent(message)}`;
    const destination = window.open("about:blank", "_blank");
    if (!destination) {
      toast.error("Allow pop-ups to open WhatsApp for this vendor.");
      return;
    }

    destination.opener = null;
    whatsappClickLocks.current.add(vendor.vendor_id);
    setPendingWhatsAppVendorId(vendor.vendor_id);
    try {
      await trackLiveVendorWhatsAppClick(vendor.vendor_id, source);
    } catch (error) {
      console.error("Unable to record WhatsApp contact click:", error);
      toast.error("WhatsApp will open, but this contact click could not be recorded.");
    } finally {
      if (!destination.closed) {
        destination.location.replace(whatsappUrl);
      } else {
        window.location.assign(whatsappUrl);
      }
      whatsappClickLocks.current.delete(vendor.vendor_id);
      setPendingWhatsAppVendorId((current) => current === vendor.vendor_id ? null : current);
    }
  }
  const mapPeople: MapPerson[] | undefined = onPeople ? nearbyPeople.flatMap((p) => (p.pin ? [{ id: p.id, handle: p.handle, lat: p.pin.lat, lng: p.pin.lng, distanceKm: p.distanceKm ?? 0, following: p.following, hasStatus: p.hasStatus }] : [])) : undefined;

  if (!locationConfirmed) return <EmptyState emoji="📍" title="Confirm your location to see the map" body="We match vendors to your exact delivery pin, so the map only appears once it's set." action={<button type="button" onClick={onConfirmLocation} className="rounded-full bg-[#753b50] px-5 py-2 text-sm font-black text-white">Set my location</button>} />;

  return <div className={wide ? "k-maps space-y-4" : "space-y-4"}>
    <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3.5 py-3 shadow-sm"><Search className="size-4 text-stone-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={onPeople ? "Search people on the map by handle" : "Search vendors on the map"} aria-label={onPeople ? "Search people on the map" : "Search vendors on the map"} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></div>
    <SegTabs tabs={MAP_TABS} value={tab} onChange={(next) => { setTab(next); setSelectedId(""); }} />
    {onPeople && <div className="space-y-2">
      <PeopleDistanceChips value={peopleRadius} onChange={onPeopleRadius} />
      <div role="tablist" aria-label="Who to show" className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">{PEOPLE_FILTERS.map((f) => <button key={f} role="tab" type="button" aria-selected={f === peopleFilter} onClick={() => setPeopleFilter(f)} className={`shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-bold transition ${f === peopleFilter ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white text-stone-600 hover:border-stone-400"}`}>{f}</button>)}</div>
    </div>}
    {(view === "map" || wide) && <div className="k-maps-map overflow-hidden rounded-[28px]">
      <LazyMap customerLat={profile.latitude!} customerLng={profile.longitude!} vendors={mapVendors} radiusKm={radius} onRadiusChange={setRadius} height={mobile ? 330 : 460} photoPins selectedId={selectedMapVendor?.id} onPinClick={setSelectedId}
        people={mapPeople} selectedPersonId={selectedPerson?.id} onPersonClick={setSelectedId} />
    </div>}
    {(view === "list" || wide) && (onPeople ? <div className="space-y-2" data-testid="people-list">{nearbyPeople.map((p) => <PersonRow key={p.id} person={p} selected={p.id === selectedPerson?.id} onSelect={() => setSelectedId(p.id)} onFollow={people.follow} onUnfollow={people.unfollow} />)}</div>
      : <div className="space-y-3">{rows.map((r) => {
        const connectVendor = connectRows.find((item) => item.vendor_id === r.vendor.id);
        return <VendorCard key={r.vendor.id} state={state} vendor={r.vendor} profile={profile} onOpen={onOpenVendor} connectVendor={connectVendor} onContact={contactConnectVendor} contactPending={pendingWhatsAppVendorId === r.vendor.id} contactSource="search" />;
      })}{connectRows.filter((vendor) => !rows.some((row) => row.vendor.id === vendor.vendor_id)).map((vendor) => <ConnectVendorCard key={vendor.vendor_id} vendor={vendor} selected={vendor.vendor_id === selectedId} onSelect={() => setSelectedId(vendor.vendor_id)} />)}</div>)}
    {!onPeople && view === "list" && selectedConnectVendor && <ConnectVendorDetails vendor={selectedConnectVendor} onContact={contactConnectVendor} contactPending={pendingWhatsAppVendorId === selectedConnectVendor.vendor_id} source="search" />}
    {!onPeople && connectLoading && <p role="status" className="text-sm font-bold text-stone-500">Loading nearby direct-contact vendors…</p>}
    {!onPeople && connectError && <p role="alert" className="text-sm font-bold text-red-600">{connectError}</p>}
    {onPeople ? (view === "map" && (selectedPerson ? <PersonRow person={selectedPerson} onFollow={people.follow} onUnfollow={people.unfollow} />
      : peopleQuery.error ? <p role="alert" className="text-sm font-bold text-red-600">{peopleQuery.error}</p>
        : !peopleQuery.loading && <EmptyState emoji="🧭" title={peopleFilter === "Following" ? "Nobody you follow is on the map here" : `Nobody on the map within ${peopleRadius} km`} body="People appear here only when they choose to be on the map. Try a wider distance, or search a handle from Stories." />))
      : view === "map" && (selectedMarketplaceVendor ? <div className="space-y-2"><VendorCard state={state} vendor={selectedMarketplaceVendor.vendor} profile={profile} onOpen={onOpenVendor} connectVendor={selectedConnectVendor} onContact={contactConnectVendor} contactPending={pendingWhatsAppVendorId === selectedMarketplaceVendor.vendor.id} contactSource={query.trim() ? "search" : "map"} />{(() => { const list = shortsByVendor.get(selectedMarketplaceVendor.vendor.id) || []; return list.length ? <button type="button" onClick={() => onOpenShorts(list, 0)} data-testid="watch-shorts" className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#e8cbd5] bg-[#f7edf0] px-4 py-3 text-sm font-black text-[#653046] transition hover:bg-[#f7edf0]">▶ Watch {list.length} Food Short{list.length === 1 ? "" : "s"} from {selectedMarketplaceVendor.vendor.businessName}</button> : null; })()}</div> : selectedConnectVendor ? <ConnectVendorDetails vendor={selectedConnectVendor} onContact={contactConnectVendor} contactPending={pendingWhatsAppVendorId === selectedConnectVendor.vendor_id} source={query.trim() ? "search" : "map"} /> : connectLoading ? null : connectError ? null : <EmptyState emoji={tab === "Following" ? "💛" : tab === "Shorts" ? "🎬" : "🗺️"} title={tab === "Following" ? "You're not following any vendors yet" : tab === "Shorts" ? "No Food Shorts in this range" : "No vendors in this range"} body={tab === "Following" ? "Open a vendor and tap Follow — they'll show up here and in your Following feed." : tab === "Shorts" ? "Vendors with a Food Short that reaches you appear here. Try widening the radius with the + button." : "Try widening the radius with the + button."} />)}
    {onPeople && <p className="px-1 text-[11px] font-bold text-stone-400">Shown to the nearest half kilometre. You appear here only if you switch on “Let people nearby find me” in your profile.</p>}
    {!wide && <div className="flex justify-center"><button type="button" onClick={() => setView((v) => (v === "map" ? "list" : "map"))} className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-2 text-sm font-black shadow-sm transition hover:border-[#e8cbd5]">{view === "map" ? <><List className="size-4" />List ({onPeople ? nearbyPeople.length : mapVendors.length})</> : <><MapPin className="size-4" />Map</>}</button></div>}
  </div>;
}

/* ---------- Food Drops tab ---------- */

type DropScope = "Nearby" | "Following" | "Trending" | "Across City";

/** Live window banner (W17): counts down to midnight IST while Food Drops are open, or to 8 PM otherwise. */
function DropWindowBanner() {
  const now = useTicker();
  const ist = new Date(now + 5.5 * 3600_000);
  const sec = ist.getUTCHours() * 3600 + ist.getUTCMinutes() * 60 + ist.getUTCSeconds();
  const live = sec >= 20 * 3600;
  const remaining = live ? 86400 - sec : 20 * 3600 - sec;
  const clock = [Math.floor(remaining / 3600), Math.floor((remaining % 3600) / 60), remaining % 60].map((n) => String(n).padStart(2, "0")).join(":");
  return <div className="flex items-center justify-between gap-4 rounded-[28px] bg-[#292124] px-6 py-5 text-white"><div><div className="text-xs text-white/80">{live ? "Live now · closes at midnight" : "Opens at 8 PM"}</div><div className="text-[40px] font-bold leading-tight tabular-nums text-[#e8cbd5]" aria-label="Time left">{clock}</div></div><span className="grid size-14 shrink-0 place-items-center rounded-full bg-[#753b50] text-white"><Timer className="size-7" /></span></div>;
}

const DROP_SCOPES = ["Nearby", "Following", "Trending", "Across City"] as const;

function dropTag(drop: FoodDrop) {
  const text = `${drop.title} ${drop.description || ""}`;
  if (/blemish/i.test(text)) return "Slightly blemished";
  if (/surplus/i.test(text)) return "Surplus";
  return null;
}

function DropCard({ drop, state, profile, onClaim }: { drop: FoodDrop; state: V3State; profile: Coords; onClaim: (drop: FoodDrop, quantity: number) => Promise<void> }) {
  const now = useTicker();
  const [busy, setBusy] = useState(false);
  const product = state.products.find((p) => p.id === drop.productId); const vendor = state.vendors.find((v) => v.id === drop.vendorId);
  const distance = vendor ? vendorDistanceKm(profile, vendor) : null; const tag = dropTag(drop);
  const status = dropDisplayStatus(drop, new Date(now));
  const schedule = foodDropSchedule(drop);
  const left = drop.remainingQuantity; const urgent = schedule.endsAt.getTime() - now < 3_600_000;
  return <article className="overflow-hidden rounded-[26px] border border-stone-200/70 bg-white shadow-sm">
    <PhotoTile imageUrl={product?.imageUrl} category={product?.category} className="h-48 sm:h-52" emojiSize={64}>
      <span className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-black text-white shadow-lg ${status === "live" && urgent ? "bg-[#753b50]" : "bg-[#292124]/85"}`}><Timer className="size-3.5" /><span>{status === "live" ? <><span className="block text-[9px] font-bold uppercase leading-none opacity-80">LIVE · Closes in</span>{formatCountdown(schedule.endsAt.toISOString(), new Date(now))}</> : <><span className="block text-[9px] font-bold uppercase leading-none opacity-80">Scheduled</span>Starts at 8:00 PM</>}</span></span>
      {tag && <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-black text-[#653046] shadow">{tag}</span>}
      <span className="absolute bottom-3 right-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-black text-[#653046] shadow">{discountPercent(drop)}% off</span>
    </PhotoTile>
    <div className="p-4"><h3 className="font-black leading-snug">{drop.title}</h3>
      <p className="mt-0.5 text-xs font-bold text-stone-500">{vendor?.businessName || "Local vendor"}{distance !== null ? ` · ${distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}` : ""}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div><div className="flex items-baseline gap-2"><span className="text-xl font-black">{money(drop.dropPrice)}</span><span className="text-xs font-bold text-stone-400 line-through">{money(drop.originalPrice)}</span></div><div className="mt-0.5 text-xs font-bold text-stone-500">{left} pack{left === 1 ? "" : "s"} left</div></div>
        <button type="button" disabled={busy || left <= 0 || status !== "live"} onClick={async () => { setBusy(true); try { await onClaim(drop, 1); } finally { setBusy(false); } }} className="rounded-full bg-[#753b50] px-6 py-2.5 text-sm font-black text-white shadow-[0_10px_24px_rgba(224,25,79,.3)] transition hover:bg-[#753b50] disabled:opacity-50">{busy ? "Adding…" : status === "live" ? "Add +" : "Available at 8 PM"}</button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-[#753b50]" style={{ width: `${claimedPercent(drop)}%` }} /></div>
    </div>
  </article>;
}

export function FoodDropsTab({ state, profile, social, onClaim, onRefresh }: { state: V3State; profile: Coords; social: SocialApi; onClaim: (drop: FoodDrop, quantity: number) => Promise<void>; onRefresh: () => void }) {
  const [scope, setScope] = useState<DropScope>("Nearby");
  useEffect(() => { onRefresh(); const id = window.setInterval(onRefresh, 30_000); return () => window.clearInterval(id); }, [onRefresh]);
  const drops = useMemo(() => {
    const live = state.foodDrops.filter((d) => ["live", "scheduled"].includes(dropDisplayStatus(d)));
    const known = (d: FoodDrop) => state.vendors.find((v) => v.id === d.vendorId);
    const km = (d: FoodDrop) => { const v = known(d); return v ? vendorDistanceKm(profile, v) ?? 99 : 99; };
    if (scope === "Nearby") return live.filter((d) => known(d) && km(d) <= 8).sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime());
    if (scope === "Following") return live.filter((d) => social.followed.includes(d.vendorId));
    if (scope === "Trending") return [...live].sort((a, b) => claimedPercent(b) - claimedPercent(a) || a.remainingQuantity - b.remainingQuantity);
    return [...live].sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime());
  }, [state.foodDrops, state.vendors, scope, social.followed, profile]);
  return <div className="space-y-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div><h1 className="text-[28px] font-bold leading-tight">Food Drops</h1><p className="mt-1 text-sm text-[#71676b]">Surplus and limited batches from kitchens you can reach, every evening from 8 PM to midnight.</p></div>
      <span className="inline-flex w-max items-center gap-2 rounded-full bg-[#f7edf0] px-3 py-1.5 text-xs font-semibold text-[#653046]"><span className="size-2 rounded-full bg-[#753b50]" />8 PM to midnight</span>
    </div>
    <DropWindowBanner />
    <SegTabs tabs={DROP_SCOPES} value={scope} onChange={setScope} />
    {drops.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{drops.map((drop) => <DropCard key={drop.id} drop={drop} state={state} profile={profile} onClaim={onClaim} />)}</div>
      : <EmptyState emoji={scope === "Following" ? "💛" : "⚡"} title={scope === "Following" ? "No drops from vendors you follow" : "No drops here right now"} body={scope === "Following" ? "Follow vendors from their profile and their drops land here first." : "Vendors post drops when they have surplus or a limited batch. Check back soon, or try Across City."} />}
    <div className="flex items-start gap-3 rounded-3xl bg-[#FFF4CF] p-4 text-sm font-medium text-[#795900]"><Info className="mt-0.5 size-5 shrink-0" />A Food Drop can be claimed only on the evening it is created, between 8 PM and midnight IST.</div>
  </div>;
}

/* ---------- Schedules tab ---------- */


export function SchedulesTab({
  initial,
  orders,
  subscriptions,
}: {
  initial: "Orders" | "Subscriptions";
  orders: React.ReactNode;
  subscriptions: React.ReactNode;
}) {
  // Orders and Schedules are separate pages in the menu (W14 / W16), so each shows only its own content.
  return <>{initial === "Orders" ? orders : subscriptions}</>;
}
