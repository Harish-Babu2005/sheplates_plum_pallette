import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return NextResponse.json({ error: "Image storage is unavailable." }, { status: 503 });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Sign in to upload an image." }, { status: 401 });

  const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: authData } = await caller.auth.getUser(token);
  if (!authData.user) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const { data: profile } = await caller.from("profiles").select("role,vendor_id").eq("id", authData.user.id).maybeSingle();
  if (!profile || !["vendor", "admin"].includes(profile.role)) return NextResponse.json({ error: "Vendor or Super Admin access is required." }, { status: 403 });

  const body = await request.json() as { vendorId?: string; dataUrl?: string };
  const vendorId = body.vendorId?.trim();
  const match = body.dataUrl?.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!vendorId || !match) return NextResponse.json({ error: "Upload a valid product image." }, { status: 400 });
  if (profile.role === "vendor" && profile.vendor_id && profile.vendor_id !== vendorId) return NextResponse.json({ error: "This image belongs to another store." }, { status: 403 });

  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 10 * 1024 * 1024) return NextResponse.json({ error: "Image must be under 10 MB." }, { status: 413 });
  const mime = match[1];
  const ext = mime.includes("webp") ? "webp" : mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "png";
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  const buckets = await admin.storage.listBuckets();
  if (!buckets.data?.some((bucket) => bucket.name === "product-images")) {
    const created = await admin.storage.createBucket("product-images", { public: true, fileSizeLimit: "10MB", allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"] });
    if (created.error && !/already exists/i.test(created.error.message)) return NextResponse.json({ error: created.error.message }, { status: 500 });
  }

  const path = `${vendorId}/${crypto.randomUUID()}.${ext}`;
  const uploaded = await admin.storage.from("product-images").upload(path, bytes, { contentType: mime, upsert: false });
  if (uploaded.error) return NextResponse.json({ error: uploaded.error.message }, { status: 500 });
  const publicUrl = admin.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  return NextResponse.json({ publicUrl });
}
