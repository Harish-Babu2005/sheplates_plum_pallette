import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(new URL("../app/api/agent/route.ts", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("../lib/she-agent-commerce-runtime.ts", import.meta.url), "utf8");

test("customer commerce uses a model-driven business-tool loop", () => {
  assert.match(route, /runToolDrivenCommerceAgent/);
  assert.match(runtime, /name: "search_catalogue"/);
  assert.match(runtime, /name: "get_customer_context"/);
  assert.match(runtime, /name: "get_order_history"/);
  assert.match(runtime, /name: "get_order_status"/);
  assert.match(runtime, /name: "build_cart"/);
  assert.match(runtime, /tool_choice: "auto"/);
  assert.match(runtime, /type: "function_call_output"/);
  assert.match(runtime, /previous_response_id/);
});

test("natural discovery is delegated to the model rather than phrase routing", () => {
  assert.doesNotMatch(runtime, /if\s*\(.*near me.*\)/i);
  assert.doesNotMatch(runtime, /what products are available near me/i);
  assert.match(runtime, /Understand normal human language semantically/);
  assert.match(runtime, /If the user says 'near me', 'available', 'low calorie'/);
  assert.match(runtime, /search_catalogue/);
});

test("raw Responses API output is parsed from message output items", () => {
  assert.match(runtime, /function extractOutputText/);
  assert.match(runtime, /content\.type === "output_text"/);
  assert.match(runtime, /content\.text/);
  assert.match(runtime, /function extractRefusal/);
});

test("tool results remain role scoped", () => {
  assert.match(runtime, /role === "customer"/);
  assert.match(runtime, /role === "vendor"/);
  assert.match(runtime, /role === "operations" \|\| role === "admin"/);
  assert.match(runtime, /Tool is not available in this role workspace/);
});
