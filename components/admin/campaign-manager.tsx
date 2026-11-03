"use client";
// Super Admin: create, edit, schedule and run live campaigns. A campaign that is Active and inside its
// dates appears on every matching customer's Marketplace home; views and taps are counted here.
import { useEffect, useMemo, useState } from "react";
import { Check, Eye, Megaphone, MousePointerClick, Pencil, Pause, Play, Plus, Trash2 } from "@/components/icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CampaignBanner } from "@/components/customer-v2/campaigns";
import { toLiveCampaign, type CampaignRecord } from "@/lib/campaigns";
import {
  HEADLINE_MAX, PHASE_LABEL, SEGMENT_LABEL, SUBLINE_MAX, TARGET_LABEL, campaignPhase, clickRate, isoToLocalInput, localInputToIso, validateCampaignForm,
  type CampaignPhase, type CampaignSegment, type CampaignStatus, type CampaignTargetType,
} from "@/lib/campaigns-rules";

type Form = {
  id: string; name: string; headline: string; subline: string; offer: string; emoji: string; ctaLabel: string; targetType: CampaignTargetType; targetValue: string;
  segment: CampaignSegment; startsAt: string; endsAt: string; priority: string; channel: string; aiRationale: string; status: CampaignStatus; createdAt: string; isNew: boolean;
};
const blank = (): Form => ({ id: `CMP-${Date.now().toString(36).toUpperCase()}`, name: "", headline: "", subline: "", offer: "", emoji: "🎉", ctaLabel: "Shop now", targetType: "none", targetValue: "", segment: "everyone", startsAt: "", endsAt: "", priority: "0", channel: "In-app", aiRationale: "", status: "Draft", createdAt: new Date().toISOString(), isNew: true });
const fromCampaign = (c: CampaignRecord): Form => ({ id: c.id, name: c.name, headline: c.headline || "", subline: c.subline || "", offer: c.offer || "", emoji: c.emoji || "🎉", ctaLabel: c.ctaLabel || "Shop now", targetType: c.targetType || "none", targetValue: c.targetValue || "", segment: c.segment || "everyone", startsAt: isoToLocalInput(c.startsAt), endsAt: isoToLocalInput(c.endsAt), priority: String(c.priority ?? 0), channel: c.channel || "In-app", aiRationale: c.aiRationale || "", status: c.status, createdAt: c.createdAt, isNew: false });
const toCampaign = (f: Form, status: CampaignStatus): CampaignRecord => ({
  id: f.id, name: f.name.trim(), audience: SEGMENT_LABEL[f.segment], offer: f.offer.trim() || f.subline.trim() || "Special offer", channel: f.channel, status, aiRationale: f.aiRationale, createdAt: f.createdAt,
  headline: f.headline.trim(), subline: f.subline.trim(), emoji: f.emoji.trim() || "🎉", ctaLabel: f.ctaLabel.trim() || "Shop now", targetType: f.targetType, targetValue: f.targetType === "none" ? "" : f.targetValue,
  segment: f.segment, startsAt: localInputToIso(f.startsAt) || undefined, endsAt: localInputToIso(f.endsAt) || undefined, priority: Number(f.priority) || 0,
});

const inputClass = "h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#753b50]";
const PHASE_TONE: Record<CampaignPhase, string> = { live: "border-emerald-200 bg-emerald-50 text-emerald-700", scheduled: "border-sky-200 bg-sky-50 text-sky-800", ended: "border-stone-200 bg-stone-50 text-stone-500", paused: "border-amber-200 bg-amber-50 text-amber-800", draft: "border-stone-200 bg-stone-50 text-stone-600" };
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");

export function CampaignManager({ campaigns, categories, vendors, products, createOpen, onCreateOpenChange, prefill, onPrefillUsed, onSave, onStatus, onDelete }: {
  campaigns: CampaignRecord[]; categories: string[]; vendors: { id: string; name: string }[]; products: { id: string; name: string; vendor: string }[];
  createOpen: boolean; onCreateOpenChange: (open: boolean) => void; prefill: Partial<CampaignRecord> | null; onPrefillUsed: () => void;
  onSave: (campaign: CampaignRecord) => Promise<void>; onStatus: (campaign: CampaignRecord, status: CampaignStatus) => Promise<void>; onDelete: (campaign: CampaignRecord) => Promise<void>;
}) {
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ id: string; kind: "live" | "delete" } | null>(null);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));

  // open for a new campaign (button or an AI suggestion) or for editing
  useEffect(() => {
    if (!createOpen) return;
    const base = blank();
    if (prefill) Object.assign(base, { name: prefill.name || "", headline: prefill.headline || prefill.name || "", subline: prefill.subline || prefill.offer || "", offer: prefill.offer || "", channel: prefill.channel || "In-app", aiRationale: prefill.aiRationale || "" });
    queueMicrotask(() => setForm(base));
    onCreateOpenChange(false); onPrefillUsed();
  }, [createOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const liveNow = campaigns.filter((c) => campaignPhase(c) === "live").length;
  const preview = useMemo(() => (form && form.headline.trim() ? [toLiveCampaign(toCampaign(form, "Active"))] : []), [form]);

  async function save(goLive: boolean) {
    if (!form) return;
    const status: CampaignStatus = goLive ? "Active" : form.status === "Active" ? "Active" : form.status;
    const problem = validateCampaignForm({ name: form.name, headline: form.headline, subline: form.subline, targetType: form.targetType, targetValue: form.targetValue, startsAt: form.startsAt, endsAt: form.endsAt, status });
    if (problem) return toast.error(problem);
    setSaving(true);
    try { await onSave(toCampaign(form, status)); toast.success(goLive ? "Campaign is live for matching customers" : "Campaign saved"); setForm(null); }
    catch (error) { toast.error(error instanceof Error ? error.message : "The campaign could not be saved"); }
    finally { setSaving(false); }
  }
  const run = async (fn: () => Promise<void>, ok: string) => { try { await fn(); toast.success(ok); } catch (error) { toast.error(error instanceof Error ? error.message : "That did not work"); } };

  return <section className="surface-card overflow-hidden rounded-[28px]" aria-label="Campaign control" data-testid="campaign-manager">
    <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3"><div><h3 className="font-black">Campaign control</h3><p className="text-xs text-stone-500">A campaign reaches customers only while it is <b>Live now</b>: Active, inside its dates and matching the audience. <span data-testid="live-count">{liveNow} live now</span>.</p></div>
      <Button onClick={() => setForm(blank())} className="rounded-xl bg-[#753b50]"><Plus />New live campaign</Button></div>
    {campaigns.length ? <Table><TableHeader><TableRow><TableHead>Campaign</TableHead><TableHead>Audience and button</TableHead><TableHead>Runs</TableHead><TableHead>Results</TableHead><TableHead>Control</TableHead></TableRow></TableHeader>
      <TableBody>{campaigns.map((c) => { const phase = campaignPhase(c); const pending = confirm?.id === c.id ? confirm.kind : null;
        return <TableRow key={c.id} data-testid="campaign-row" data-phase={phase}>
          <TableCell className="align-top"><div className="flex flex-wrap items-center gap-2"><b>{c.name}</b><span data-testid="campaign-phase" className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-black ${PHASE_TONE[phase]}`}>{PHASE_LABEL[phase]}</span></div>
            <div className="mt-1 max-w-xs text-sm">{c.emoji} {c.headline || <i className="text-stone-400">No customer headline yet</i>}</div>{c.subline && <div className="max-w-xs text-xs text-stone-500">{c.subline}</div>}</TableCell>
          <TableCell className="align-top text-sm"><div>{c.segment ? SEGMENT_LABEL[c.segment] : c.audience}</div><div className="mt-1 text-xs text-stone-500">{c.ctaLabel || "Shop now"} → {c.targetType && c.targetType !== "none" ? `${c.targetType}: ${c.targetType === "vendor" ? vendors.find((v) => v.id === c.targetValue)?.name || c.targetValue : c.targetType === "product" ? products.find((p) => p.id === c.targetValue)?.name || c.targetValue : c.targetValue}` : "offer only"}</div></TableCell>
          <TableCell className="align-top text-xs text-stone-600"><div>{c.startsAt ? `From ${when(c.startsAt)}` : "From now"}</div><div>{c.endsAt ? `Until ${when(c.endsAt)}` : "No end date"}</div>{(c.priority ?? 0) > 0 && <div>Priority {c.priority}</div>}</TableCell>
          <TableCell className="align-top text-xs"><div className="flex items-center gap-1" data-testid="campaign-views"><Eye className="size-3.5 text-stone-400" />{c.views ?? 0} views</div><div className="mt-1 flex items-center gap-1" data-testid="campaign-clicks"><MousePointerClick className="size-3.5 text-stone-400" />{c.clicks ?? 0} taps · {clickRate(c.views, c.clicks)}</div></TableCell>
          <TableCell className="align-top"><div className="flex flex-wrap gap-2">
            {c.status === "Active" ? <Button size="sm" variant="outline" className="rounded-xl" onClick={() => void run(() => onStatus(c, "Paused"), "Campaign paused. Customers no longer see it")}><Pause />Pause</Button>
              : pending === "live" ? <Button size="sm" className="rounded-xl bg-[#753b50]" onClick={() => { setConfirm(null); void run(() => onStatus(c, "Active"), "Campaign is live for matching customers"); }}>Confirm: customers will see this now</Button>
              : <Button size="sm" className="rounded-xl bg-[#753b50]" onClick={() => setConfirm({ id: c.id, kind: "live" })}><Play />Go live</Button>}
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setForm(fromCampaign(c))}><Pencil />Edit</Button>
            {pending === "delete" ? <Button size="sm" variant="outline" className="rounded-xl border-red-300 text-red-600" onClick={() => { setConfirm(null); void run(() => onDelete(c), "Campaign deleted"); }}>Confirm delete</Button> : <Button size="sm" variant="outline" className="rounded-xl text-red-600" onClick={() => setConfirm({ id: c.id, kind: "delete" })} aria-label={`Delete ${c.name}`}><Trash2 /></Button>}
          </div></TableCell></TableRow>; })}</TableBody></Table>
      : <div className="p-5"><div className="surface-card sp-empty-state rounded-[28px] border border-dashed p-10 text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#f7edf0] text-[#653046]"><Megaphone className="size-7" /></div><h3 className="mt-4 font-black">No campaigns yet</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-stone-500">Create a banner for the customer Marketplace, or ask AI for behaviour-based ideas and edit one into a campaign.</p></div></div>}

    <Dialog open={form !== null} onOpenChange={(open) => { if (!open) setForm(null); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[28px] sm:max-w-2xl">
        <DialogHeader><DialogTitle className="text-xl font-black">{form?.isNew ? "New live campaign" : "Edit campaign"}</DialogTitle><DialogDescription>This is what customers see on their Marketplace home while the campaign is live. Nothing reaches customers until you go live.</DialogDescription></DialogHeader>
        {form && <div className="space-y-4">
          <div aria-label="Preview of the customer banner"><p className="mb-2 text-xs font-black uppercase tracking-[.14em] text-stone-500">Customer preview</p>
            <CampaignBanner campaigns={preview} onView={() => undefined} onCta={() => undefined} fallback={<div className="grid h-28 place-items-center rounded-[22px] border border-dashed border-stone-300 text-sm text-stone-400">Write a headline to see the banner</div>} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-black uppercase tracking-[.12em] text-stone-500 sm:col-span-2">Campaign name (internal)<input value={form.name} onChange={(e) => set("name", e.target.value)} className={`${inputClass} mt-1.5 normal-case tracking-normal`} placeholder="Weekend breakfast push" aria-label="Campaign name" /></label>
            <label className="block text-xs font-black uppercase tracking-[.12em] text-stone-500 sm:col-span-2">Headline <span className="font-normal normal-case text-stone-400">({form.headline.length}/{HEADLINE_MAX})</span><input value={form.headline} maxLength={HEADLINE_MAX + 10} onChange={(e) => set("headline", e.target.value)} className={`${inputClass} mt-1.5 normal-case tracking-normal`} placeholder="Fresh breakfasts from kitchens near you" aria-label="Headline" /></label>
            <label className="block text-xs font-black uppercase tracking-[.12em] text-stone-500 sm:col-span-2">Line under the headline <span className="font-normal normal-case text-stone-400">({form.subline.length}/{SUBLINE_MAX})</span><input value={form.subline} maxLength={SUBLINE_MAX + 10} onChange={(e) => set("subline", e.target.value)} className={`${inputClass} mt-1.5 normal-case tracking-normal`} placeholder="Ordered before 8 am, delivered by 9" aria-label="Line under the headline" /></label>
            <label className="block text-xs font-black uppercase tracking-[.12em] text-stone-500">Offer tag<input value={form.offer} onChange={(e) => set("offer", e.target.value)} className={`${inputClass} mt-1.5 normal-case tracking-normal`} placeholder="₹50 off above ₹299" aria-label="Offer tag" /></label>
            <div className="grid grid-cols-[88px_1fr] gap-3"><label className="block text-xs font-black uppercase tracking-[.12em] text-stone-500">Emoji<input value={form.emoji} maxLength={4} onChange={(e) => set("emoji", e.target.value)} className={`${inputClass} mt-1.5 text-center text-lg`} aria-label="Emoji" /></label>
              <label className="block text-xs font-black uppercase tracking-[.12em] text-stone-500">Button text<input value={form.ctaLabel} maxLength={24} onChange={(e) => set("ctaLabel", e.target.value)} className={`${inputClass} mt-1.5 normal-case tracking-normal`} aria-label="Button text" /></label></div>
            <label className="block text-xs font-black uppercase tracking-[.12em] text-stone-500">Button goes to<select value={form.targetType} onChange={(e) => { set("targetType", e.target.value as CampaignTargetType); set("targetValue", ""); }} className={`${inputClass} mt-1.5 normal-case tracking-normal`} aria-label="Button goes to">{(Object.keys(TARGET_LABEL) as CampaignTargetType[]).map((k) => <option key={k} value={k}>{TARGET_LABEL[k]}</option>)}</select></label>
            {form.targetType !== "none" && <label className="block text-xs font-black uppercase tracking-[.12em] text-stone-500">{form.targetType === "category" ? "Category" : form.targetType === "vendor" ? "Vendor" : "Product"}
              <select value={form.targetValue} onChange={(e) => set("targetValue", e.target.value)} className={`${inputClass} mt-1.5 normal-case tracking-normal`} aria-label="Target"><option value="">Choose…</option>
                {form.targetType === "category" && categories.map((c) => <option key={c} value={c}>{c}</option>)}
                {form.targetType === "vendor" && vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                {form.targetType === "product" && products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.vendor}</option>)}</select></label>}
            <label className="block text-xs font-black uppercase tracking-[.12em] text-stone-500">Show to<select value={form.segment} onChange={(e) => set("segment", e.target.value as CampaignSegment)} className={`${inputClass} mt-1.5 normal-case tracking-normal`} aria-label="Show to">{(Object.keys(SEGMENT_LABEL) as CampaignSegment[]).map((k) => <option key={k} value={k}>{SEGMENT_LABEL[k]}</option>)}</select></label>
            <label className="block text-xs font-black uppercase tracking-[.12em] text-stone-500">Priority<input type="number" min={0} max={99} value={form.priority} onChange={(e) => set("priority", e.target.value)} className={`${inputClass} mt-1.5`} aria-label="Priority" /><span className="mt-1 block text-[11px] font-normal normal-case tracking-normal text-stone-400">Higher shows first. Customers see up to six.</span></label>
            <label className="block text-xs font-black uppercase tracking-[.12em] text-stone-500">Starts (optional)<input type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} className={`${inputClass} mt-1.5`} aria-label="Starts" /></label>
            <label className="block text-xs font-black uppercase tracking-[.12em] text-stone-500">Ends (optional)<input type="datetime-local" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} className={`${inputClass} mt-1.5`} aria-label="Ends" /></label>
          </div>
          {form.aiRationale && <p className="rounded-xl bg-[#faf6f4] p-3 text-xs leading-5 text-stone-600"><b>Why AI suggested it:</b> {form.aiRationale}</p>}
          <div className="flex flex-wrap gap-2 pt-1"><Button onClick={() => void save(false)} disabled={saving} variant="outline" className="h-11 rounded-xl"><Check />Save {form.status === "Active" ? "changes" : "draft"}</Button>
            {form.status !== "Active" && <Button onClick={() => void save(true)} disabled={saving} className="h-11 rounded-xl bg-[#753b50]"><Play />Save and go live</Button>}</div>
        </div>}
      </DialogContent>
    </Dialog>
  </section>;
}
