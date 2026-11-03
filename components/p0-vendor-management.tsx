"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAccessToken, normalizeWhatsAppNumber, uploadLiveCertificate } from "@/lib/supabase";
import { P0VendorLocationPicker } from "@/components/p0-vendor-location-picker";

type Permission = "can_create" | "can_review" | "can_cancel" | "can_reactivate" | "can_upgrade" | "can_upload";
type Permissions = Record<Permission, boolean>;

type P0Vendor = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  locality: string;
  address: string | null;
  latitude: number;
  longitude: number;
  service_radius_km: number;
  p0_contact_name: string;
  p0_contact_phone: string;
  p0_fssai_required: boolean;
  p0_cancelled_at: string | null;
  verification_status: string;
  operational_status: string;
  marketplace_visible: boolean;
  connect_enabled: boolean;
  whatsapp_number: string;
  logo_url: string | null;
};

type VendorDocument = {
  vendor_id: string;
  document_number: string | null;
  expiry_date: string | null;
  verification_status: string;
  storage_path: string;
};

type UpgradeInvitation = {
  id: string;
  vendor_id: string;
  invited_email: string;
  status: string;
  expires_at: string;
};

type OperationsUser = { id: string; full_name: string; permissions: Permissions };
type P0Response = {
  vendors?: P0Vendor[];
  documents?: VendorDocument[];
  invitations?: UpgradeInvitation[];
  permissions?: Permissions;
  operationsUsers?: OperationsUser[];
  error?: string;
};

const EMPTY_PERMISSIONS: Permissions = {
  can_create: false,
  can_review: false,
  can_cancel: false,
  can_reactivate: false,
  can_upgrade: false,
  can_upload: false,
};
const PERMISSION_LABELS: Array<{ key: Permission; label: string }> = [
  { key: "can_create", label: "Create" },
  { key: "can_review", label: "Review" },
  { key: "can_cancel", label: "Cancel" },
  { key: "can_reactivate", label: "Reactivate" },
  { key: "can_upgrade", label: "Upgrade" },
  { key: "can_upload", label: "Upload certificates" },
];

const inputClass = "mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#753b50]";

async function p0Request<T>(action: string, body?: Record<string, unknown> | FormData, method = "POST"): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new Error("Sign in again before managing P0 vendors.");
  const isFormData = body instanceof FormData;
  const response = await fetch("/api/p0/vendors", {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(method === "POST" && !isFormData ? { "Content-Type": "application/json" } : {}),
    },
    ...(method === "POST" ? { body: isFormData ? body : JSON.stringify({ action, ...body }) } : {}),
  });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error || "P0 vendor request failed.");
  return result;
}

export function P0VendorManagement({ role }: { role: "operations" | "admin" }) {
  const isAdmin = role === "admin";
  const [vendors, setVendors] = useState<P0Vendor[]>([]);
  const [documents, setDocuments] = useState<VendorDocument[]>([]);
  const [invitations, setInvitations] = useState<UpgradeInvitation[]>([]);
  const [permissions, setPermissions] = useState<Permissions>(EMPTY_PERMISSIONS);
  const [operationsUsers, setOperationsUsers] = useState<OperationsUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    name: "", category: "", description: "", locality: "", address: "",
    latitude: "", longitude: "", radius: "5", contactName: "", contactPhone: "",
    whatsappNumber: "", durationHours: "7", fssaiRequired: false,
    fssaiNumber: "", expiryDate: "",
  });
  const [certificate, setCertificate] = useState<File | null>(null);
  const [shopImage, setShopImage] = useState<File | null>(null);
  const shopImageInput = useRef<HTMLInputElement>(null);
  const [upgrade, setUpgrade] = useState<Record<string, { email: string; planCode: string }>>({});
  const [certificateInputs, setCertificateInputs] = useState<Record<string, { number: string; expiry: string; file: File | null }>>({});
  const [permissionDrafts, setPermissionDrafts] = useState<Record<string, Permissions>>({});
  const [claimLink, setClaimLink] = useState("");
  const [p0Tab, setP0Tab] = useState<"All" | "Pending approval" | "Live" | "Cancelled">("All");

  const reload = useCallback(async () => {
    setError("");
    try {
      const result = await p0Request<P0Response>("", undefined, "GET");
      setVendors(result.vendors || []);
      setDocuments(result.documents || []);
      setInvitations(result.invitations || []);
      setPermissions(result.permissions || EMPTY_PERMISSIONS);
      setOperationsUsers(result.operationsUsers || []);
      setPermissionDrafts(Object.fromEntries((result.operationsUsers || []).map((user) => [user.id, user.permissions])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "P0 vendor records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  const latestDocuments = useMemo(() => {
    const map = new Map<string, VendorDocument>();
    for (const document of documents) if (!map.has(document.vendor_id)) map.set(document.vendor_id, document);
    return map;
  }, [documents]);

  const latestInvitations = useMemo(() => {
    const map = new Map<string, UpgradeInvitation>();
    for (const invitation of invitations) if (!map.has(invitation.vendor_id)) map.set(invitation.vendor_id, invitation);
    return map;
  }, [invitations]);

  function updateForm<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function createVendor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!permissions.can_create && !isAdmin) return setError("Your account is not authorized to create P0 vendors.");
    const whatsappNumber = normalizeWhatsAppNumber(form.whatsappNumber);
    if (!whatsappNumber) return setError("Enter a valid WhatsApp number. Use international format, for example +919XXXXXXXXX; 10-digit Indian numbers are normalized to +91.");
    if (form.fssaiRequired && !isAdmin && !permissions.can_upload) return setError("Your Operations account also needs certificate-upload permission.");
    if (form.fssaiRequired && (!form.fssaiNumber.trim() || !form.expiryDate || !certificate)) {
      return setError("Add the required FSSAI number, expiry date and certificate file.");
    }
    setBusy(true);
    setError("");
    setNotice("");
    let createdVendorId: string | null = null;
    try {
      if (shopImage && (!["image/png", "image/jpeg", "image/webp"].includes(shopImage.type) || shopImage.size > 10 * 1024 * 1024)) {
        return setError("Choose a PNG, JPG or WebP shop image under 10 MB.");
      }
      const request = new FormData();
      request.append("action", "create");
      request.append("name", form.name);
      request.append("category", form.category);
      request.append("description", form.description);
      request.append("locality", form.locality);
      request.append("address", form.address);
      request.append("latitude", String(Number(form.latitude)));
      request.append("longitude", String(Number(form.longitude)));
      request.append("serviceRadiusKm", String(Number(form.radius)));
      request.append("contactName", form.contactName);
      request.append("contactPhone", form.contactPhone);
      request.append("whatsappNumber", whatsappNumber);
      request.append("durationHours", form.durationHours);
      request.append("fssaiRequired", String(form.fssaiRequired));
      if (shopImage) request.append("shopImage", shopImage);
      const result = await p0Request<{ vendorId: string }>("create", request);
      createdVendorId = result.vendorId;
      if (form.fssaiRequired && certificate) {
        await uploadLiveCertificate({
          vendorId: result.vendorId,
          file: certificate,
          documentNumber: form.fssaiNumber,
          expiryDate: form.expiryDate,
        });
      }
      setNotice("P0 vendor saved as pending, inactive and hidden until authorized approval.");
      setCertificate(null);
      setShopImage(null);
      if (shopImageInput.current) shopImageInput.current.value = "";
      setForm({
        name: "", category: "", description: "", locality: "", address: "",
        latitude: "", longitude: "", radius: "5", contactName: "", contactPhone: "",
        whatsappNumber: "", durationHours: "7", fssaiRequired: false, fssaiNumber: "", expiryDate: "",
      });
      await reload();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "P0 vendor could not be created.";
      setError(createdVendorId
        ? `P0 vendor ${createdVendorId} was created, but a follow-up step failed: ${message}. Do not create it again; use its listing below to retry the certificate upload.`
        : message);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function review(vendorId: string, decision: "verified" | "rejected") {
    const question = decision === "verified" ? "Approve and make this eligible P0 vendor visible?" : "Reject this P0 vendor application?";
    if (!window.confirm(question)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await p0Request("review", { vendorId, decision });
      setNotice(decision === "verified" ? "P0 vendor approved." : "P0 vendor rejected.");
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "P0 review could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(vendor: P0Vendor) {
    if (!window.confirm(`Cancel ${vendor.name}? This hides the vendor and revokes any pending upgrade invitation. The vendor record and analytics are retained.`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await p0Request("cancel", { vendorId: vendor.id });
      setNotice("P0 vendor deactivated and hidden. Existing data and analytics were retained.");
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "P0 vendor could not be cancelled.");
    } finally {
      setBusy(false);
    }
  }

  async function reactivate(vendor: P0Vendor) {
    if (!window.confirm(`Reactivate ${vendor.name}? Any old invitation remains revoked; a new invitation must be sent separately.`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await p0Request("reactivate", { vendorId: vendor.id });
      setNotice("P0 vendor reactivated. A prior upgrade invitation was not restored.");
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "P0 vendor could not be reactivated.");
    } finally {
      setBusy(false);
    }
  }

  async function startUpgrade(vendor: P0Vendor) {
    const details = upgrade[vendor.id] || { email: "", planCode: "crave" };
    if (!details.email.trim()) return setError("Enter the vendor account email for the upgrade.");
    setBusy(true);
    setError("");
    setNotice("");
    setClaimLink("");
    try {
      const result = await p0Request<{ status: string; invitationId: string; claimUrl?: string; message?: string }>("upgrade", {
        vendorId: vendor.id,
        email: details.email,
        planCode: details.planCode,
      });
      if (result.status === "claim_pending" && result.claimUrl) {
        setClaimLink(result.claimUrl);
        setNotice(result.message || "The existing account must sign in and confirm ownership.");
      } else {
        setNotice("Invitation sent. The upgrade remains pending until account ownership is verified.");
      }
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upgrade invitation could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadCertificate(vendorId: string) {
    const value = certificateInputs[vendorId];
    if (!value?.file || !value.number.trim() || !value.expiry) return setError("Enter the certificate number, expiry and file.");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await uploadLiveCertificate({
        vendorId,
        file: value.file,
        documentNumber: value.number,
        expiryDate: value.expiry,
      });
      setNotice("Certificate uploaded for P0 review.");
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Certificate upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function savePermissions(profileId: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await p0Request("permissions", { profileId, permissions: permissionDrafts[profileId] || EMPTY_PERMISSIONS });
      setNotice("P0 permissions updated and audited.");
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "P0 permissions could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  const hasPermission = (permission: Permission) => isAdmin || permissions[permission];

  const livePlanless = vendors.filter((v) => v.verification_status === "verified" && !v.p0_cancelled_at);
  const waiting = vendors.filter((v) => ["submitted", "under_review", "changes_required"].includes(v.verification_status) && !v.p0_cancelled_at);
  const cancelledList = vendors.filter((v) => Boolean(v.p0_cancelled_at));
  const pendingInvites = invitations.filter((i) => i.status === "pending");
  const tabs = [["All", vendors], ["Pending approval", waiting], ["Live", livePlanless], ["Cancelled", cancelledList]] as const;
  const shownVendors = (tabs.find(([name]) => name === p0Tab) || tabs[0])[1];
  return <div className="space-y-5">
    <header>
      <h1 className="text-[28px] font-bold leading-tight">P0 Connect vendors</h1>
      <p className="mt-1 text-sm text-[#71676b]">{isAdmin ? "Decide which Operations team members can create, approve, cancel and upgrade directory vendors." : "Directory listings you manage for vendors who connect with customers on WhatsApp. They have no login."} P0 is independent of the Taster, Crave, Thrive and Crown plans.</p>
    </header>
    <div className="grid gap-4 sm:grid-cols-3"><div className="surface-card rounded-3xl p-5"><div className="text-[13px] text-[#71676b]">Connect vendors live</div><div className="mt-1 text-[28px] font-bold">{livePlanless.length}</div></div><div className="surface-card rounded-3xl p-5"><div className="text-[13px] text-[#71676b]">Waiting for approval</div><div className="mt-1 text-[28px] font-bold">{waiting.length}</div></div><div className="surface-card rounded-3xl p-5"><div className="text-[13px] text-[#71676b]">Upgrade invitations</div><div className="mt-1 text-[28px] font-bold">{pendingInvites.length}</div></div></div>

    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{notice}</p>}
    {claimLink && <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900"><b>Authenticated ownership confirmation link</b><div className="mt-2 break-all">{claimLink}</div><button type="button" className="mt-2 font-black underline" onClick={() => void navigator.clipboard.writeText(claimLink)}>Copy claim link</button></div>}

    {isAdmin && <section className="surface-card rounded-3xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Operations permissions</h2><span className="text-xs text-[#71676b]">Every change is recorded in the audit log</span></div>
      <p className="mt-3 rounded-2xl bg-[#edf3fd] p-3 text-xs font-medium text-[#285fba]">The person who creates a Connect vendor can never approve it. Approval needs a different team member with the Review right. Operations users have no P0 permissions until you assign them.</p>
      <div className="mt-4 space-y-4">
        {operationsUsers.map((user) => <div key={user.id} className="rounded-[18px] bg-[#faf6f4] p-4">
          <div className="font-semibold">{user.full_name || "Operations user"}</div>
          <div className="mt-3 flex flex-wrap gap-3">
            {PERMISSION_LABELS.map(({ key, label }) => <label key={key} className="flex items-center gap-1.5 text-xs font-semibold">
              <input type="checkbox" checked={permissionDrafts[user.id]?.[key] || false} onChange={(event) => setPermissionDrafts((current) => ({
                ...current,
                [user.id]: { ...(current[user.id] || EMPTY_PERMISSIONS), [key]: event.target.checked },
              }))} />
              {label}
            </label>)}
          </div>
          <button type="button" onClick={() => void savePermissions(user.id)} disabled={busy} className="mt-3 rounded-full bg-[#753b50] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Save permissions</button>
        </div>)}
      </div>
    </section>}
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
    <section className="space-y-3 xl:order-1">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="P0 status">{tabs.map(([name, list]) => <button key={name} type="button" role="tab" aria-selected={p0Tab === name} onClick={() => setP0Tab(name)} className={`h-10 rounded-full px-4 text-sm font-semibold ${p0Tab === name ? "bg-[#753b50] text-white" : "bg-white text-[#4c4246]"}`}>{name} · {list.length}</button>)}</div>
      {loading ? <p role="status" className="text-sm text-stone-500">Loading P0 vendor records…</p>
        : shownVendors.length === 0 ? <p className="rounded-2xl border border-dashed border-stone-300 p-6 text-sm text-stone-500">No P0 vendors have been created.</p>
          : shownVendors.map((vendor) => {
            const document = latestDocuments.get(vendor.id);
            const invitation = latestInvitations.get(vendor.id);
            const certificateValid = Boolean(document?.document_number && document.expiry_date && document.expiry_date >= new Date().toISOString().slice(0, 10));
            const cancelled = Boolean(vendor.p0_cancelled_at);
            const approvalPending = ["submitted", "under_review", "changes_required"].includes(vendor.verification_status);
            const upgradeValue = upgrade[vendor.id] || { email: "", planCode: "crave" };
            const certificateValue = certificateInputs[vendor.id] || { number: "", expiry: "", file: null };
            return <article key={vendor.id} className="surface-card rounded-3xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold">{vendor.name}</h3>
                  <p className="text-xs text-stone-500">{vendor.category} · {vendor.locality} · {vendor.service_radius_km} km</p>
                  <p className="mt-1 text-xs text-stone-500">ID {vendor.id} · {vendor.latitude}, {vendor.longitude}</p>
                  <p className="mt-1 text-xs text-stone-500">Contact: {vendor.p0_contact_name} · {vendor.p0_contact_phone} · WhatsApp {vendor.whatsapp_number}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cancelled ? "bg-[#fdecef] text-[#b42332]" : vendor.verification_status === "verified" ? "bg-[#eaf5ec] text-[#21683b]" : "bg-[#FFF4CF] text-[#795900]"}`}>{cancelled ? "Cancelled" : `${vendor.verification_status} · ${vendor.operational_status}`}</span>
              </div>
              {vendor.p0_fssai_required && <p className={`mt-3 text-xs font-semibold ${certificateValid ? "text-[#21683b]" : "text-[#795900]"}`}>
                FSSAI {certificateValid ? `on file · expires ${document?.expiry_date}` : "required · certificate not current"}
              </p>}
              {invitation && <p className="mt-2 text-xs text-stone-600">Upgrade invite: {invitation.invited_email} · {invitation.status} · expires {new Date(invitation.expires_at).toLocaleDateString()}</p>}

              {vendor.p0_fssai_required && !certificateValid && hasPermission("can_upload") && !cancelled && <div className="mt-4 grid gap-2 rounded-xl bg-[#FFF4CF] p-3 sm:grid-cols-4">
                <input aria-label="FSSAI number" placeholder="FSSAI number" value={certificateValue.number} onChange={(event) => setCertificateInputs((current) => ({ ...current, [vendor.id]: { ...certificateValue, number: event.target.value } }))} className="rounded-lg border border-amber-200 px-3 py-2 text-xs" />
                <input aria-label="Certificate expiry" type="date" value={certificateValue.expiry} onChange={(event) => setCertificateInputs((current) => ({ ...current, [vendor.id]: { ...certificateValue, expiry: event.target.value } }))} className="rounded-lg border border-amber-200 px-3 py-2 text-xs" />
                <input aria-label="Certificate file" type="file" accept=".pdf,image/png,image/jpeg,image/webp" onChange={(event) => setCertificateInputs((current) => ({ ...current, [vendor.id]: { ...certificateValue, file: event.target.files?.[0] || null } }))} className="min-w-0 rounded-lg border border-amber-200 px-3 py-2 text-xs" />
                <button type="button" onClick={() => void uploadCertificate(vendor.id)} disabled={busy} className="rounded-full bg-[#753b50] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Upload certificate</button>
              </div>}

              <div className="mt-4 flex flex-wrap gap-2">
                {approvalPending && !cancelled && hasPermission("can_review") && <>
                  <button type="button" onClick={() => void review(vendor.id, "verified")} disabled={busy} className="rounded-full bg-[#753b50] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Approve</button>
                  <button type="button" onClick={() => void review(vendor.id, "rejected")} disabled={busy} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-50">Reject</button>
                </>}
                {cancelled && hasPermission("can_reactivate") && <button type="button" onClick={() => void reactivate(vendor)} disabled={busy} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-black text-emerald-800 disabled:opacity-50">Reactivate</button>}
                {!cancelled && vendor.operational_status === "active" && hasPermission("can_cancel") && <button type="button" onClick={() => void cancel(vendor)} disabled={busy} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-50">Cancel</button>}
              </div>

              {!cancelled && vendor.operational_status === "active" && hasPermission("can_upgrade") && <div className="mt-4 grid gap-2 border-t border-stone-100 pt-4 sm:grid-cols-[1fr_180px_auto]">
                <input type="email" placeholder="Vendor account email" value={upgradeValue.email} onChange={(event) => setUpgrade((current) => ({ ...current, [vendor.id]: { ...upgradeValue, email: event.target.value } }))} className="rounded-lg border border-stone-200 px-3 py-2 text-sm" />
                <select aria-label="Subscription plan" value={upgradeValue.planCode} onChange={(event) => setUpgrade((current) => ({ ...current, [vendor.id]: { ...upgradeValue, planCode: event.target.value } }))} className="rounded-lg border border-stone-200 px-3 py-2 text-sm">
                  <option value="taster">Taster · ₹499</option><option value="crave">Crave · ₹699</option><option value="thrive">Thrive · ₹799</option><option value="crown">Crown · ₹999</option>
                </select>
                <button type="button" onClick={() => void startUpgrade(vendor)} disabled={busy} className="rounded-lg bg-[#753b50] px-4 py-2 text-xs font-black text-white disabled:opacity-50">Invite / claim</button>
              </div>}
            </article>;
          })}
    </section>
    {hasPermission("can_create") && <form onSubmit={(event) => void createVendor(event)} className="surface-card h-fit rounded-3xl p-5 xl:order-2">
      <h2 className="text-lg font-semibold">Add a Connect vendor</h2>
      <p className="mt-1 text-xs text-stone-500">Creates one unowned vendor record; it starts pending, inactive and hidden. Coordinates and WhatsApp are required for later discovery.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <label className="text-xs font-bold">Business name<input required value={form.name} onChange={(event) => updateForm("name", event.target.value)} className={inputClass} /></label>
        <label className="text-xs font-bold">Category<input required value={form.category} onChange={(event) => updateForm("category", event.target.value)} className={inputClass} /></label>
        <label className="text-xs font-bold">Contact person<input required value={form.contactName} onChange={(event) => updateForm("contactName", event.target.value)} className={inputClass} /></label>
        <label className="text-xs font-bold">Contact phone<input required type="tel" value={form.contactPhone} onChange={(event) => updateForm("contactPhone", event.target.value)} className={inputClass} /></label>
        <label className="text-xs font-bold">WhatsApp number<input required type="tel" value={form.whatsappNumber} onChange={(event) => updateForm("whatsappNumber", event.target.value)} placeholder="+91 98XXXXXXXX" className={inputClass} /></label>
        <label className="text-xs font-bold">Locality<input required value={form.locality} onChange={(event) => {
          updateForm("locality", event.target.value);
          updateForm("latitude", "");
          updateForm("longitude", "");
        }} className={inputClass} /></label>
        <label className="text-xs font-bold sm:col-span-2">Address<textarea value={form.address} onChange={(event) => {
          updateForm("address", event.target.value);
          updateForm("latitude", "");
          updateForm("longitude", "");
        }} className={inputClass} /></label>
        <P0VendorLocationPicker
          address={form.address}
          locality={form.locality}
          latitude={form.latitude}
          longitude={form.longitude}
          radiusKm={form.radius}
          onSave={(place) => {
            updateForm("address", place.address);
            updateForm("latitude", String(place.latitude));
            updateForm("longitude", String(place.longitude));
            setNotice(`Vendor pin saved: ${place.address}`);
          }}
        />
        <label className="text-xs font-bold">Latitude<input required type="number" step="any" min="-90" max="90" value={form.latitude} onChange={(event) => updateForm("latitude", event.target.value)} className={inputClass} /></label>
        <label className="text-xs font-bold">Longitude<input required type="number" step="any" min="-180" max="180" value={form.longitude} onChange={(event) => updateForm("longitude", event.target.value)} className={inputClass} /></label>
        <label className="text-xs font-bold">Service radius (km)<input required type="number" step="0.5" min="0.5" max="100" value={form.radius} onChange={(event) => updateForm("radius", event.target.value)} className={inputClass} /></label>
        <label className="text-xs font-bold">Operating duration (hours/day)<input required type="number" min="1" max="24" value={form.durationHours} onChange={(event) => updateForm("durationHours", event.target.value)} className={inputClass} /></label>
        <label className="text-xs font-bold">Shop image (optional)<input ref={shopImageInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setShopImage(event.target.files?.[0] || null)} className={inputClass} /><span className="mt-1 block font-normal text-stone-500">PNG, JPG or WebP · max 10 MB{shopImage ? ` · ${shopImage.name}` : ""}</span></label>
        <label className="text-xs font-bold sm:col-span-2">Description<textarea value={form.description} onChange={(event) => updateForm("description", event.target.value)} className={inputClass} /></label>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.fssaiRequired} onChange={(event) => updateForm("fssaiRequired", event.target.checked)} />FSSAI certificate is required for this business</label>
      {form.fssaiRequired && <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-bold">FSSAI number<input required value={form.fssaiNumber} onChange={(event) => updateForm("fssaiNumber", event.target.value)} className={inputClass} /></label>
        <label className="text-xs font-bold">Expiry date<input required type="date" value={form.expiryDate} onChange={(event) => updateForm("expiryDate", event.target.value)} className={inputClass} /></label>
        <label className="text-xs font-bold">Certificate file<input required type="file" accept=".pdf,image/png,image/jpeg,image/webp" onChange={(event) => setCertificate(event.target.files?.[0] || null)} className={inputClass} /></label>
      </div>}
      <button disabled={busy} className="mt-4 h-12 w-full rounded-full bg-[#753b50] px-5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Create pending P0 vendor"}</button>
    </form>}
    </div>
  </div>;
}
