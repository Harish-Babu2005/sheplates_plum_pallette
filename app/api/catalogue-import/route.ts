import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function extractText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output as Array<Record<string, unknown>> : [];
  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content as Array<Record<string, unknown>> : [];
    for (const part of content) if (typeof part.text === "string" && part.text.trim()) return part.text;
  }
  return "";
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = process.env.OPENAI_API_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anon || !token) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: auth } = await caller.auth.getUser(token);
  if (!auth.user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const { data: profile } = await caller.from("profiles").select("role,vendor_id").eq("id", auth.user.id).maybeSingle();
  if (!profile || !["vendor", "admin"].includes(profile.role)) return NextResponse.json({ error: "Vendor access is required." }, { status: 403 });
  const body = await request.json() as { text?: string; defaultCategory?: string };
  const raw = String(body.text || "").trim().slice(0, 30000);
  if (!raw) return NextResponse.json({ error: "The uploaded list is empty." }, { status: 400 });
  if (!key) return NextResponse.json({ error: "Smart list reading is temporarily unavailable." }, { status: 503 });

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      items: {
        type: "array",
        maxItems: 150,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" }, category: { type: "string" }, pack: { type: "string" }, price: { type: "number" }, stock: { type: "number" },
          },
          required: ["name", "category", "pack", "price", "stock"],
        },
      },
    },
    required: ["items"],
  };
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      input: [
        { role: "system", content: [{ type: "input_text", text: "Convert a vendor product/grocery list into clean catalogue draft rows. Preserve product names faithfully. Infer only obvious categories and pack descriptions. If price or stock are absent, return 0 for price and 1 for stock. Never invent brands, claims or nutrition. The vendor will review every row before publication." }] },
        { role: "user", content: [{ type: "input_text", text: `Default category: ${body.defaultCategory || "Groceries"}\n\nList:\n${raw}` }] },
      ],
      text: { format: { type: "json_schema", name: "catalogue_import", strict: true, schema } },
    }),
  });
  const json = await response.json() as Record<string, unknown>;
  if (!response.ok) return NextResponse.json({ error: "The list could not be read right now." }, { status: 502 });
  try {
    const parsed = JSON.parse(extractText(json)) as { items?: unknown[] };
    return NextResponse.json({ items: parsed.items || [] });
  } catch {
    return NextResponse.json({ error: "The list needs manual review." }, { status: 422 });
  }
}
