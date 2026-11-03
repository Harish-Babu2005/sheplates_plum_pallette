import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

async function authorised(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anon || !token) return process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
  const client = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: auth } = await client.auth.getUser(token); if (!auth.user) return false;
  const { data: profile } = await client.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  return profile?.role === "vendor" || profile?.role === "admin";
}

export async function POST(request: Request) {
  if (!(await authorised(request))) return NextResponse.json({ error: "Vendor or Super Admin access is required." }, { status: 403 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Image creation is temporarily unavailable." }, { status: 503 });
  const body = await request.json() as { productName?: string; category?: string; pack?: string };
  if (!body.productName?.trim()) return NextResponse.json({ error: "Enter a product name." }, { status: 400 });
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
      size: "1024x1024",
      quality: "medium",
      prompt: `Create a clean realistic ecommerce catalogue photo of ${body.productName}. Category: ${body.category || "food"}. Selling pack: ${body.pack || "retail pack"}. Use an honest neutral product presentation, soft daylight, uncluttered warm background, no people, no text overlays, no fake brand labels, and no misleading quantity.`,
    }),
  });
  const json = await response.json() as { data?: Array<{ b64_json?: string; url?: string }>; error?: { message?: string } };
  if (!response.ok) return NextResponse.json({ error: json.error?.message || "Image creation failed." }, { status: response.status });
  const item = json.data?.[0];
  if (item?.b64_json) return NextResponse.json({ imageDataUrl: `data:image/png;base64,${item.b64_json}` });
  if (item?.url) return NextResponse.json({ imageUrl: item.url });
  return NextResponse.json({ error: "No image was returned." }, { status: 502 });
}
