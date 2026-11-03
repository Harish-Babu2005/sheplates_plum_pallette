import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { TASTE_DIMENSIONS, inferAttributesLocally, type TasteWeights } from "@/lib/taste-match";

// Classifies products into Taste Match dimensions (spicy/chicken/south_indian/...)
// once each, caching the result in food_item_attributes so the same product is
// never re-classified. Uses the existing OpenAI Responses API integration when
// available; otherwise (or on any failure) falls back to a deterministic
// keyword/category classifier so the marketplace never has to wait on, or
// depend on, a live AI call to show a Taste Match score.

function clients(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anon || !service || !token) return null;
  return {
    caller: createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }),
    admin: createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } }),
    token,
  };
}

type ProductInput = { id: string; name: string; category: string; description?: string };

async function classifyWithAI(products: ProductInput[]): Promise<Record<string, TasteWeights> | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !products.length) return null;
  const dimensionProperties = Object.fromEntries(TASTE_DIMENSIONS.map((d) => [d, { type: "number", minimum: 0, maximum: 1 }]));
  const prompt = `Classify each food product into weighted taste dimensions (0 to 1, 0 = not applicable, 1 = strongly applicable). Use only the listed dimensions. Base the weights strictly on the product's name, category and description — do not invent facts about ingredients you cannot infer. Products: ${JSON.stringify(products)}`;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        input: prompt,
        text: {
          format: {
            type: "json_schema", name: "food_attribute_classification", strict: true,
            schema: {
              type: "object", additionalProperties: false,
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object", additionalProperties: false,
                    properties: { productId: { type: "string" }, attributes: { type: "object", additionalProperties: false, properties: dimensionProperties, required: [...TASTE_DIMENSIONS] } },
                    required: ["productId", "attributes"],
                  },
                },
              },
              required: ["items"],
            },
          },
        },
      }),
    });
    if (!response.ok) return null;
    const data = await response.json() as { output?: Array<{ content?: Array<{ text?: string }> }> };
    const text = data.output?.flatMap((item) => item.content || []).map((c) => c.text).find(Boolean);
    if (!text) return null;
    const parsed = JSON.parse(text) as { items: { productId: string; attributes: TasteWeights }[] };
    const result: Record<string, TasteWeights> = {};
    for (const item of parsed.items) {
      const trimmed: TasteWeights = {};
      for (const [dimension, value] of Object.entries(item.attributes)) if (typeof value === "number" && value >= 0.2) trimmed[dimension] = value;
      result[item.productId] = trimmed;
    }
    return result;
  } catch (error) {
    console.error("[food-attributes] AI classification failed, using local fallback", error);
    return null;
  }
}

export async function POST(request: Request) {
  const c = clients(request);
  if (!c) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data: authData } = await c.caller.auth.getUser(c.token);
  if (!authData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null) as { products?: ProductInput[] } | null;
  const products = (body?.products || []).filter((p) => p?.id && p?.name).slice(0, 16);
  if (!products.length) return NextResponse.json({ attributes: {} });

  const existing = await c.admin.from("food_item_attributes").select("product_id,attributes").in("product_id", products.map((p) => p.id));
  const cached: Record<string, TasteWeights> = {};
  for (const row of existing.data || []) cached[row.product_id as string] = row.attributes as TasteWeights;

  const uncached = products.filter((p) => !cached[p.id]);
  if (uncached.length) {
    const aiResult = await classifyWithAI(uncached);
    const rowsToInsert = uncached.map((p) => {
      const attributes = aiResult?.[p.id] && Object.keys(aiResult[p.id]).length ? aiResult[p.id] : inferAttributesLocally(p.name, p.category);
      cached[p.id] = attributes;
      return { product_id: p.id, attributes, source: "inferred" as const };
    });
    const inserted = await c.admin.from("food_item_attributes").upsert(rowsToInsert, { onConflict: "product_id" });
    if (inserted.error) console.error("[food-attributes] cache write failed", inserted.error.message);
  }

  return NextResponse.json({ attributes: cached });
}
