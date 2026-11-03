"use client";
// Stories tab. Two different things live here, on purpose:
//   Statuses — what customers share: a photo or a video of up to 30 seconds, in a rail at the top.
//              Each status disappears after 24 hours and each person can watch it once.
//   Food Shorts — what vendors share: reel-style videos, from vendors nearby or vendors you follow.
// There is no permanent customer gallery or feed.
import { useMemo, useState } from "react";
import { Search } from "@/components/icons";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { V3State } from "@/components/sheplates-v3";
import type { SocialApi } from "@/lib/social";
import type { FoodShort, ShortsApi } from "@/lib/food-shorts";
import type { PeopleApi } from "@/lib/people";
import type { MyStatus, Status, StatusesApi } from "@/lib/statuses";
import { EmptyState, SegTabs } from "./kit";
import { DistanceChips, ShortThumb } from "./shorts";
import { PeoplePanel } from "./people";
import { StatusComposer, StatusRail, StatusViewer } from "./status";

const SHORT_SCOPES = ["Nearby", "Following"] as const;
type ShortScope = (typeof SHORT_SCOPES)[number];
type Watching = { items: (Status | MyStatus)[]; own: boolean } | null;

export function StoriesTab({ state, social, shorts, people, statuses, shortsRadius, onShortsRadius, peopleRadius, onPeopleRadius, onOpenShorts, hasPin, onSetLocation, userName, onOpenVendor, onFindPeople }: {
  onFindPeople?: () => void;
  state: V3State; social: SocialApi; shorts: ShortsApi; people: PeopleApi; statuses: StatusesApi; shortsRadius: number; onShortsRadius: (km: number) => void;
  peopleRadius: number; onPeopleRadius: (km: number) => void; onOpenShorts: (list: FoodShort[], index: number) => void; hasPin: boolean; onSetLocation?: () => void; userName: string; onOpenVendor: (id: string) => void;
}) {
  const [scope, setScope] = useState<ShortScope>("Nearby");
  const [composer, setComposer] = useState(false);
  const [finder, setFinder] = useState(false);
  const [watching, setWatching] = useState<Watching>(null);

  const nearbyShorts = shorts.nearby(shortsRadius);
  const followingShorts = useMemo(() => shorts.following(social.followed), [shorts, social.followed]);
  const list = scope === "Nearby" ? nearbyShorts : followingShorts;
  const vendorOptions = useMemo(() => state.vendors.map((v) => ({ id: v.id, name: v.businessName })), [state.vendors]);

  return <div className="mx-auto max-w-5xl space-y-5">
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-[28px] font-bold leading-tight">Stories</h1>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => (onFindPeople ? onFindPeople() : setFinder(true))} className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-black shadow-sm transition hover:border-[#e8cbd5]"><Search className="size-4" />Find people</button>
        <button type="button" onClick={() => setComposer(true)} className="inline-flex items-center gap-1.5 rounded-full bg-[#753b50] px-4 py-2 text-sm font-black text-white shadow-[0_8px_20px_rgba(224,25,79,.28)]">Add status</button>
      </div>
    </div>

    <div className="rounded-3xl bg-[#faf6f4] p-4"><StatusRail mine={statuses.mine} groups={statuses.groups} name={userName} hasPin={hasPin} onAdd={() => setComposer(true)}
      onOpenMine={() => setWatching({ items: statuses.mine, own: true })} onOpenGroup={(i) => setWatching({ items: statuses.groups[i].items, own: false })} /></div>
    <p className="flex items-center gap-2 rounded-2xl bg-[#edf3fd] px-4 py-2.5 text-xs font-medium text-[#285fba]">Statuses disappear after 24 hours. Each person can watch one once.</p>

    <section className="space-y-3" aria-label="Food Shorts">
      <div><h2 className="text-lg font-black tracking-[-.02em]">Food Shorts</h2><p className="mt-0.5 text-xs font-bold text-stone-500">Videos from vendors. A vendor only reaches customers inside the distance they chose.</p></div>
      {shorts.feedError && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">Food Shorts could not be loaded: {shorts.feedError}. Check that the Food Shorts database migrations are applied.</p>}
      <SegTabs tabs={SHORT_SCOPES} value={scope} onChange={setScope} />
      {scope === "Nearby" && (hasPin ? <DistanceChips value={shortsRadius} onChange={onShortsRadius} /> : null)}
      {scope === "Nearby" && !hasPin ? <EmptyState emoji="📍" title="Set your location to see Food Shorts" body="Shorts are shown by distance, so we need your delivery pin first." action={onSetLocation ? <button type="button" onClick={onSetLocation} className="rounded-full bg-[#753b50] px-5 py-2 text-sm font-black text-white">Set my location</button> : undefined} />
        : list.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="shorts-grid">{list.map((s, i) => <ShortThumb key={s.id} short={s} onOpen={() => onOpenShorts(list, i)} />)}</div>
        : scope === "Following" ? <EmptyState emoji="💛" title={social.followed.length ? "No shorts from vendors you follow" : "You are not following any vendors yet"} body={social.followed.length ? "Shorts from vendors you follow appear here when they post one that reaches you." : "Open a vendor and tap Follow to see their Food Shorts here."} />
        : <EmptyState emoji="🎬" title={`No Food Shorts within ${shortsRadius} km`} body={shortsRadius < 30 ? "Try a wider distance. New shorts from nearby vendors appear here as they are posted." : "Vendors around you haven't posted a short yet."} />}
    </section>

    {composer && <StatusComposer open onClose={() => setComposer(false)} vendors={vendorOptions} onPost={statuses.post} />}
    {watching && <StatusViewer items={watching.items} own={watching.own} onClose={() => setWatching(null)} onViewed={statuses.markViewed} onLike={statuses.toggleLike} onReport={statuses.report} loadViewers={statuses.viewers} onOpenVendor={onOpenVendor}
      onDelete={watching.own ? async (id) => { await statuses.remove(id); setWatching((w) => (w ? { ...w, items: w.items.filter((i) => i.id !== id) } : w)); } : undefined} />}
    <Dialog open={finder} onOpenChange={setFinder}><DialogContent className="max-h-[88vh] overflow-y-auto rounded-[28px] sm:max-w-md">
      <DialogHeader><DialogTitle className="text-lg font-black">Find people</DialogTitle><DialogDescription>Follow customers to see their statuses first.</DialogDescription></DialogHeader>
      <PeoplePanel people={people} radius={peopleRadius} onRadius={onPeopleRadius} onSetLocation={() => { setFinder(false); onSetLocation?.(); }} />
    </DialogContent></Dialog>
    {statuses.mode === "local" && <p className="text-center text-[11px] font-bold text-stone-400">Statuses are stored on this device until the community database is enabled.</p>}
  </div>;
}
