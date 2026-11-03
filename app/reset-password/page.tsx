"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCcw,
  ShieldCheck,
} from "@/components/icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
  updatePassword,
} from "@/lib/supabase";

type PageState = "loading" | "ready" | "success" | "invalid";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [userEmail, setUserEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [busy, setBusy] = useState(false);
const [resetAudience, setResetAudience] = useState<"customer" | "team">("customer");
  const supabaseAvailable = isSupabaseConfigured();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check for error parameters in URL hash or search params
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(search);
setResetAudience(
  searchParams.get("audience") === "team" ? "team" : "customer"
);
    const errorParam = hashParams.get("error") || searchParams.get("error");
    const errorDescription =
      hashParams.get("error_description") ||
      searchParams.get("error_description") ||
      "";

    if (errorParam) {
      setErrorMessage(
        errorDescription.replace(/\+/g, " ") ||
          "This password reset link is invalid, expired, or has already been used.",
      );
      setPageState("invalid");
      return;
    }

    if (!supabaseAvailable) {
      setErrorMessage(
        "Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local and set NEXT_PUBLIC_DEMO_MODE=false to enable live password reset.",
      );
      setPageState("invalid");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setErrorMessage(
        "Supabase client could not be initialized. Verify environment configuration.",
      );
      setPageState("invalid");
      return;
    }

    let resolved = false;

    // Check for PKCE authorization code in URL
    const code = searchParams.get("code");
    if (code) {
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ data, error }) => {
          if (error) {
            setErrorMessage(error.message || "Invalid or expired reset code.");
            setPageState("invalid");
          } else if (data.session) {
            resolved = true;
            if (data.session.user.email) {
              setUserEmail(data.session.user.email);
            }
            setPageState("ready");
          }
        })
        .catch((err: unknown) => {
          setErrorMessage(
            err instanceof Error ? err.message : "Could not verify reset link.",
          );
          setPageState("invalid");
        });
      return;
    }

    // Listen to Supabase auth events (detects recovery token in hash)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        resolved = true;
        if (session?.user?.email) {
          setUserEmail(session.user.email);
        }
        setPageState("ready");
      }
    });

    // Check if a recovery session is already loaded
    supabase.auth.getSession().then(({ data, error }) => {
      if (!resolved) {
        if (error) {
          setErrorMessage(error.message);
          setPageState("invalid");
        } else if (data.session) {
          if (data.session.user.email) {
            setUserEmail(data.session.user.email);
          }
          setPageState("ready");
        } else {
          // If hash has access token, give supabase-js a moment to parse
          if (hash.includes("access_token") || hash.includes("type=recovery")) {
            setTimeout(() => {
              supabase.auth.getSession().then(({ data: secondCheck }) => {
                if (secondCheck.session) {
                  if (secondCheck.session.user.email) {
                    setUserEmail(secondCheck.session.user.email);
                  }
                  setPageState("ready");
                } else {
                  setErrorMessage(
                    "The password reset link has expired or is invalid.",
                  );
                  setPageState("invalid");
                }
              });
            }, 600);
          } else {
            // No token found in URL
            setErrorMessage(
              "No active password reset token found. Please request a new password reset email.",
            );
            setPageState("invalid");
          }
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabaseAvailable]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage("");

    // Validate password
    if (!password) {
      setErrorMessage("Enter a new password.");
      return;
    }
    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please re-enter.");
      return;
    }

    setBusy(true);

    try {
      if (!isSupabaseConfigured()) {
        throw new Error(
          "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local to update your account password.",
        );
      }

      // Live Supabase Auth password update
      // Live Supabase Auth password update
await updatePassword(password);

// Notify the original ShePlates tab
const audience =
  new URLSearchParams(window.location.search).get("audience") === "team"
    ? "team"
    : "customer";

if ("BroadcastChannel" in window) {
  const channel = new BroadcastChannel("sheplates-password-reset");

  channel.postMessage({
    type: "PASSWORD_RESET_COMPLETED",
    audience,
  });

  channel.close();
}

toast.success("Password updated successfully!");
setPageState("success");

    } catch (caught: unknown) {
      const msg =
        caught instanceof Error
          ? caught.message
          : "Could not update your password. The link may have expired.";
      setErrorMessage(msg);
      if (/expired|invalid|token/i.test(msg)) {
        setPageState("invalid");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#faf6f4] text-[#292124]">
      <Toaster position="top-center" richColors />

      {/* Header */}
      <header className="mx-auto flex h-20 max-w-370 items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl border border-stone-200 bg-white shadow-xs">
            <img
              src="/sheplates-logo.png"
              alt="ShePlates"
              className="size-8 rounded-full object-contain"
            />
          </div>
          <div>
            <div className="text-xl font-black tracking-[-.03em] text-[#292124]">
              ShePlates
            </div>
            <div className="text-[10px] font-black uppercase tracking-[.18em] text-[#653046]">
              Agentic local commerce
            </div>
          </div>
        </Link>
        <Link
          href="/"
          className="text-xs font-bold text-stone-500 transition hover:text-stone-900"
        >
          ← Back to home
        </Link>
      </header>

      {/* Main Container */}
      <main className="mx-auto flex max-w-lg flex-col px-4 pb-16 pt-6 sm:pt-12">
        <div className="overflow-hidden rounded-3xl border border-stone-200/70 bg-white shadow-xl shadow-stone-200/40">
          {/* Card Hero Header */}
          <div className="bg-linear-to-r from-[#753b50] via-[#753b50] to-[#753b50] p-6 text-white sm:p-7">
            <div className="flex items-center gap-2.5 text-xs font-black uppercase tracking-wider text-white/80">
              <KeyRound className="size-4" />
              <span>Security</span>
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
              {pageState === "success"
                ? "Password updated"
                : pageState === "invalid"
                  ? "Reset link problem"
                  : "Set a new password"}
            </h1>
            <p className="mt-1 text-sm text-white/85">
              {pageState === "success"
                ? "Your new password is now active."
                : pageState === "invalid"
                  ? "We could not verify your password reset link."
                  : "Choose a secure password with at least 8 characters."}
            </p>
          </div>

          <div className="p-6 sm:p-8">
            {/* Loading State */}
            {pageState === "loading" && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <RefreshCcw className="size-8 animate-spin text-[#653046]" />
                <p className="mt-4 text-sm font-bold text-stone-600">
                  Verifying your reset link…
                </p>
                <p className="mt-1 text-xs text-stone-400">
                  Checking security credentials with ShePlates
                </p>
              </div>
            )}

            {/* Invalid or Expired State */}
            {pageState === "invalid" && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600" />
                    <div>
                      <h3 className="text-sm font-black text-red-950">
                        Invalid or expired link
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-red-800">
                        {errorMessage ||
                          "This password reset link is invalid, expired, or has already been used. Password reset links are single-use and time-limited for your protection."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    onClick={() => router.push("/?forgot=true")}
                    className="h-12 w-full rounded-xl bg-[#292124] text-sm font-black text-white hover:bg-black"
                  >
                    Request a new reset link <ArrowRight className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push("/")}
                    className="h-12 w-full rounded-xl border-stone-200 font-bold"
                  >
                    Return to home
                  </Button>
                </div>
              </div>
            )}

            {/* Success State */}
            {pageState === "success" && (
              <div className="space-y-6 text-center">
                <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="size-8" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-stone-900">
                    All set!
                  </h2>
                  <p className="mt-2 text-sm text-stone-600">
                    Your password has been changed successfully. You can now
                    sign in with your new credentials.
                  </p>
                </div>
              <Button
  onClick={() =>
    router.push(`/?login=${resetAudience}`)
  }
  className="h-12 w-full rounded-xl bg-[#753b50] text-sm font-black text-white hover:bg-[#292124]"
>
  Go to {resetAudience === "team" ? "Vendor / Team" : "Customer"} sign in
  <ArrowRight className="size-4" />
</Button>
              </div>
            )}

            {/* Ready / Input Form State */}
            {pageState === "ready" && (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* User email badge if session email exists */}
                {userEmail && (
                  <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-wider text-stone-500">
                        Resetting password for
                      </div>
                      <div className="truncate text-sm font-bold text-stone-900">
                        {userEmail}
                      </div>
                    </div>
                    <BadgeCheck className="size-5 shrink-0 text-[#653046]" />
                  </div>
                )}

                {/* New Password */}
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-wider text-stone-500">
                    New password
                  </span>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      className="entry-input pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </label>

                {/* Confirm Password */}
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-wider text-stone-500">
                    Confirm new password
                  </span>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your new password"
                      autoComplete="new-password"
                      className="entry-input pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                      aria-label={
                        showConfirm ? "Hide password" : "Show password"
                      }
                    >
                      {showConfirm ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </label>

                {/* Password rule check indicator */}
                <div className="space-y-1.5 text-xs text-stone-500">
                  <div
                    className={`flex items-center gap-1.5 ${
                      password.length >= 8 ? "font-bold text-emerald-600" : ""
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        password.length >= 8 ? "bg-emerald-500" : "bg-stone-300"
                      }`}
                    />
                    At least 8 characters
                  </div>
                  <div
                    className={`flex items-center gap-1.5 ${
                      confirmPassword && password === confirmPassword
                        ? "font-bold text-emerald-600"
                        : ""
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        confirmPassword && password === confirmPassword
                          ? "bg-emerald-500"
                          : "bg-stone-300"
                      }`}
                    />
                    Passwords match
                  </div>
                </div>

                {errorMessage && (
                  <div className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
                    {errorMessage}
                  </div>
                )}

                <Button
                  disabled={busy}
                  className="h-12 w-full rounded-xl bg-[#292124] text-base font-black text-white hover:bg-black"
                >
                  {busy ? "Updating password…" : "Update password"}
                  <ArrowRight />
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Security badge footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs font-bold text-stone-400">
          <ShieldCheck className="size-4 text-[#653046]" />
          <span>Secured with ShePlates Authentication</span>
        </div>
      </main>
    </div>
  );
}
