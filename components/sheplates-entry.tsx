"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import type * as React from "react";
import {
  Activity, ArrowRight, BadgeCheck, ChevronRight, LocateFixed, MapPin,
  Search, ShieldCheck, Sparkles, Upload, X, Milk, Soup, ShoppingBag, CalendarDays, Truck,
} from "@/components/icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { categories, categoryVisual, plans, vendors } from "@/lib/sheplates-data";
import { demoAccounts, type DemoSession } from "@/lib/sheplates-v2-data";
import { isSupabaseConfigured, liveSignIn, liveSignUp, saveLiveCustomerPrivacy, sendPasswordResetEmail } from "@/lib/supabase";

type Audience = "customer" | "team";
type AuthMode = "login" | "create" | "forgot";

// Kept in sync with STAFF_KEY / StaffAccount in sheplates-v3.tsx — a Super Admin
// "Create user" without Supabase configured stores the account here so it can sign in.
const LOCAL_STAFF_KEY = "sheplates-v3-staff-accounts";
const LOCAL_CUSTOMER_KEY = "sheplates-v3-customer-accounts";
const LOCAL_VENDOR_KEY = "sheplates-v3-vendor-accounts";
type LocalStaffAccount = { email: string; name: string; role: "operations" | "admin"; password: string; active: boolean };
function readLocalStaffAccount(email: string, password: string): LocalStaffAccount | null {
  try {
    const list = JSON.parse(localStorage.getItem(LOCAL_STAFF_KEY) || "[]") as LocalStaffAccount[];
    return list.find((account) => account.active !== false && account.email.toLowerCase() === email.trim().toLowerCase() && account.password === password) || null;
  } catch { return null; }
}
type LocalCustomerAccount = {
  email: string;
  name: string;
  passwordSalt: string;
  passwordHash: string;
  privateAccount: boolean;
  active: boolean;
};
function isLocalCustomerAccount(value: unknown): value is LocalCustomerAccount {
  if (!value || typeof value !== "object") return false;
  const account = value as Record<string, unknown>;
  return typeof account.email === "string" &&
    typeof account.name === "string" &&
    typeof account.passwordSalt === "string" && /^[a-f\d]{32}$/i.test(account.passwordSalt) &&
    typeof account.passwordHash === "string" && /^[a-f\d]{64}$/i.test(account.passwordHash) &&
    typeof account.privateAccount === "boolean" &&
    typeof account.active === "boolean";
}
function readLocalCustomerAccounts(): LocalCustomerAccount[] {
  try {
    const stored = localStorage.getItem(LOCAL_CUSTOMER_KEY);
    if (!stored) return [];
    const accounts: unknown = JSON.parse(stored);
    if (!Array.isArray(accounts) || !accounts.every(isLocalCustomerAccount)) {
      throw new Error("Saved local customer accounts have an invalid format.");
    }
    return accounts;
  } catch (error) {
    if (error instanceof Error && error.message.includes("invalid format")) throw error;
    throw new Error("Saved local customer accounts could not be read. Check browser storage and try again.");
  }
}
async function hashLocalAccountPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: Uint8Array.from(salt.match(/.{2}/g) || [], (byte) => parseInt(byte, 16)), iterations: 120_000, hash: "SHA-256" },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function newLocalAccountSalt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function saveLocalCustomerAccounts(accounts: LocalCustomerAccount[]) {
  try {
    localStorage.setItem(LOCAL_CUSTOMER_KEY, JSON.stringify(accounts));
  } catch {
    throw new Error("This browser could not save the account. Check that site storage is enabled and try again.");
  }
}
async function verifyLocalCustomerPassword(account: LocalCustomerAccount, password: string) {
  return (await hashLocalAccountPassword(password, account.passwordSalt)) === account.passwordHash;
}

type LocalVendorAccount = {
  email: string;
  name: string;
  passwordSalt: string;
  passwordHash: string;
  vendorId: string;
  active: boolean;
};
function isLocalVendorAccount(value: unknown): value is LocalVendorAccount {
  if (!value || typeof value !== "object") return false;
  const account = value as Record<string, unknown>;
  return typeof account.email === "string" &&
    typeof account.name === "string" &&
    typeof account.passwordSalt === "string" && /^[a-f\d]{32}$/i.test(account.passwordSalt) &&
    typeof account.passwordHash === "string" && /^[a-f\d]{64}$/i.test(account.passwordHash) &&
    typeof account.vendorId === "string" && account.vendorId.startsWith("local-") &&
    typeof account.active === "boolean";
}
function readLocalVendorAccounts(): LocalVendorAccount[] {
  try {
    const stored = localStorage.getItem(LOCAL_VENDOR_KEY);
    if (!stored) return [];
    const accounts: unknown = JSON.parse(stored);
    if (!Array.isArray(accounts) || !accounts.every(isLocalVendorAccount)) {
      throw new Error("Saved local vendor accounts have an invalid format.");
    }
    return accounts;
  } catch (error) {
    if (error instanceof Error && error.message.includes("invalid format")) throw error;
    throw new Error("Saved local vendor accounts could not be read. Check browser storage and try again.");
  }
}
function saveLocalVendorAccounts(accounts: LocalVendorAccount[]) {
  try {
    localStorage.setItem(LOCAL_VENDOR_KEY, JSON.stringify(accounts));
  } catch {
    throw new Error("This browser could not save the account. Check that site storage is enabled and try again.");
  }
}
async function verifyLocalVendorPassword(account: LocalVendorAccount, password: string) {
  return (await hashLocalAccountPassword(password, account.passwordSalt)) === account.passwordHash;
}

function authErrorMessage(caught: unknown) {
  if (caught instanceof Error && caught.message) return caught.message;
  if (caught && typeof caught === "object" && "message" in caught && typeof caught.message === "string") return caught.message;
  return "Unable to continue. Please contact your administrator if you need team access.";
}

export function ShePlatesEntry({ onLogin }: { onLogin: (session: DemoSession) => void }) {
  const [authAudience, setAuthAudience] = useState<Audience | null>(null);
  const [location, setLocation] = useState("Ganapathy, Coimbatore");
  const [locating, setLocating] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [agentOpen, setAgentOpen] = useState(false);

  // A vendor's QR code links to "<origin>/?vendor=<id>". There's no path
  // router in this app, so signed-out visitors land here first; prompt
  // sign-in immediately instead of leaving them on the generic landing page.
  // ShePlatesV3 re-reads the same param after login to jump into that
  // vendor's shop, so it's intentionally left in the URL here.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    if (hash.includes("type=recovery") || search.includes("type=recovery")) {
      window.location.replace(`/reset-password${search}${hash}`);
      return;
    }
    const params = new URLSearchParams(search);
    if (params.get("vendor")) {
      queueMicrotask(() => setAuthAudience("customer"));
      toast.info("Sign in to view and order from this vendor's shop.");
    } else if (params.get("forgot") === "true") {
  queueMicrotask(() => setAuthAudience("customer"));
} else if (params.get("login") === "team") {
  queueMicrotask(() => setAuthAudience("team"));
} else if (params.get("login") === "customer") {
  queueMicrotask(() => setAuthAudience("customer"));
}
  }, []);

  const filteredPlans = useMemo(() => {
    const query = search.trim().toLowerCase();
    return plans.filter((plan) =>
      (selectedCategory === "All" || plan.category === selectedCategory) &&
      (!query || `${plan.name} ${plan.category} ${plan.description}`.toLowerCase().includes(query)),
    );
  }, [search, selectedCategory]);

  function detectLocation() {
    if (!navigator.geolocation) {
      toast.error("Location detection is not supported in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocation("Ganapathy, Coimbatore");
        setLocating(false);
        toast.success("Showing verified vendors near your location");
      },
      () => {
        setLocating(false);
        toast.info("Location permission was not enabled. You can type your area instead.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  const openCustomer = () => setAuthAudience("customer");
  const steps: [string, string][] = [
    ["Find kitchens near you", "Set your delivery pin and see verified kitchens, bakers and farms within their service radius."],
    ["Pick one kitchen, plan ahead", "One kitchen per order. Choose a date from tomorrow, or set a daily or weekly subscription."],
    ["Track it to your door", "Pay securely, then follow your order from the kitchen to the delivery person."],
  ];
  const tiles: [string, typeof Soup][] = [["Home food", Soup], ["Milk and dairy", Milk], ["Bakery", ShoppingBag], ["Vegetables", Activity], ["Fish and meat", Sparkles]];
  return (
    <div className="sh e-page sp-entry">
      <Toaster position="top-center" richColors />
      <header className="e-head">
        <button type="button" className="e-logo" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><img src="/sheplates-logo.png" alt="" />ShePlates</button>
        <nav className="e-nav" aria-label="Site">
          <button type="button" onClick={openCustomer}>Browse kitchens</button>
          <button type="button" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}>How it works</button>
          <button type="button" onClick={() => setAuthAudience("team")}>Vendor / Team</button>
        </nav>
        <button type="button" className="btn sm sec e-vendor" onClick={() => setAuthAudience("team")}>Vendor</button>
        <button type="button" className="btn sm sec" onClick={openCustomer}>Sign in</button>
        <button type="button" className="btn sm" onClick={openCustomer}>Get started</button>
      </header>

      <section className="e-hero">
        <div className="e-hero-copy">
          <span className="pill o"><BadgeCheck className="size-4" />Verified home chefs, bakers and local shops</span>
          <h1>Home-cooked food, from your own neighbourhood</h1>
          <p>Order from verified home chefs, bakers and local shops. Plan a week ahead or order for tomorrow.</p>
          <div className="e-cta"><button type="button" className="btn" onClick={openCustomer}>Get started</button><button type="button" className="btn sec" onClick={openCustomer}>I already have an account</button><button type="button" className="btn sec" onClick={() => setAgentOpen(true)}><Sparkles className="size-5" />Try She Agent</button></div>
          <div className="s m">Sign in to see kitchens near you and to order.</div>
        </div>
        <div className="e-hero-card">
          <div className="e-hero-tiles"><span><Soup className="size-9" /></span><span><ShoppingBag className="size-9" /></span><span><Milk className="size-9" /></span></div>
          <div><div className="h3">Meena&apos;s Home Kitchen</div><div className="s">Mini Meals, rice, two curries, poriyal · ₹120</div></div>
        </div>
      </section>

      <section id="how-it-works" className="e-band">
        <h2 className="h3">How ShePlates works</h2>
        <div className="e-steps">{steps.map(([title, body], i) => <div key={title} className="e-step"><span className="e-num">{i + 1}</span><h3>{title}</h3><p>{body}</p></div>)}</div>
        <h2 className="h3 e-cat-h">Browse by category</h2>
        <div className="e-tiles">{tiles.map(([label, Icon]) => <button type="button" key={label} onClick={openCustomer}><Icon className="size-8" />{label}</button>)}</div>
      </section>

      <footer className="sh k-foot">
        <div className="row g8"><img src="/sheplates-logo.png" alt="" style={{ width: 40, height: 40, borderRadius: "50%" }} /><div><b>ShePlates</b><div className="s" style={{ color: "#b9afb3" }}>Home meals, made simple</div></div></div>
        <div className="fl"><span>Terms and Conditions</span><span>Privacy Policy</span><a href="tel:+919600037836">Support: 9600037836</a><a href="mailto:support@sheplates.com">support@sheplates.com</a><span>Every day, 9:30 AM to 7 PM</span></div>
      </footer>

      <AuthDialog audience={authAudience} close={() => setAuthAudience(null)} onLogin={onLogin} setAudience={setAuthAudience} />
      <AgentPreview open={agentOpen} close={() => setAgentOpen(false)} login={() => { setAgentOpen(false); setAuthAudience("customer"); }} />
    </div>
  );

}

function AuthDialog({ audience, close, onLogin, setAudience }: { audience: Audience | null; close: () => void; onLogin: (session: DemoSession) => void; setAudience?: (audience: Audience | null) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [privateAccount, setPrivateAccount] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const liveMode = process.env.NEXT_PUBLIC_DEMO_MODE === "false" && isSupabaseConfigured();

  function revealField(event: React.FocusEvent<HTMLInputElement>) {
    const element = event.currentTarget;
    window.setTimeout(() => element.scrollIntoView({ block: "center", behavior: "smooth" }), 180);
  }

  useEffect(() => {
    if (!audience) return;
    const isForgot = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("forgot") === "true";
    queueMicrotask(() => {
      setMode(isForgot && audience === "customer" ? "forgot" : "login");
      setEmail("");
      setPassword("");
      setError("");
      setName("");
      setPrivateAccount(false);
      setResetSent(false);
    });
  }, [audience]);

// Listen for password reset completion from another browser tab
useEffect(() => {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
    return;
  }

  const channel = new BroadcastChannel("sheplates-password-reset");

  channel.onmessage = (event) => {
    if (event.data?.type === "PASSWORD_RESET_COMPLETED") {
      const audience = event.data.audience;

      setAudience?.(audience === "team" ? "team" : "customer");
    }
  };

  return () => {
    channel.close();
  };
}, []);

  if (!audience) return null;
  const registrationRole = audience === "customer" ? "customer" : "vendor";

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (mode === "forgot") {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) throw new Error("Enter your registered email address.");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error("Enter a valid email address.");

        if (!isSupabaseConfigured()) {
          throw new Error("Supabase authentication is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local and set NEXT_PUBLIC_DEMO_MODE=false to send real password reset emails.");
        }

await sendPasswordResetEmail(
  normalizedEmail,
  `${window.location.origin}/reset-password?audience=${audience}`
);
        setResetSent(true);
        toast.success("Password reset instructions sent to your email.");
        return;
      }

      if (mode === "create") {
        if (!name.trim()) throw new Error("Enter your full name.");
        if (password.length < 8) throw new Error("Use a password with at least 8 characters.");
        if (!liveMode) {
          const normalizedEmail = email.trim().toLowerCase();
          if (registrationRole === "customer") {
            const accounts = readLocalCustomerAccounts();
            if (accounts.some((account) => account.email.toLowerCase() === normalizedEmail) || demoAccounts.some((account) => account.email.toLowerCase() === normalizedEmail)) {
              throw new Error("An account with this email already exists.");
            }
            const passwordSalt = newLocalAccountSalt();
            accounts.push({
              email: normalizedEmail,
              name: name.trim(),
              passwordSalt,
              passwordHash: await hashLocalAccountPassword(password, passwordSalt),
              privateAccount,
              active: true,
            });
            saveLocalCustomerAccounts(accounts);
          } else {
            const accounts = readLocalVendorAccounts();
            if (accounts.some((account) => account.email.toLowerCase() === normalizedEmail) ||
              readLocalCustomerAccounts().some((account) => account.email.toLowerCase() === normalizedEmail) ||
              demoAccounts.some((account) => account.email.toLowerCase() === normalizedEmail)) {
              throw new Error("An account with this email already exists.");
            }
            const passwordSalt = newLocalAccountSalt();
            const vendorId = `local-${crypto.randomUUID()}`;
            accounts.push({
              email: normalizedEmail,
              name: name.trim(),
              passwordSalt,
              passwordHash: await hashLocalAccountPassword(password, passwordSalt),
              vendorId,
              active: true,
            });
            saveLocalVendorAccounts(accounts);
            onLogin({ email: normalizedEmail, name: name.trim(), role: "vendor", vendorId, isNewVendor: true });
            toast.success("Vendor account created. Complete verification next.");
            return;
          }
          onLogin({ email: normalizedEmail, name: name.trim(), role: registrationRole, privateAccount: registrationRole === "customer" ? privateAccount : undefined });
          toast.success("Customer account created.");
          return;
        }
        const result = await liveSignUp({ name: name.trim(), email, password, role: registrationRole });
        if (registrationRole === "customer") {
          try { await saveLiveCustomerPrivacy(privateAccount); }
          catch (error) { toast.error(`Account created, but privacy could not be saved yet: ${authErrorMessage(error)}`); }
        }
        onLogin({ email, name: name.trim(), role: registrationRole, userId: result.user?.id, isNewVendor: registrationRole === "vendor", privateAccount: registrationRole === "customer" ? privateAccount : undefined });
        toast.success(registrationRole === "vendor" ? "Vendor account created. Complete onboarding next." : "Customer account created.");
        return;
      }

      if (!liveMode) {
        const normalizedEmail = email.trim().toLowerCase();
        const localCustomer = readLocalCustomerAccounts().find((account) => account.active !== false && account.email.toLowerCase() === normalizedEmail);
        if (localCustomer) {
          if (!(await verifyLocalCustomerPassword(localCustomer, password))) throw new Error("The email or password is incorrect.");
          if (audience !== "customer") throw new Error("Use Customer login for this account.");
          onLogin({ email: localCustomer.email, name: localCustomer.name, role: "customer", privateAccount: localCustomer.privateAccount });
          return;
        }
        const localVendor = readLocalVendorAccounts().find((account) => account.active && account.email.toLowerCase() === normalizedEmail);
        if (localVendor) {
          if (!(await verifyLocalVendorPassword(localVendor, password))) throw new Error("The email or password is incorrect.");
          if (audience !== "team") throw new Error("Use Vendor / Team login for this account.");
          onLogin({ email: localVendor.email, name: localVendor.name, role: "vendor", vendorId: localVendor.vendorId, isNewVendor: true });
          return;
        }
        const demo = demoAccounts.find((account) => account.email.toLowerCase() === normalizedEmail && account.password === password);
        if (demo) {
          const permitted = audience === "customer" ? demo.role === "customer" : demo.role !== "customer";
          if (!permitted) throw new Error(audience === "customer" ? "Use Customer login for this account." : "Use Vendor / Team login for this account.");
          onLogin({ email: demo.email, name: demo.name, role: demo.role, vendorId: demo.vendorId, isNewVendor: demo.isNewVendor });
          return;
        }
        const staffAccount = readLocalStaffAccount(email, password);
        if (staffAccount) {
          if (audience === "customer") throw new Error("Use Vendor / Team login for this account.");
          onLogin({ email: staffAccount.email, name: staffAccount.name, role: staffAccount.role });
          return;
        }
        throw new Error(audience === "customer"
          ? "No local account found. Create a customer account here, or use a packaged demo account."
          : "Use one of the packaged demo credentials, or a team login created by Super Admin.");
      }
      const live = await liveSignIn(email, password);
      const permitted = audience === "customer" ? live.profile.role === "customer" : live.profile.role !== "customer";
      if (!permitted) throw new Error(audience === "customer" ? "This account belongs in Vendor / Team login." : "This account belongs in Customer login.");
      onLogin({
        email,
        name: live.profile.full_name,
        role: live.profile.role,
        userId: live.user.id,
        vendorId: live.profile.vendor_id ?? undefined,
        p0UpgradeInvitationId: typeof live.user.user_metadata?.p0_upgrade_invitation_id === "string"
          ? live.user.user_metadata.p0_upgrade_invitation_id
          : undefined,
        toursCompleted: live.profile.tours_completed || [],
      });
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally { setBusy(false); }
  }

  return <Dialog open onOpenChange={(open) => !open && close()}><DialogContent className="sp-auth-dialog max-h-[92vh] overflow-y-auto rounded-4xl p-0 sm:max-w-lg"><div className="sp-auth-hero p-6"><div className="k-auth-brand"><img src="/sheplates-logo.png" alt="" />ShePlates</div><DialogHeader><DialogTitle className="text-lg font-black">{audience === "customer" ? (mode === "forgot" ? "Reset password" : "Customer access") : "Vendor / Team access"}</DialogTitle><DialogDescription className="text-white/75">{audience === "customer" ? (mode === "forgot" ? "Enter your registered email address to receive password reset instructions." : "Discover, request quotes and track scheduled orders.") : "Vendors, operations and super admins use this secure entry."}</DialogDescription></DialogHeader><ul className="k-auth-feats"><li><BadgeCheck className="size-6" />Verified home chefs and shops</li><li><CalendarDays className="size-6" />Plan ahead, daily or weekly</li><li><Truck className="size-6" />Track every order to your door</li></ul></div><div className="k-auth-form p-6">
    {audience === "customer" && mode !== "forgot" && <div className="grid grid-cols-2 rounded-2xl bg-stone-100 p-1"><button onClick={() => { setMode("login"); setError(""); }} className={`rounded-xl py-2.5 text-sm font-black ${mode === "login" ? "bg-white shadow-sm" : "text-stone-500"}`}>Sign in</button><button onClick={() => { setMode("create"); setError(""); }} className={`rounded-xl py-2.5 text-sm font-black ${mode === "create" ? "bg-white shadow-sm" : "text-stone-500"}`}>Create account</button></div>}
    
    {mode === "forgot" ? (
      resetSent ? (
        <div className="space-y-4 py-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
            <div className="flex items-start gap-3">
              <BadgeCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              <div>
                <h3 className="text-sm font-black text-emerald-950">Password reset link sent!</h3>
                <p className="mt-1 text-xs leading-5 text-emerald-800">
                  If <b>{email}</b> is registered with ShePlates, you will receive a password reset link shortly. Please check your inbox.
                </p>
                <p className="mt-2 text-[11px] text-emerald-700">
                  Didn't see it? Check your spam or promotions folder.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="button"
              onClick={() => { setMode("login"); setError(""); setResetSent(false); }}
              className="h-12 w-full rounded-xl bg-[#292124] text-sm font-black text-white hover:bg-black"
            >
              Back to sign in
            </Button>
            <button
              type="button"
              onClick={() => { setResetSent(false); setError(""); }}
              className="py-2 text-center text-xs font-bold text-stone-500 hover:text-stone-900"
            >
              Resend link or use a different email
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="sp-auth-form mt-2 space-y-4">
          <p className="text-xs leading-5 text-stone-600">
            Enter the email address associated with your ShePlates account. We will send you a secure link to reset your password.
          </p>
          <InputField label="Registered Email">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onFocus={revealField}
              autoComplete="email"
              inputMode="email"
              className="entry-input"
              placeholder="customer@example.com"
              required
            />
          </InputField>
          {error && <div className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
          <Button
            disabled={busy}
            className="h-12 w-full rounded-xl bg-[#292124] text-base font-black hover:bg-black"
          >
            {busy ? "Sending reset link…" : "Send password reset link"}
            <ArrowRight />
          </Button>
          <button
            type="button"
            onClick={() => { setMode("login"); setError(""); }}
            className="mt-2 w-full text-center text-sm font-bold text-stone-500 hover:text-stone-900"
          >
            ← Back to sign in
          </button>
        </form>
      )
    ) : (
      <>
        {mode === "create" && audience === "customer" && !liveMode && <div className="mt-4 rounded-xl bg-sky-50 p-3 text-xs leading-5 text-sky-900">This test account is saved in this browser only. Configure Supabase for secure sign-in across devices.</div>}
        <form onSubmit={submit} className="sp-auth-form mt-5 space-y-4">
          {mode === "create" && <InputField label="Full name"><input value={name} onChange={(event) => setName(event.target.value)} onFocus={revealField} autoComplete="name" className="entry-input" placeholder="Your name" /></InputField>}
          <InputField label="Email"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} onFocus={revealField} autoComplete="email" inputMode="email" className="entry-input" /></InputField>
          <InputField
            label="Password"
            rightAction={
mode === "login" ? (
              <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setMode("forgot");
                    setError("");
                    setResetSent(false);
                  }}
                  className="text-xs font-bold text-[#653046] hover:underline"
                >
                  Forgot password?
                </button>
              ) : undefined
            }
          >
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} onFocus={revealField} autoComplete={mode === "create" ? "new-password" : "current-password"} className="entry-input" />
          </InputField>
          {/* Supported verification flow: autoComplete="one-time-code" */}
          {mode === "create" && audience === "customer" && <fieldset className="rounded-2xl border border-stone-200 p-4"><legend className="px-1 text-xs font-black uppercase tracking-wider text-stone-500">Account privacy</legend><p className="mb-3 text-xs leading-5 text-stone-500">Choose who can follow you. You can change this later in your profile.</p><div className="grid grid-cols-2 gap-2"><button type="button" aria-pressed={!privateAccount} onClick={() => setPrivateAccount(false)} className={`rounded-xl border p-3 text-left transition ${!privateAccount ? "border-[#753b50] bg-[#f7edf0]" : "border-stone-200"}`}><span className="block text-sm font-black">Public</span><span className="mt-1 block text-xs text-stone-500">Customers can follow you directly.</span></button><button type="button" aria-pressed={privateAccount} onClick={() => setPrivateAccount(true)} className={`rounded-xl border p-3 text-left transition ${privateAccount ? "border-[#753b50] bg-[#f7edf0]" : "border-stone-200"}`}><span className="block text-sm font-black">Private</span><span className="mt-1 block text-xs text-stone-500">Approve customer follow requests.</span></button></div></fieldset>}
          {mode === "create" && audience === "team" && <div className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-900"><b>Vendor registration only.</b> Operations and super-admin access is created by an existing super admin.</div>}
          {error && <div className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
          <Button disabled={busy} className="h-12 w-full rounded-xl bg-[#292124] text-base font-black hover:bg-black">{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}<ArrowRight /></Button>
        </form>
      </>
    )}
    {audience === "team" && <button onClick={() => { setMode(mode === "login" ? "create" : "login"); setError(""); }} className="mt-4 w-full text-center text-sm text-stone-500">{mode === "login" ? <>Not a vendor? <span className="font-black text-[#653046]">Be part of our vendor team</span></> : <>Already registered? <span className="font-black text-[#653046]">Sign in</span></>}</button>}
  </div></DialogContent></Dialog>;
}

function AgentPreview({ open, close, login }: { open: boolean; close: () => void; login: () => void }) {
  const [message, setMessage] = useState("Plan milk every morning and chicken on Sunday under ₹800");
  if (!open) return null;
  return <div className="fixed inset-0 z-80 sm:pointer-events-none"><button onClick={close} className="absolute inset-0 bg-[#292124]/45 backdrop-blur-[2px] sm:pointer-events-auto" aria-label="Close She Agent preview" /><section className="surface-card sp-agent-preview pointer-events-auto absolute inset-x-0 bottom-0 overflow-hidden rounded-t-[30px] border border-white/60 bg-[#faf6f4] shadow-[0_-20px_80px_rgba(25, 19, 21,.25)] sm:bottom-6 sm:right-6 sm:left-auto sm:w-107.5 sm:rounded-[34px] sm:shadow-[0_24px_90px_rgba(25, 19, 21,.3)]">
    <div className="surface-dark relative overflow-hidden p-5 text-white"><div className="absolute -right-12 -top-16 size-44 rounded-full bg-[#753b50]/30 blur-3xl" /><div className="relative flex items-center gap-3"><div className="sp-agent-orb grid size-12 place-items-center rounded-2xl shadow-lg"><Activity /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="text-lg font-black">She Agent</h2><span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white/70">Preview</span></div><p className="text-xs text-white/55">Your agentic local-commerce copilot</p></div><button onClick={close} className="grid size-10 place-items-center rounded-full bg-white/10"><X className="size-4" /></button></div></div>
    <div className="p-5"><div className="surface-card-muted rounded-[22px_22px_22px_8px] p-4 text-sm leading-6 text-stone-600 shadow-sm">Tell me a meal, budget or recurring need. I can shortlist nearby verified options, build a review basket and help you schedule it after sign-in.</div><div className="mt-3 grid grid-cols-3 gap-2">{[{ Icon: Milk, tint: "#2f6fa8", label: "Daily milk" }, { Icon: Soup, tint: "#b1652f", label: "Meal plan" }, { Icon: ShoppingBag, tint: "#7847b8", label: "Budget basket" }].map(({ Icon, tint, label }) => <button key={label} onClick={() => setMessage(label === "Daily milk" ? "Plan milk every morning" : label === "Meal plan" ? "Plan a healthy dinner under ₹400" : "Build groceries under ₹500")} className="surface-card-muted rounded-[22px] p-3 text-center shadow-sm"><div className="mx-auto grid size-8 place-items-center rounded-full bg-white"><Icon className="size-4" style={{ color: tint }} /></div><div className="mt-1.5 text-[10px] font-black">{label}</div></button>)}</div><div className="surface-card-muted mt-4 flex items-end gap-2 rounded-[22px] bg-[#faf6f4] p-2"><textarea value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-16 flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none" /><button onClick={login} className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#753b50] text-white"><ArrowRight className="size-4" /></button></div><Button onClick={login} className="mt-3 h-12 w-full rounded-xl bg-[#292124] font-black text-white hover:bg-black"><Sparkles />Sign in and let She Agent build it</Button><p className="mt-3 text-center text-[10px] leading-4 text-stone-400">Your private profile, nearby catalogue, schedules and orders are only used after sign-in.</p></div>
  </section></div>;
}

function InputField({ label, rightAction, children }: { label: string; rightAction?: React.ReactNode; children: React.ReactNode }) { return <label className="block"><div className="mb-2 flex items-center justify-between"><span className="block text-xs font-black uppercase tracking-wider text-stone-500">{label}</span>{rightAction}</div>{children}</label>; }

function Brand({ dark = false }: { dark?: boolean }) { return <div className="flex min-w-0 items-center gap-2.5 sm:gap-3"><div className={`grid size-10 shrink-0 place-items-center rounded-[14px] sm:size-12 sm:rounded-2xl ${dark ? "surface-card-muted" : "border border-white/10 bg-white/10"}`}><img src="/sheplates-logo.png" alt="ShePlates" className="size-8 rounded-full object-contain sm:size-10" /></div><div className="min-w-0"><div className={`truncate text-lg font-black tracking-[-.03em] sm:text-xl ${dark ? "text-[#292124]" : "text-white"}`}>ShePlates</div><div className={`hidden text-[9px] font-black uppercase tracking-[.18em] min-[390px]:block sm:text-[10px] ${dark ? "text-[#653046]" : "text-white/65"}`}>Agentic local commerce</div></div></div>; }
