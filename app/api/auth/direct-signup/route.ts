import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type DirectSignupBody = {
  name?: string;
  email?: string;
  password?: string;
  role?: "customer" | "vendor";
};

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return NextResponse.json({ error: "Account creation is unavailable in this deployment." }, { status: 500 });
  }

  let body: DirectSignupBody;
  try {
    body = await request.json() as DirectSignupBody;
  } catch {
    return NextResponse.json({ error: "Invalid signup request." }, { status: 400 });
  }

  const name = body.name?.trim().slice(0, 120) || "";
  const email = body.email?.trim().toLowerCase().slice(0, 320) || "";
  const password = body.password || "";
  const role = body.role;

  if (!name || !EMAIL_RE.test(email) || password.length < 8 || (role !== "customer" && role !== "vendor")) {
    return NextResponse.json({ error: "Enter a valid name, email and password with at least 8 characters." }, { status: 400 });
  }

  // Service role stays server-side. This route only permits the two public
  // self-service roles; Operations/Admin can never be created through it.
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Do not reset/reconfirm an existing account from this public endpoint.
  // createUser will reject an already-registered email, so this endpoint can
  // never be used to take over or change the password of an existing user.
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name, role },
  });
  if (created.error || !created.data.user) {
    const message = /already|registered|exists/i.test(created.error?.message || "")
      ? "This email is already registered. Please sign in instead."
      : created.error?.message || "Unable to create the account.";
    return NextResponse.json({ error: message }, { status: /already|registered|exists/i.test(message) ? 409 : 400 });
  }

  const userId = created.data.user.id;
  const profile = await admin.from("profiles").upsert(
    { id: userId, full_name: name, role },
    { onConflict: "id" },
  );

  if (profile.error) {
    // Avoid leaving a confirmed Auth user without a ShePlates role profile.
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: profile.error.message }, { status: 500 });
  }

  return NextResponse.json({ userId, role, autoConfirmed: true }, { status: 201 });
}
