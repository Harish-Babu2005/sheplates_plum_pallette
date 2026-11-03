"use client";
// People: find customers by handle, see who is around you, follow and unfollow. Also the switch that puts
// you on the map (off by default) and the followers / following lists.
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, MapPin, Search, UserCheck, UserPlus, X } from "@/components/icons";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PEOPLE_RADIUS_OPTIONS_KM, formatPeopleDistance, searchReady } from "@/lib/people-rules";
import type { PeopleApi, Person } from "@/lib/people";
import { Avatar, EmptyState } from "./kit";

export function PeopleDistanceChips({ value, onChange }: { value: number; onChange: (km: number) => void }) {
  return <div role="tablist" aria-label="People distance" className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
    {PEOPLE_RADIUS_OPTIONS_KM.map((km) => <button key={km} role="tab" type="button" aria-selected={km === value} onClick={() => onChange(km)} className={`shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-bold transition ${km === value ? "border-[#753b50] bg-[#753b50] text-white shadow-[0_8px_20px_rgba(224,25,79,.25)]" : "border-stone-200 bg-white text-stone-600 hover:border-[#e8cbd5]"}`}>{km} km</button>)}
  </div>;
}

export function PersonRow({ person, onFollow, onUnfollow, selected, onSelect, hideDistance }: {
  person: Person; onFollow: (id: string) => Promise<unknown>; onUnfollow: (id: string) => Promise<void>; selected?: boolean; onSelect?: () => void; hideDistance?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    try {
      if (person.following || person.requested) await onUnfollow(person.id);
      else {
        const result = await onFollow(person.id);
        if (result === "requested") toast.success(`Follow request sent to @${person.handle}`);
        else toast.success(`Following @${person.handle}`);
      }
    }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not update"); } finally { setBusy(false); }
  }
  return <div data-testid="person-row" data-handle={person.handle} className={`flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm ${selected ? "border-[#753b50]" : "border-stone-200/70"}`}>
    <button type="button" onClick={onSelect} disabled={!onSelect} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`@${person.handle}`}>
      <span className="relative shrink-0"><Avatar name={person.handle} size={46} ring={Boolean(person.hasStatus)} />{person.sample && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-stone-800 px-1.5 text-[8px] font-black text-white">Sample</span>}</span>
      <span className="min-w-0"><span className="block truncate text-sm font-black">@{person.handle}</span>
        <span className="block truncate text-xs font-bold text-stone-500">{person.bio || "Food lover"}</span>
        <span className="mt-0.5 flex items-center gap-2 text-[11px] font-bold text-stone-400"><span>{person.followerCount} follower{person.followerCount === 1 ? "" : "s"}</span>{!hideDistance && person.distanceKm != null && <span className="inline-flex items-center gap-0.5"><MapPin className="size-3" />{formatPeopleDistance(person.distanceKm)}</span>}</span></span>
    </button>
    <button type="button" disabled={busy} onClick={() => void toggle()} aria-label={person.following ? `Unfollow @${person.handle}` : person.requested ? `Cancel request to @${person.handle}` : `Follow @${person.handle}`} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-black transition disabled:opacity-50 ${person.following || person.requested ? "border border-stone-300 bg-white text-stone-700" : "bg-[#753b50] text-white shadow-[0_8px_18px_rgba(224,25,79,.25)]"}`}>{person.following ? <><UserCheck className="size-3.5" />Following</> : person.requested ? <><UserCheck className="size-3.5" />Requested</> : <><UserPlus className="size-3.5" />{person.privateAccount ? "Request" : "Follow"}</>}</button>
  </div>;
}

export function FollowRequestsPanel({ people }: { people: PeopleApi }) {
  const [busy, setBusy] = useState("");
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void people.refreshRequests().catch((error) => toast.error(error instanceof Error ? error.message : "Follow requests could not be loaded"));
    };
    refresh();
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [people]);
  async function resolve(id: string, accept: boolean) {
    setBusy(id);
    try {
      await people.resolveRequest(id, accept);
      toast.success(accept ? "Follow request approved" : "Follow request declined");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Follow request could not be updated");
    } finally { setBusy(""); }
  }
  if (!people.requests.length) return null;
  return <section className="space-y-2 rounded-[22px] border border-stone-200/70 bg-white p-4 shadow-sm" aria-label="Follow requests">
    <h2 className="text-sm font-black">Follow requests ({people.requests.length})</h2>
    {people.requests.map((request) => <div key={request.id} className="flex items-center gap-3 rounded-xl bg-stone-50 p-3">
      <div className="min-w-0 flex-1"><b className="block truncate text-sm">@{request.handle}</b><span className="block truncate text-xs text-stone-500">{request.bio || "Wants to follow your account"}</span></div>
      <button type="button" disabled={busy === request.id} onClick={() => void resolve(request.id, true)} aria-label={`Approve @${request.handle}`} className="grid size-9 place-items-center rounded-full bg-[#753b50] text-white disabled:opacity-50"><Check className="size-4" /></button>
      <button type="button" disabled={busy === request.id} onClick={() => void resolve(request.id, false)} aria-label={`Decline @${request.handle}`} className="grid size-9 place-items-center rounded-full border border-stone-300 text-stone-600 disabled:opacity-50"><X className="size-4" /></button>
    </div>)}
  </section>;
}

/** Runs a search or a nearby lookup whenever its inputs change, ignoring answers that arrive late. */
export function usePeopleQuery(run: () => Promise<Person[]>, deps: unknown[], enabled = true, delay = 250) {
  const [rows, setRows] = useState<Person[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const ticket = useRef(0);
  const runRef = useRef(run);
  useEffect(() => { runRef.current = run; }, [run]);
  const reload = useCallback(() => {
    const mine = ++ticket.current; setLoading(true); setError("");
    runRef.current().then((r) => { if (mine === ticket.current) setRows(r); }).catch((e) => { if (mine === ticket.current) { setRows([]); setError(e instanceof Error ? e.message : "Could not load people"); } }).finally(() => { if (mine === ticket.current) setLoading(false); });
  }, []);
  useEffect(() => {
    if (!enabled) { ticket.current++; return; }
    const t = window.setTimeout(reload, delay); return () => window.clearTimeout(t);
  }, [enabled, reload, delay, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { rows: enabled ? rows : [], loading: enabled && loading, error: enabled ? error : "", reload, setRows };
}

/** Find people: by handle anywhere, or the people on the map around you, with a distance filter. */
export function PeoplePanel({ people, radius, onRadius, onSetLocation, initialScope = "Find" }: {
  people: PeopleApi; radius: number; onRadius: (km: number) => void; onSetLocation?: () => void; initialScope?: "Find" | "Nearby";
}) {
  const [scope, setScope] = useState<"Find" | "Nearby">(initialScope);
  const [query, setQuery] = useState("");
  const find = usePeopleQuery(() => people.search(query), [query, people.mode, people.followingIds.size, people.requestedIds.size], scope === "Find" && searchReady(query));
  const near = usePeopleQuery(() => people.nearby(radius, query), [radius, query, people.mode, people.hasPin, people.followingIds.size, people.requestedIds.size], scope === "Nearby" && people.hasPin);
  const active = scope === "Find" ? find : near;
  const withFollow = active.rows.map((p) => ({ ...p, following: people.followingIds.has(p.id), requested: people.requestedIds.has(p.id) }));
  return <div className="space-y-3">
    <div role="tablist" aria-label="People" className="grid grid-cols-2 gap-1 rounded-full bg-stone-100 p-1">
      {(["Find", "Nearby"] as const).map((s) => <button key={s} role="tab" type="button" aria-selected={scope === s} onClick={() => setScope(s)} className={`rounded-full py-2 text-sm font-black transition ${scope === s ? "bg-white text-[#653046] shadow" : "text-stone-500"}`}>{s === "Find" ? "Search by handle" : "People nearby"}</button>)}
    </div>
    <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3.5 py-3 shadow-sm"><Search className="size-4 text-stone-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={scope === "Find" ? "Search a handle, e.g. priya" : "Filter nearby people by handle"} aria-label="Search people" autoCapitalize="none" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></div>
    {scope === "Nearby" && (people.hasPin ? <PeopleDistanceChips value={radius} onChange={onRadius} /> : null)}
    {scope === "Find" && !searchReady(query) && <p className="px-1 text-xs font-bold text-stone-400">Type at least two letters of someone&apos;s handle. Anyone can be found this way, even if they are not on the map.</p>}
    {scope === "Nearby" && !people.hasPin && <EmptyState emoji="📍" title="Set your location to see people nearby" body="People who chose to appear on the map are shown by distance, so we need your delivery pin first." action={onSetLocation ? <button type="button" onClick={onSetLocation} className="rounded-full bg-[#753b50] px-5 py-2 text-sm font-black text-white">Set my location</button> : undefined} />}
    {active.error && <p role="alert" className="text-sm font-bold text-red-600">{active.error}</p>}
    {withFollow.length > 0 && <div className="space-y-2" data-testid="people-results">{withFollow.map((p) => <PersonRow key={p.id} person={p} hideDistance={scope === "Find"} onFollow={people.follow} onUnfollow={people.unfollow} />)}</div>}
    {!active.loading && !active.error && !withFollow.length && ((scope === "Find" && searchReady(query)) || (scope === "Nearby" && people.hasPin)) && <EmptyState emoji={scope === "Find" ? "🔎" : "🧭"} title={scope === "Find" ? `Nobody found for “${query.trim().replace(/^@+/, "")}”` : `Nobody on the map within ${radius} km`} body={scope === "Find" ? "Check the spelling. Handles start with the letters you type." : radius < 30 ? "Try a wider distance. People appear here only when they choose to be on the map." : "People appear here only when they choose to be on the map."} />}
    <p className="px-1 text-[11px] font-bold text-stone-400">People nearby are shown to the nearest half kilometre. Nobody&apos;s exact location is ever shown.</p>
  </div>;
}

/** The "Show me on the map" switch with the privacy promise next to it. */
export function DiscoverCard({ people, onSetLocation }: { people: PeopleApi; onSetLocation?: () => void }) {
  const [busy, setBusy] = useState(false);
  async function toggle(next: boolean) {
    setBusy(true);
    try { await people.setDiscoverable(next); toast.success(next ? "You are on the map for people nearby" : "You are no longer on the map"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not update"); } finally { setBusy(false); }
  }
  return <section className="rounded-[22px] border border-stone-200/70 bg-white p-4 shadow-sm" aria-label="People nearby">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><h3 className="text-sm font-black">Let people nearby find me</h3>
        <p className="mt-1 text-xs font-bold leading-5 text-stone-500">Off by default. When on, customers within their chosen distance can see your handle on the map, and watch your statuses. We share only an area about half a kilometre wide, never your delivery pin.</p></div>
      <button type="button" role="switch" aria-checked={people.discoverable} aria-label="Show me on the map" disabled={busy} onClick={() => void toggle(!people.discoverable)} className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-60 ${people.discoverable ? "bg-[#753b50]" : "bg-stone-300"}`}><span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${people.discoverable ? "left-[22px]" : "left-0.5"}`} /></button>
    </div>
    {!people.hasPin && onSetLocation && <button type="button" onClick={onSetLocation} className="mt-3 text-xs font-black text-[#653046]">Set my location first</button>}
  </section>;
}

export function FollowListDialog({ open, kind, onClose, people }: { open: boolean; kind: "followers" | "following"; onClose: () => void; people: PeopleApi }) {
  const list = usePeopleQuery(() => people.list(kind), [kind, open, people.mode, people.followCounts.followers, people.followCounts.following], open, 0);
  const rows = list.rows.map((p) => ({ ...p, requested: people.requestedIds.has(p.id) }));
  return <Dialog open={open} onOpenChange={(v) => !v && onClose()}><DialogContent className="max-h-[85vh] overflow-y-auto rounded-[28px] sm:max-w-md">
    <DialogHeader><DialogTitle className="text-lg font-black">{kind === "followers" ? "Followers" : "Following"}</DialogTitle><DialogDescription>{kind === "followers" ? "Customers who follow you." : "Customers you follow. Vendors you follow are in Marketplace."}</DialogDescription></DialogHeader>
    {list.loading && !rows.length ? <p className="text-sm font-bold text-stone-500" role="status">Loading…</p>
      : rows.length ? <div className="space-y-2" data-testid="follow-list">{rows.map((p) => <PersonRow key={p.id} person={p} hideDistance onFollow={people.follow} onUnfollow={people.unfollow} />)}</div>
      : <EmptyState emoji={kind === "followers" ? "🫶" : "🔎"} title={kind === "followers" ? "No followers yet" : "You are not following anyone yet"} body={kind === "followers" ? "When another customer follows you, they appear here." : "Search a handle or look at people nearby to follow someone."} />}
  </DialogContent></Dialog>;
}
