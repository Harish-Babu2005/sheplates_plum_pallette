import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type TestSignupBody = {
  name?: string;
  email?: string;
  password?: string;
  role?: "customer" | "vendor";
};

function isLocalHostname(hostname: string) {
  return hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "::1"
    || /^192\.168\./.test(hostname)
    || /^10\./.test(hostname)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
}

export async function POST(request: Request) {
  const hostname = new URL(request.url).hostname;
  const enabled = process.env.SHEPLATES_TEST_AUTO_CONFIRM === "true";

  // This endpoint deliberately cannot be used on a production host. It exists
  // only to make local customer/vendor flow testing independent of email.
  if (!enabled || process.env.NODE_ENV === "production" || !isLocalHostname(hostname)) {
    return NextResponse.json({ error: "Local test signup is disabled." }, { status: 404 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return NextResponse.json({ error: "Live account creation is not available in this deployment." }, { status: 500 });
  }

  const body = await request.json() as TestSignupBody;
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password || "";
  const role = body.role;

  if (!name || !email || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || !["customer", "vendor"].includes(role || "")) {
    return NextResponse.json({ error: "Enter a valid name, email, password and customer/vendor role." }, { status: 400 });
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listed.error) return NextResponse.json({ error: listed.error.message }, { status: 500 });
  const existing = listed.data.users.find((candidate) => candidate.email?.toLowerCase() === email);

  let userId: string;
  if (existing) {
    const profile = await admin.from("profiles").select("role").eq("id", existing.id).maybeSingle();
    if (profile.error) return NextResponse.json({ error: profile.error.message }, { status: 500 });
    if (profile.data?.role && profile.data.role !== role) {
      return NextResponse.json({ error: `This email is already registered as ${profile.data.role}. Use a different email.` }, { status: 409 });
    }
    const updated = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: name, role },
    });
    if (updated.error) return NextResponse.json({ error: updated.error.message }, { status: 400 });
    userId = updated.data.user.id;
  } else {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, role },
    });
    if (created.error) return NextResponse.json({ error: created.error.message }, { status: 400 });
    userId = created.data.user.id;
  }

  const profile = await admin.from("profiles").upsert({ id: userId, full_name: name, role }, { onConflict: "id" });
  if (profile.error) return NextResponse.json({ error: profile.error.message }, { status: 500 });

  return NextResponse.json({ userId, role, autoConfirmed: true });
}
