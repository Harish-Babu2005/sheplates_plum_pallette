"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAccessToken, getSupabaseBrowserClient } from "@/lib/supabase";

export function P0UpgradeAcceptance({ invitationId: initialInvitationId }: { invitationId?: string }) {
  const [invitationId] = useState(() => {
    if (initialInvitationId) return initialInvitationId;
    return typeof window === "undefined"
      ? ""
      : new URL(window.location.href).searchParams.get("invitation") || "";
  });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      window.setTimeout(() => setError("Account sign-in is unavailable in this deployment."), 0);
      return;
    }
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) setError(sessionError.message);
      else if (data.session) setReady(true);
    });
  }, []);

  async function accept() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!invitationId) throw new Error("The invitation link is missing its invitation ID.");
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in with the invited vendor account, then reopen this invitation link.");
      const response = await fetch("/api/p0/upgrade/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ invitationId }),
      });
      const result = await response.json() as { completed?: boolean; vendorId?: string; error?: string };
      if (!response.ok || !result.completed || !result.vendorId) {
        throw new Error(result.error || "The upgrade could not be completed.");
      }
      setMessage("Account ownership is confirmed and the existing vendor record has been upgraded. Opening the vendor portal…");
      try {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) throw new Error("Account sign-in is unavailable.");
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        const user = sessionData.session?.user;
        if (sessionError || !user?.email) throw sessionError || new Error("The authenticated account could not be loaded.");
        const fullName = user.user_metadata?.full_name;
        window.localStorage.setItem("sheplates-v3-session", JSON.stringify({
          email: user.email,
          name: typeof fullName === "string" && fullName ? fullName : user.email.split("@")[0],
          role: "vendor",
          userId: user.id,
          vendorId: result.vendorId,
          toursCompleted: [],
        }));
        window.setTimeout(() => window.location.assign("/"), 900);
      } catch {
        setError("The vendor upgrade completed, but the portal session could not be prepared. Sign out and sign in again to continue.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The upgrade could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="grid min-h-screen place-items-center bg-[#faf6f4] p-5">
    <section className="w-full max-w-lg rounded-3xl border border-stone-200 bg-white p-6 shadow-xl sm:p-8">
      <p className="text-xs font-black uppercase tracking-[.15em] text-[#653046]">ShePlates vendor upgrade</p>
      <h1 className="mt-2 text-2xl font-black">Confirm account ownership</h1>
      <p className="mt-3 text-sm leading-6 text-stone-600">
        This confirmation upgrades the existing P0 vendor record to the selected subscription plan. It does not create another vendor.
      </p>
      {!ready && !error && <p role="status" className="mt-5 text-sm text-stone-600">Waiting for the invitation session…</p>}
      {message && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p>}
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={() => void accept()} disabled={!ready || busy || Boolean(message)} className="rounded-xl bg-[#753b50] px-5 py-3 text-sm font-black text-white disabled:opacity-50">
          {busy ? "Validating invitation…" : "Confirm and upgrade"}
        </button>
        <Link href="/" className="rounded-xl border border-stone-200 px-5 py-3 text-sm font-black text-stone-700">Go to sign in</Link>
      </div>
      <p className="mt-5 text-xs leading-5 text-stone-500">The server checks account identity, invitation expiry, vendor status, and Operations authorization before changing ownership or plan.</p>
    </section>
  </main>;
}
