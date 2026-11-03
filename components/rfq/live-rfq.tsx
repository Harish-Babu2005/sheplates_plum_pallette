"use client";
// Live RFQ screens (Supabase mode): the customer's "My quotations", the Crown vendor's
// "Quote opportunities", and operations' RFQ desk. Demo mode keeps the original local screens.
// Every rule (who is invited, who may quote, who may accept) is enforced by the database.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, Check, ClipboardCheck, RefreshCcw, Upload, WalletCards } from "@/components/icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptQuote, loadCustomerRfqs, loadOpsRfqs, loadVendorRfqs, rfqIsOpen, rfqStatusLabel, submitQuote, uploadCustomerRfqDocument, type CustomerRfq, type VendorRfq } from "@/lib/rfq";

const money = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(v);
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const chip = (status: string) => status === "awarded" || status === "selected" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "quotes_received" || status === "submitted" ? "border-sky-200 bg-sky-50 text-sky-800" : status === "not_selected" || status === "closed" ? "border-stone-200 bg-stone-50 text-stone-500" : "border-amber-200 bg-amber-50 text-amber-800";
const Chip = ({ status, label }: { status: string; label?: string }) => <span className={`inline-flex shrink-0 rounded-full border px-3 py-1 text-[11px] font-black ${chip(status)}`}>{label || rfqStatusLabel(status)}</span>;

function useLoader<T>(load: () => Promise<T>, pollMs = 15_000) {
  const [data, setData] = useState<T | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);
  const run = useCallback(async () => { setBusy(true); try { setData(await loadRef.current()); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Could not load"); } finally { setBusy(false); } }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => void run(), 0);
    const interval = window.setInterval(() => void run(), pollMs);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, [run, pollMs]);
  return { data, error, busy, reload: run };
}

/* ---------------------------------------------------------------- customer */

export function LiveCustomerRfqs() {
  const { data, error, busy, reload } = useLoader(loadCustomerRfqs);
  const [confirm, setConfirm] = useState(""); const [accepting, setAccepting] = useState("");
  const [uploading, setUploading] = useState("");
  async function uploadDocuments(requirementId: string, files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    setUploading(requirementId);
    let uploaded = 0;
    try {
      for (const file of selected) {
        await uploadCustomerRfqDocument(requirementId, file);
        uploaded += 1;
      }
      toast.success(`${uploaded} document${uploaded === 1 ? "" : "s"} attached to your requirement.`);
    } catch (e) {
      toast.error(uploaded ? `${uploaded} document${uploaded === 1 ? "" : "s"} uploaded. ${e instanceof Error ? e.message : "The next document could not be uploaded."}` : e instanceof Error ? e.message : "The document could not be uploaded");
    } finally {
      setUploading("");
      await reload();
    }
  }
  async function accept(quoteId: string) {
    setAccepting(quoteId);
    try { const order = await acceptQuote(quoteId); toast.success(`Quotation accepted. Order ${order.orderNumber} created for ${money(order.total)}`); setConfirm(""); await reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "The quotation could not be accepted"); await reload(); }
    finally { setAccepting(""); }
  }
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.19em] text-[#653046] sm:text-xs">RFP / RFQ TRACKING</p><h1 className="mt-1.5 text-xl font-black tracking-[-.03em]">Vendor participation &amp; quotations</h1>
      <p className="mt-2 max-w-3xl text-[13px] leading-6 text-stone-500">Crown vendors whose service radius covers your address are invited. Compare their sealed offers and choose the winner yourself.</p></div>
      <Button variant="outline" onClick={() => void reload()} disabled={busy} className="rounded-xl"><RefreshCcw className={busy ? "animate-spin" : ""} />Refresh</Button></div>
    {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
    {data && !data.length && <div className="surface-card rounded-[28px] border border-dashed p-10 text-center"><ClipboardCheck className="mx-auto size-8 text-[#653046]" /><h3 className="mt-3 font-black">No monthly requirements yet</h3><p className="mx-auto mt-2 max-w-md text-sm text-stone-500">Publish one under Monthly requirement and eligible vendors near you will be invited.</p></div>}
    {(data || []).map((r: CustomerRfq) => <section key={r.id} data-testid="rfq-card" aria-label={r.title} className="surface-card rounded-[28px] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black">{r.title}</h3><p className="mt-0.5 text-xs text-stone-500">{r.items.length} item{r.items.length === 1 ? "" : "s"} · quotes close {day(r.quoteDeadline)} · delivery {day(r.deliveryDate)} · {r.locality}</p></div><Chip status={r.status} /></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-stone-50 p-3"><b data-testid="rfq-invited">{r.invited}</b><div className="text-xs text-stone-500">Invited vendors</div></div>
        <div className="rounded-2xl bg-emerald-50 p-3"><b data-testid="rfq-quoted">{r.quotes.length}</b><div className="text-xs text-stone-500">Quoted</div></div>
        <div className="rounded-2xl bg-stone-50 p-3"><b>{Math.max(0, r.invited - r.quotes.length)}</b><div className="text-xs text-stone-500">Awaiting response</div></div>
      </div>
      {r.invited === 0 && r.status === "quoting" && <p className="mt-3 text-sm font-bold text-amber-800">No Crown vendor covers your address yet. Your RFQ stays open in case one joins before it closes.</p>}
      <ul className="mt-3 flex flex-wrap gap-2 text-xs text-stone-600">{r.items.map((i) => <li key={i.id} className="rounded-full bg-stone-100 px-3 py-1 font-bold">{i.name} · {i.quantity} {i.unit}</li>)}</ul>
      <div className="mt-4 rounded-2xl border border-dashed border-stone-300 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h4 className="text-sm font-black">Supporting documents</h4><p className="mt-1 text-xs text-stone-500">Attach documents to this requirement. Maximum 20 MB per file.</p></div>
          <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-bold hover:bg-stone-50 ${uploading === r.id ? "pointer-events-none opacity-60" : ""}`}>
            <input aria-label={`Upload documents for ${r.title}`} type="file" multiple disabled={uploading === r.id} className="sr-only" onChange={(event) => { void uploadDocuments(r.id, event.target.files); event.currentTarget.value = ""; }} />
            <Upload className="size-4" />{uploading === r.id ? "Uploading…" : "Upload documents"}
          </label>
        </div>
        {r.documents.length > 0 && <ul className="mt-3 space-y-2">{r.documents.map((document) => <li key={document.id}><a href={document.url} target="_blank" rel="noopener noreferrer" className="break-all text-sm font-bold text-[#292124] underline underline-offset-2">{document.fileName}</a></li>)}</ul>}
      </div>
      {r.order && <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800" data-testid="rfq-order"><BadgeCheck className="mr-1.5 inline size-4" />Order {r.order.number} · {money(r.order.total)} · payment pending. Find it under Orders.</p>}
      {r.quotes.length > 0 && <div className="mt-4 grid gap-3 lg:grid-cols-3">{r.quotes.map((q) => <div key={q.id} data-testid="quote-card" className={`rounded-3xl border p-4 ${q.id === r.awardedQuoteId ? "border-emerald-300 bg-emerald-50/60" : "border-stone-200 bg-white"}`}>
        <div className="flex items-center justify-between gap-2"><BadgeCheck className="size-5 text-[#653046]" />{q.status !== "submitted" && <Chip status={q.status} label={q.status === "selected" ? "Selected" : "Not selected"} />}</div>
        <h4 className="mt-2 font-black">{q.vendorName}</h4>
        <div className="mt-1 text-lg font-black" data-testid="quote-total">{money(q.total)}</div>
        <p className="mt-1 text-xs text-stone-500">Covers {q.coveragePercent}% of your list · delivery {q.deliveryFee ? money(q.deliveryFee) : "free"} · valid to {q.validUntil ? day(q.validUntil) : "closing"}</p>
        {r.status !== "awarded" && q.status === "submitted" && (confirm === q.id
          ? <div className="mt-3 flex gap-2"><Button disabled={accepting === q.id} onClick={() => void accept(q.id)} className="flex-1 rounded-xl bg-[#753b50] hover:bg-[#753b50]"><Check />Yes, create the order</Button><Button variant="outline" onClick={() => setConfirm("")} className="rounded-xl">Cancel</Button></div>
          : <Button onClick={() => setConfirm(q.id)} className="mt-3 w-full rounded-xl bg-[#753b50] hover:bg-[#753b50]">Accept quotation</Button>)}
      </div>)}</div>}
    </section>)}
  </div>;
}

/* ---------------------------------------------------------------- vendor */

type VendorLite = { id: string; businessName: string; plan: string; verification: string; operational: string };

function QuoteForm({ rfq, onSent }: { rfq: VendorRfq; onSent: () => void }) {
  const prior = rfq.myQuote;
  const [price, setPrice] = useState<Record<string, string>>(() => Object.fromEntries(rfq.items.map((i) => [i.id, prior?.lines[i.id]?.unitPrice ? String(prior.lines[i.id].unitPrice) : ""])));
  const [off, setOff] = useState<Record<string, boolean>>(() => Object.fromEntries(rfq.items.map((i) => [i.id, prior ? prior.lines[i.id] ? !prior.lines[i.id].available : true : false])));
  const [fee, setFee] = useState(prior ? String(prior.deliveryFee || "") : ""); const [busy, setBusy] = useState(false);
  const total = useMemo(() => rfq.items.reduce((sum, i) => sum + (off[i.id] ? 0 : Number(price[i.id] || 0) * i.quantity), 0), [rfq.items, price, off]);
  async function send() {
    setBusy(true);
    try {
      await submitQuote(rfq.id, rfq.items.map((i) => ({ requirementItemId: i.id, available: !off[i.id], unitPrice: off[i.id] ? 0 : Number(price[i.id] || 0) })), Number(fee || 0));
      toast.success(prior ? "Quotation updated" : "Quotation sent to the customer"); onSent();
    } catch (e) { toast.error(e instanceof Error ? e.message : "The quotation could not be sent"); } finally { setBusy(false); }
  }
  return <div className="mt-4 space-y-3">
    <div className="overflow-x-auto rounded-2xl border border-stone-200"><table className="w-full min-w-120 text-sm"><thead className="bg-stone-50 text-left text-xs font-black uppercase tracking-wider text-stone-500"><tr><th className="p-3">Item</th><th className="p-3">Quantity</th><th className="p-3">Your price per unit</th><th className="p-3">Cannot supply</th></tr></thead>
      <tbody>{rfq.items.map((i) => <tr key={i.id} className="border-t border-stone-100"><td className="p-3 font-bold">{i.name}{i.brand ? <span className="ml-1 text-xs font-normal text-stone-500">({i.brand})</span> : null}</td><td className="p-3">{i.quantity} {i.unit}</td>
        <td className="p-3"><input type="number" min="0" step="0.01" inputMode="decimal" aria-label={`Price for ${i.name}`} disabled={off[i.id]} value={price[i.id]} onChange={(e) => setPrice((p) => ({ ...p, [i.id]: e.target.value }))} className="w-28 rounded-lg border border-stone-200 px-2 py-1.5 outline-none focus:border-[#753b50] disabled:bg-stone-100" /></td>
        <td className="p-3"><input type="checkbox" aria-label={`Cannot supply ${i.name}`} checked={off[i.id]} onChange={(e) => setOff((o) => ({ ...o, [i.id]: e.target.checked }))} className="size-4" /></td></tr>)}</tbody></table></div>
    <div className="flex flex-wrap items-end gap-4"><label className="text-xs font-black uppercase tracking-wider text-stone-500">Delivery fee<input type="number" min="0" step="0.01" inputMode="decimal" aria-label="Delivery fee" value={fee} onChange={(e) => setFee(e.target.value)} className="mt-1 block w-28 rounded-lg border border-stone-200 px-2 py-1.5 text-sm font-normal normal-case tracking-normal outline-none focus:border-[#753b50]" /></label>
      <div className="text-sm"><span className="text-stone-500">Items total</span> <b data-testid="quote-items-total">{money(total)}</b>{Number(fee) > 0 && <span className="text-stone-500"> + delivery {money(Number(fee))}</span>}</div>
      <Button onClick={() => void send()} disabled={busy || total <= 0} className="rounded-xl">{busy ? "Sending…" : prior ? "Update quotation" : "Send quotation"}</Button></div>
  </div>;
}

export function LiveVendorRfqs({ vendor }: { vendor: VendorLite }) {
  const entitled = vendor.plan === "Crown";
  const { data, error, busy, reload } = useLoader(() => (entitled ? loadVendorRfqs(vendor.id) : Promise.resolve([] as VendorRfq[])));
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.19em] text-[#653046] sm:text-xs">PACKAGE 3 FEATURE</p><h1 className="mt-1.5 text-lg font-black leading-[1.15] tracking-[-.03em] sm:text-xl">Local RFQ opportunities</h1>
      <p className="mt-2 max-w-3xl text-[13px] leading-6 text-stone-500">You only see RFQs from customers inside your own service radius. Prices stay sealed from other vendors until the customer chooses.</p></div>
      {entitled && <Button variant="outline" onClick={() => void reload()} disabled={busy} className="rounded-xl"><RefreshCcw className={busy ? "animate-spin" : ""} />Refresh</Button>}</div>
    {!entitled && <div className="surface-card sp-empty-state rounded-[28px] border border-dashed p-10 text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#f7edf0] text-[#653046]"><WalletCards className="size-7" /></div><h3 className="mt-4 font-black">Quotations are available on the Crown plan</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-stone-500">Crown vendors receive customer RFQs inside their service radius and can send quotations. Ask ShePlates operations to upgrade your store.</p></div>}
    {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
    {entitled && data && !data.length && <div className="surface-card rounded-[28px] border border-dashed p-10 text-center"><ClipboardCheck className="mx-auto size-8 text-[#653046]" /><h3 className="mt-3 font-black">No RFQs for your store yet</h3><p className="mx-auto mt-2 max-w-md text-sm text-stone-500">When a customer within your service radius posts a monthly requirement, it appears here.</p></div>}
    {entitled && (data || []).map((r) => { const open = rfqIsOpen(r); const q = r.myQuote;
      return <section key={r.id} data-testid="vendor-rfq" aria-label={r.title} className="surface-card rounded-[28px] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black">{r.title}</h3><p className="mt-0.5 text-xs text-stone-500">{r.items.length} item{r.items.length === 1 ? "" : "s"} · {r.locality} · closes {day(r.quoteDeadline)} · delivery {day(r.deliveryDate)} · {r.fulfilment === "self_pickup" ? "pickup" : "vendor delivery"}</p></div>
          <div className="flex gap-2">{q && <Chip status={q.status} label={q.status === "selected" ? "You won" : q.status === "not_selected" ? "Not selected" : "Quotation sent"} />}<Chip status={open ? r.status : r.status === "awarded" ? "awarded" : "closed"} label={open ? rfqStatusLabel(r.status) : r.status === "awarded" ? "Awarded" : "Closed"} /></div></div>
        {q && !open ? <p className="mt-3 text-sm text-stone-600">Your quotation: <b>{money(q.total + q.deliveryFee)}</b>{q.status === "selected" ? ". The customer chose you. The order appears under Orders once the customer has paid." : q.status === "not_selected" ? ". The customer chose another vendor." : ""}</p>
          : open ? <QuoteForm key={r.id + (q?.id || "")} rfq={r} onSent={() => void reload()} /> : <p className="mt-3 text-sm text-stone-500">This RFQ is closed.</p>}
      </section>; })}
  </div>;
}

/* ---------------------------------------------------------------- operations */

export function LiveRfqDesk() {
  const { data, error } = useLoader(loadOpsRfqs, 30_000);
  return <div className="space-y-6">
    <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.19em] text-[#653046] sm:text-xs">RFQ CONTROL</p><h1 className="mt-1.5 text-lg font-black leading-[1.15] tracking-[-.03em] sm:text-xl">Monthly requirement desk</h1><p className="mt-2 max-w-3xl text-[13px] leading-6 text-stone-500">Every customer requirement, how many Crown vendors were invited and how many quoted. An RFQ with no invited vendor needs attention.</p></div>
    {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
    {data && !data.length && <div className="surface-card rounded-[28px] border border-dashed p-10 text-center"><ClipboardCheck className="mx-auto size-8 text-[#653046]" /><h3 className="mt-3 font-black">No RFQs yet</h3><p className="mt-2 text-sm text-stone-500">Customer monthly requirements will appear here.</p></div>}
    {(data || []).map((r) => <div key={r.id} data-testid="ops-rfq" className="surface-card rounded-[26px] p-5"><div className="flex flex-wrap justify-between gap-2"><div><b>{r.title}</b><div className="text-xs text-stone-500">{r.items} items · {r.locality} · delivery {day(r.deliveryDate)}</div></div><Chip status={r.status} /></div>
      <div className="mt-3 flex flex-wrap gap-4 text-sm"><span>{r.invited} vendor{r.invited === 1 ? "" : "s"} invited</span><span>{r.quotes} quotation{r.quotes === 1 ? "" : "s"} received</span>{r.invited === 0 && r.status === "quoting" && <span className="font-black text-amber-700">No Crown vendor covers this address</span>}</div></div>)}
  </div>;
}
