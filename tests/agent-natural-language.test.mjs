import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("She Agent routes customer language through semantic assistant reasoning", async () => {
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  const agent = await readFile(path.join(root, "app/api/agent/route.ts"), "utf8");

  assert.doesNotMatch(ui, /RECOMMENDATION_PATTERNS/);
  assert.doesNotMatch(ui, /TRACK_ORDER_PATTERNS/);
  assert.doesNotMatch(ui, /ADD_TO_CART_VERBS/);
  assert.doesNotMatch(ui, /detectRecommendation/);
  assert.doesNotMatch(ui, /detectAddToCart/);
  assert.doesNotMatch(ui, /parseRupeeBudget/);
  // live mode never uploads the browser's copy of the data: the server loads the verified context itself
  assert.match(ui, /body: JSON\.stringify\(\{ task: "commerce", message: text, context: isLiveSupabaseMode\(\) \? undefined : scope, history, role: session\.role \}\)/);

  assert.match(agent, /never depend on keyword, phrase, regex, or command matching/i);
  assert.match(agent, /intent: \{ type: "string", enum: \["browse", "recommend", "add_to_basket"/);
  assert.match(agent, /selectedProductIds/);
  assert.match(agent, /basketProductIds/);
  assert.match(agent, /availableProducts/);
  assert.match(agent, /If the user asks what is available nearby or asks to browse/);
  assert.match(agent, /Do not respond with generic instructions about what the user could ask/);
});

test("product-facing copy does not expose implementation brands or developer configuration", async () => {
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  const entry = await readFile(path.join(root, "components/sheplates-entry.tsx"), "utf8");

  for (const source of [ui, entry]) {
    assert.doesNotMatch(source, /Supabase sync|saved to Supabase|RLS-protected|with OpenAI|OpenAI analyses|OPENAI_API_KEY|gpt-/i);
  }
});
