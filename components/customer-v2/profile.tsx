"use client";
// Public social profile + account hub (Profile tab), and the public vendor
// profile that opens from vendor cards across the app.
import { useState } from "react";
import type * as React from "react";
import Image from "next/image";
import { BadgeCheck, CalendarDays, ChevronRight, ClipboardCheck, Heart, HelpCircle, ListChecks, LogOut, Package, ShoppingCart, TicketCheck, UserRound, Zap, FileText, MapPin } from "@/components/icons";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { claimedPercent, discountPercent, dropDisplayStatus, foodDropSchedule, formatCountdown, type FoodDrop } from "@/lib/food-drops";
import type { Product, V3State } from "@/components/sheplates-v3";
import type { SocialApi } from "@/lib/social";
import { Avatar, EmptyState, PhotoTile, SegTabs, Stars, money, priceOf, shortArea, useTicker, vendorPhoto, vendorRating } from "./kit";
import { vendorDistanceKm } from "./discover";
import type { FoodShort } from "@/lib/food-shorts";
import { ShortThumb } from "./shorts";
import { DiscoverCard, FollowListDialog, FollowRequestsPanel } from "./people";
import type { PeopleApi } from "@/lib/people";
import type { StatusesApi } from "@/lib/statuses";

type Coords = { latitude?: number; longitude?: number; address?: string };
function EditProfileDialog({ open, onClose, social, name }: { open: boolean; onClose: () => void; social: SocialApi; name: string }) {
  const [handle, setHandle] = useState(social.profile.handle); const [bio, setBio] = useState(social.profile.bio); const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try { await social.saveProfile({ handle, bio }); toast.success("Profile updated"); onClose(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Profile could not be saved"); } finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={(v) => !v && onClose()}><DialogContent className="rounded-[28px] sm:max-w-md">
    <DialogHeader><DialogTitle className="text-lg font-black">Edit profile</DialogTitle><DialogDescription>Only your name, handle and bio are public. Diet, allergies and addresses never appear here.</DialogDescription></DialogHeader>
    <div className="flex items-center gap-3"><Avatar name={name} size={56} /><div className="text-sm font-black">{name}</div></div>
    <label className="block text-xs font-black uppercase tracking-[.1em] text-stone-500">Handle<div className="mt-1.5 flex items-center rounded-xl border border-stone-200 px-3 focus-within:border-[#753b50]"><span className="text-stone-400">@</span><input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} maxLength={24} aria-label="Handle" className="h-11 min-w-0 flex-1 bg-transparent px-1 text-sm font-bold normal-case tracking-normal text-stone-800 outline-none" /></div></label>
    <label className="block text-xs font-black uppercase tracking-[.1em] text-stone-500">Bio<textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} rows={3} aria-label="Bio" placeholder="Exploring local food & home kitchens" className="mt-1.5 w-full rounded-xl border border-stone-200 p-3 text-sm font-medium normal-case tracking-normal text-stone-800 outline-none focus:border-[#753b50]" /><span className="mt-1 block text-right text-[10px] font-bold text-stone-400">{bio.length}/160</span></label>
    <button type="button" disabled={busy} onClick={() => void save()} className="h-12 w-full rounded-full bg-[#753b50] font-black text-white disabled:opacity-50">{busy ? "Saving…" : "Save changes"}</button>
  </DialogContent></Dialog>;
}

export function ProfileTab({ session, state, setState, social, people, statuses, onNavigate, onSetLocation, onOpenVendor, onReplayTour, onSignOut }: {
  session: { name: string; email: string }; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>>; social: SocialApi; people: PeopleApi; statuses: StatusesApi; onNavigate: (label: string) => void; onSetLocation: () => void; onOpenVendor: (vendorId: string) => void; onReplayTour: () => void; onSignOut: () => void;
}) {
  const [editing, setEditing] = useState(false); const [list, setList] = useState<null | "followers" | "following">(null); const [vendorListOpen, setVendorListOpen] = useState(false); const [privacyBusy, setPrivacyBusy] = useState(false);
  const customer = state.customers.find((c) => c.email === session.email);
  async function setAccountPrivacy(privateAccount: boolean) {
    setPrivacyBusy(true);
    try {
      await people.setPrivateAccount(privateAccount);
      setState((current) => ({ ...current, customers: current.customers.map((item) => item.email === session.email ? { ...item, privateAccount } : item) }));
      toast.success(privateAccount ? "Private account enabled" : "Public account enabled");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Account privacy could not be updated"); }
    finally { setPrivacyBusy(false); }
  }
  const myReviews = state.reviews.filter((r) => r.customerEmail === session.email);
  const links: [string, React.ComponentType<{ className?: string }>][] = [["Wishlist", Heart], ["Profile & food", UserRound], ["Orders", Package], ["My schedule", CalendarDays], ["Food Drops", Zap], ["My quotations", ClipboardCheck], ["Monthly requirement", ListChecks], ["Ticket centre", TicketCheck]];
  const active = statuses.mine.length;
  return <div className="mx-auto max-w-3xl space-y-5">
    <section className="k-prof">
      <div className="k-prof-head"><Avatar name={session.name} size={96} ring />
        <div className="min-w-0 flex-1"><h1 className="truncate text-[22px] font-bold">{session.name}</h1><div className="text-sm text-[#71676b]">@{social.profile.handle} · {session.email}</div>
          <div className="mt-1 text-xs font-bold text-stone-500">{shortArea(customer?.address)}</div></div></div>
      <p className="mt-3 text-sm leading-6 text-stone-600">{social.profile.bio || "Add a bio so neighbours know what you love to eat."}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2" data-testid="profile-stats">
        <section className="rounded-2xl bg-stone-50 p-3" aria-label="People followers and following"><h2 className="px-1 text-[10px] font-black uppercase tracking-[.12em] text-stone-400">People</h2><div className="mt-1 grid grid-cols-3 gap-1 text-center">
          <button type="button" onClick={() => setList("followers")} className="rounded-xl py-1 transition hover:bg-white" aria-label={`People followers ${people.followCounts.followers}`}><div className="text-lg font-black">{people.followCounts.followers}</div><div className="text-[11px] font-bold text-stone-500">Followers</div></button>
          <button type="button" onClick={() => setList("following")} className="rounded-xl py-1 transition hover:bg-white" aria-label={`People following ${people.followCounts.following}`}><div className="text-lg font-black">{people.followCounts.following}</div><div className="text-[11px] font-bold text-stone-500">Following</div></button>
          <button type="button" onClick={() => onNavigate("Orders")} className="rounded-xl py-1 transition hover:bg-white" aria-label={`Orders ${state.orders.filter((o) => o.customerEmail === session.email).length}`}><div className="text-lg font-black">{state.orders.filter((o) => o.customerEmail === session.email).length}</div><div className="text-[11px] font-bold text-stone-500">Orders</div></button>
        </div></section>
        <section className="rounded-2xl bg-stone-50 p-3" aria-label="Vendors you follow"><h2 className="px-1 text-[10px] font-black uppercase tracking-[.12em] text-stone-400">Vendors</h2><button type="button" onClick={() => setVendorListOpen(true)} className="mt-1 w-full rounded-xl py-1 text-center transition hover:bg-white" aria-label={`Vendors following ${social.followed.length}`}><div className="text-lg font-black">{social.followed.length}</div><div className="text-[11px] font-bold text-stone-500">Vendors I follow</div></button></section>
      </div>
      <button type="button" onClick={() => setEditing(true)} className="mt-4 h-11 w-full rounded-xl border border-stone-300 text-sm font-black transition hover:border-[#753b50] hover:text-[#653046]">Edit Profile</button>
    </section>
    <section className="k-rowcard" aria-label="Account privacy">
      <div className="min-w-0"><h2 className="text-sm font-black">{people.privateAccount ? "Private account" : "Public account"}</h2><p className="mt-1 text-xs leading-5 text-stone-500">{people.privateAccount ? "People must request to follow you. You approve each request." : "Other customers can follow you without approval."}</p></div>
      <button type="button" role="switch" aria-label="Private account" aria-checked={people.privateAccount} disabled={privacyBusy} onClick={() => void setAccountPrivacy(!people.privateAccount)} className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-60 ${people.privateAccount ? "bg-[#753b50]" : "bg-stone-300"}`}><span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${people.privateAccount ? "left-[22px]" : "left-0.5"}`} /></button>
    </section>
    <FollowRequestsPanel people={people} />
    <section className="k-rowcard" aria-label="Your status">
      <div className="min-w-0"><h2 className="text-sm font-black">Your status</h2><p className="mt-0.5 text-xs font-bold text-stone-500">{active ? `${active} active. Each disappears after 24 hours.` : "Share a photo or a 30 second video. It disappears after 24 hours."}</p></div>
      <button type="button" onClick={() => onNavigate("Stories")} className="shrink-0 rounded-full bg-[#753b50] px-4 py-2 text-xs font-black text-white">{active ? "View" : "Add status"}</button>
    </section>
    <DiscoverCard people={people} onSetLocation={onSetLocation} />
    {myReviews.length > 0 && <section className="space-y-2" aria-label="My reviews"><h2 className="px-1 text-xs font-black uppercase tracking-[.14em] text-stone-400">My reviews</h2>{myReviews.map((r) => { const product = state.products.find((p) => p.id === r.productId); return <div key={r.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70"><div className="flex items-center justify-between gap-2"><b className="truncate">{product?.name || "Product"}</b><Stars value={r.rating} /></div><p className="mt-1 text-sm text-stone-600">{r.comment || "No written feedback."}</p></div>; })}</section>}
    <section className="k-rows" aria-label="Account">
      {links.map(([label, Icon]) => <button key={label} type="button" onClick={() => onNavigate(label)} className="k-row"><Icon className="size-5" /><span className="grow">{label}</span><ChevronRight className="size-5 text-[#766b70]" /></button>)}
      <button type="button" onClick={() => onNavigate("Cart")} className="k-row"><ShoppingCart className="size-5" /><span className="grow">Cart</span><ChevronRight className="size-5 text-[#766b70]" /></button>
      <button type="button" onClick={onReplayTour} className="k-row"><HelpCircle className="size-5" /><span className="grow">Help · Product tour</span><ChevronRight className="size-5 text-[#766b70]" /></button>
      <div className="k-row"><FileText className="size-5" /><span className="grow">Terms and Conditions · Privacy Policy</span></div>
      <button type="button" onClick={onSignOut} className="k-signout"><LogOut className="size-5" />Sign out</button>
    </section>
    {editing && <EditProfileDialog open onClose={() => setEditing(false)} social={social} name={session.name} />}
    <FollowListDialog open={list !== null} kind={list || "followers"} onClose={() => setList(null)} people={people} />
    <Dialog open={vendorListOpen} onOpenChange={(value) => !value && setVendorListOpen(false)}><DialogContent className="max-h-[85vh] overflow-y-auto rounded-[28px] sm:max-w-md"><DialogHeader><DialogTitle className="text-lg font-black">Vendors I follow</DialogTitle><DialogDescription>The stores you follow on ShePlates appear here.</DialogDescription></DialogHeader>{social.followed.length ? <div className="space-y-2">{social.followed.map((vendorId) => { const vendor = state.vendors.find((item) => item.id === vendorId); if (!vendor) return null; return <button key={vendorId} type="button" onClick={() => { setVendorListOpen(false); onOpenVendor(vendorId); }} className="flex w-full items-center gap-3 rounded-2xl border border-stone-200/70 bg-white p-3 text-left transition hover:bg-stone-50"><span className="grid size-10 place-items-center rounded-xl bg-[#f7edf0] text-sm font-black text-[#653046]">{vendor.businessName.slice(0, 1)}</span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{vendor.businessName}</b><span className="block truncate text-xs text-stone-500">{vendor.category}</span></span><span className="text-xs font-black text-[#653046]">View</span></button>; })}</div> : <EmptyState emoji="🏪" title="No followed vendors yet" body="Open a vendor profile from Marketplace and tap Follow to save a store here." />}</DialogContent></Dialog>
  </div>;
}

/* ---------- Public vendor profile ---------- */

const VENDOR_TABS = ["Menu", "New Products", "Subscriptions", "Food Drops", "Shorts", "Reviews"] as const;
type VendorTabKey = (typeof VENDOR_TABS)[number];

function ProductRow({ product, state, customerEmail, onAdd, onPlan, onToggleWishlist, isNew, planLabel = "Plan" }: { product: Product; state: V3State; customerEmail: string; onAdd: (p: Product) => void; onPlan: (p: Product) => void; onToggleWishlist: (p: Product) => void; isNew?: boolean; planLabel?: string }) {
  const isWishlisted = state.wishlist.some((item) => item.customerEmail === customerEmail && item.productId === product.id);
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-3xl bg-[#faf6f4] p-3.5">
    <PhotoTile imageUrl={product.imageUrl} category={product.category} className="size-16 shrink-0 rounded-2xl" emojiSize={28}>{isNew && <span className="absolute left-0 top-0 rounded-br-lg bg-[#753b50] px-1.5 py-0.5 text-[8px] font-black uppercase text-white">New</span>}</PhotoTile>
    <div className="min-w-[8rem] flex-1"><div className="text-[16px] font-semibold leading-snug">{product.name}</div><div className="text-xs text-[#71676b]">{product.baseUnit}{product.calories > 0 ? ` · ${product.calories} kcal` : ""}</div>{product.dietaryTags[0] && <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-[#eaf5ec] px-3 py-1 text-xs font-semibold text-[#21683b]"><span className="size-2 rounded-full bg-[#26834a]" />{product.dietaryTags[0]}</span>}</div>
    <div className="ml-auto flex shrink-0 flex-col items-end gap-2">
      <b className="text-xl tabular-nums">{money(priceOf(product, state))}</b>
      <div className="flex items-center gap-1.5"><button type="button" onClick={() => onAdd(product)} className="h-9 rounded-full bg-[#753b50] px-5 text-sm font-bold text-white">Add</button><button type="button" onClick={() => onPlan(product)} className="h-9 rounded-full bg-white px-4 text-sm font-semibold">{planLabel}</button>
        <button type="button" onClick={() => onToggleWishlist(product)} aria-label={isWishlisted ? "Remove from wishlist" : "Save to wishlist"} aria-pressed={isWishlisted} title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"} className={`grid size-9 place-items-center rounded-full bg-white transition ${isWishlisted ? "text-[#753b50]" : "text-[#766b70]"}`}><Heart className={`size-[18px] ${isWishlisted ? "fill-current" : ""}`} /></button></div>
    </div>
  </div>;
}

function VendorDropRow({ drop, onClaim }: { drop: FoodDrop; onClaim: (d: FoodDrop, q: number) => Promise<void> }) {
  const now = useTicker(); const [busy, setBusy] = useState(false);
  const currentTime = new Date(now);
  const status = dropDisplayStatus(drop, currentTime);
  const schedule = foodDropSchedule(drop);
  return <div className="flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white p-3"><div className="min-w-0 flex-1"><div className="truncate text-sm font-black">{drop.title}</div><div className="mt-0.5 text-xs font-bold text-stone-500">{status === "live" ? <>LIVE · Closes in {formatCountdown(schedule.endsAt.toISOString(), currentTime)}</> : <>Scheduled — Starts at 8:00 PM</>} · {drop.remainingQuantity} left · {discountPercent(drop)}% off</div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full bg-[#753b50]" style={{ width: `${claimedPercent(drop)}%` }} /></div></div>
    <div className="text-right"><div className="font-black">{money(drop.dropPrice)}</div><button type="button" disabled={busy || status !== "live"} onClick={async () => { setBusy(true); try { await onClaim(drop, 1); } finally { setBusy(false); } }} className="mt-1 rounded-full bg-[#753b50] px-4 py-1.5 text-xs font-black text-white disabled:opacity-50">{status === "live" ? "Add +" : "Available at 8 PM"}</button></div></div>;
}

export function VendorProfileDialog({ vendorId, onClose, state, customerEmail, social, profile, onAdd, onPlan, onToggleWishlist, onClaimDrop, onFollowed, shorts = [], onOpenShorts, cartLines = [], onViewCart }: {
  cartLines?: { id: string; name: string; quantity: number; total: number }[]; onViewCart?: () => void; shorts?: FoodShort[]; onOpenShorts?: (list: FoodShort[], index: number) => void;
  vendorId: string | null; onClose: () => void; state: V3State; customerEmail: string; social: SocialApi; profile: Coords;
  onAdd: (p: Product) => void; onPlan: (p: Product) => void; onToggleWishlist: (p: Product) => void; onClaimDrop: (d: FoodDrop, q: number) => Promise<void>; onFollowed?: (vendor: V3State["vendors"][number]) => void;
}) {
  const [tab, setTab] = useState<VendorTabKey>("Menu");
  const vendor = vendorId ? state.vendors.find((v) => v.id === vendorId) : undefined;
  if (!vendor) return null;
  const products = state.products.filter((p) => p.vendorId === vendor.id && p.active);
  const drops = state.foodDrops.filter((d) => d.vendorId === vendor.id && ["live", "scheduled"].includes(dropDisplayStatus(d)));
  const productIds = new Set(products.map((p) => p.id)); const reviews = state.reviews.filter((r) => productIds.has(r.productId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rating = vendorRating(state, vendor.id); const distance = vendorDistanceKm(profile, vendor); const following = social.followed.includes(vendor.id);
  const photo = vendorPhoto(state, vendor);
  return <Dialog open onOpenChange={(v) => !v && onClose()}><DialogContent className="max-h-[94vh] gap-0 overflow-y-auto overflow-x-hidden rounded-[28px] p-0 sm:max-w-5xl [&>*]:min-w-0">
    <DialogHeader className="sr-only"><DialogDescription>{vendor.businessName} — public vendor profile</DialogDescription></DialogHeader>
    <div className="relative h-40 sm:h-52">{vendor.bannerUrl ? <Image src={vendor.bannerUrl} alt="" fill unoptimized sizes="(max-width: 768px) 100vw, 768px" className="object-cover" /> : <PhotoTile category={vendor.category} className="h-full w-full" emojiSize={90} />}</div>
    <div className="px-5 pb-5"><div className="-mt-10 flex items-end gap-3"><PhotoTile imageUrl={photo} category={vendor.category} className="size-20 shrink-0 rounded-2xl border-4 border-white shadow-lg" emojiSize={34} /></div>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><DialogTitle asChild><h2 className="flex items-center gap-1.5 text-xl font-black leading-tight tracking-[-.02em]">{vendor.businessName}{vendor.verification === "Verified" && <BadgeCheck className="size-5 text-sky-500" aria-label="Verified" />}</h2></DialogTitle>
        <div className="mt-0.5 text-sm font-bold text-stone-500">{vendor.category} · {shortArea(vendor.address)}{distance !== null ? ` · ${distance.toFixed(1)} km` : ""}</div>
        <div className="mt-1 flex items-center gap-1.5 text-sm font-black">{rating ? <><Stars value={rating.average} /><span>{rating.average.toFixed(1)}</span><span className="font-bold text-stone-400">({rating.count} reviews)</span></> : <span className="text-stone-400">No reviews yet</span>}</div></div>
        <button type="button" aria-pressed={following} onClick={() => void social.toggleFollow(vendor.id).then(() => { if (!following) onFollowed?.(vendor); toast.success(following ? `Unfollowed ${vendor.businessName}` : `Following ${vendor.businessName}`); }).catch((e) => toast.error(e instanceof Error ? e.message : "Could not update follow"))} className={`h-11 rounded-full px-7 text-sm font-black transition ${following ? "border border-stone-300 bg-white text-stone-700" : "bg-[#753b50] text-white shadow-[0_10px_24px_rgba(224,25,79,.3)]"}`}>{following ? "Following" : "Follow"}</button></div>
      <div className="mt-3 flex flex-wrap gap-2">{vendor.verification === "Verified" && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">FSSAI Verified</span>}{vendor.category === "Home food" && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">Home Food</span>}{vendor.delivery && <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-black text-stone-600">Delivery</span>}{vendor.pickup && <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-black text-stone-600">Pickup</span>}<span className={`rounded-full px-3 py-1 text-xs font-black ${vendor.openToday ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>{vendor.openToday ? "Open now" : "Closed today"}</span></div>
      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"><div className="min-w-0">
      <SegTabs tabs={(shorts.length ? VENDOR_TABS : VENDOR_TABS.filter((t) => t !== "Shorts")) as readonly VendorTabKey[]} value={tab} onChange={setTab} className="mt-4" />
      <div className="mt-4 space-y-2.5">
        {tab === "Menu" && (products.length ? <><h3 className="text-sm font-black">Today&apos;s Menu ({products.length})</h3>{products.map((p) => <ProductRow key={p.id} product={p} state={state} customerEmail={customerEmail} onAdd={onAdd} onPlan={onPlan} onToggleWishlist={onToggleWishlist} />)}</> : <EmptyState emoji="🍽️" title="Nothing on the menu today" body="This vendor hasn&apos;t published any items right now." />)}
        {tab === "New Products" && (products.length ? products.slice(0, 4).map((p) => <ProductRow key={p.id} product={p} state={state} customerEmail={customerEmail} onAdd={onAdd} onPlan={onPlan} onToggleWishlist={onToggleWishlist} isNew />) : <EmptyState emoji="✨" title="No new products" body="Newly added items appear here first." />)}
        {tab === "Subscriptions" && (products.length ? <><p className="text-xs font-bold text-stone-500">Pick any item and set how often you want it — daily, weekly or on custom days.</p>{products.map((p) => <ProductRow key={p.id} product={p} state={state} customerEmail={customerEmail} onAdd={onAdd} onPlan={onPlan} onToggleWishlist={onToggleWishlist} planLabel="Subscribe" />)}</> : <EmptyState emoji="🔁" title="No subscription items" body="Items you can subscribe to appear here." />)}
        {tab === "Food Drops" && (drops.length ? drops.map((d) => <VendorDropRow key={d.id} drop={d} onClaim={onClaimDrop} />) : <EmptyState emoji="⚡" title="No drops scheduled" body="Follow this vendor to hear first when they post surplus or a limited batch." />)}
        {tab === "Shorts" && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="vendor-shorts">{shorts.map((s, i) => <ShortThumb key={s.id} short={s} onOpen={() => { onClose(); onOpenShorts?.(shorts, i); }} />)}</div>}
        {tab === "Reviews" && (reviews.length ? reviews.slice(0, 20).map((r) => { const product = state.products.find((p) => p.id === r.productId); const verified = !/^demo\d+@sheplates\.demo$/.test(r.customerEmail); return <div key={r.id} className="rounded-2xl border border-stone-200/70 bg-white p-3.5"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><Avatar name={r.customerName} size={30} /><div><div className="text-sm font-black">{r.customerName}</div><div className="text-[11px] font-bold text-stone-400">{product?.name || "Product"} · {r.createdAt}</div></div></div><Stars value={r.rating} /></div>{verified && <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700"><BadgeCheck className="size-3" />Verified Purchase</span>}<p className="mt-1.5 text-sm text-stone-600">{r.comment || "No written feedback."}</p></div>; }) : <EmptyState emoji="⭐" title="No reviews yet" body="Reviews appear after customers receive an order." />)}
      </div>
      </div>
      <aside className="h-fit rounded-3xl bg-[#faf6f4] p-5 lg:sticky lg:top-4" aria-label="Your cart"><h3 className="text-lg font-semibold">Your cart</h3>
        {cartLines.length ? <div className="mt-3 space-y-2 text-sm">{cartLines.map((line) => <div key={line.id} className="flex justify-between gap-3"><span className="min-w-0 truncate">{line.quantity} × {line.name}</span><b className="tabular-nums">{money(line.total)}</b></div>)}</div> : <p className="mt-2 text-sm text-[#71676b]">Nothing yet. Add something from the menu.</p>}
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-[#edf3fd] p-3 text-xs font-medium text-[#285fba]"><span className="mt-0.5 shrink-0">ⓘ</span>One kitchen per order. Adding from another kitchen clears this cart.</div>
        <button type="button" disabled={!cartLines.length} onClick={onViewCart} className="mt-3 h-12 w-full rounded-full bg-[#753b50] text-[15px] font-bold text-white disabled:opacity-50">View cart{cartLines.length ? ` · ${cartLines.reduce((sum, line) => sum + line.quantity, 0)} items · ${money(cartLines.reduce((sum, line) => sum + line.total, 0))}` : ""}</button></aside>
      </div>
    </div>
  </DialogContent></Dialog>;
}
