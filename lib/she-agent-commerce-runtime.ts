type Role = "customer" | "vendor" | "operations" | "admin";

type AgentHistoryItem = { role: "user" | "agent"; text: string; productIds?: string[] };

export type CommerceResult = {
  reply: string;
  intent: "browse" | "recommend" | "add_to_basket" | "remove_from_basket" | "view_basket" | "track" | "navigate" | "support" | "quality_issue" | "clarify" | "answer" | "other";
  budget: number;
  selectedProductIds: string[];
  basketProductIds: string[];
  removeProductIds: string[];
  navigateTo: "" | "Marketplace" | "Cart" | "My schedule" | "Monthly requirement" | "My quotations" | "Orders" | "Profile & food" | "Ticket centre";
  clarifyingQuestion: string;
  requiresPhoto: boolean;
  targetOrderId: string;
  createTicket: boolean;
  ticketSubject: string;
  ticketCategory: "Order" | "Payment" | "Vendor" | "Delivery" | "Other";
  ticketPriority: "Low" | "Normal" | "High" | "Urgent";
  memoryUpdates?: Array<{ key: string; value: string; confidence: number }>;
};

type OpenAIOutputItem = {
  type?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  content?: Array<{ type?: string; text?: string; refusal?: string }>;
};

type OpenAIResponse = {
  id?: string;
  status?: string;
  output_text?: string;
  output?: OpenAIOutputItem[];
  error?: { message?: string; code?: string; type?: string } | null;
};

type ToolDefinition = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict: true;
};

type ToolCall = { callId: string; name: string; args: Record<string, unknown> };

const MEMORY_KEYS = ["preferred_budget", "dietary_preference", "favorite_categories", "favorite_products", "disliked_items", "calorie_target", "protein_preference", "delivery_window", "household_preference"] as const;

function asObjects(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [];
}

function text(value: unknown) { return String(value ?? "").trim(); }
function number(value: unknown, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }

function productId(row: Record<string, unknown>) { return text(row.item_id || row.id); }
function productName(row: Record<string, unknown>) { return text(row.item_name || row.name || "Product"); }
function productPrice(row: Record<string, unknown>) { return number(row.customer_price ?? row.vendorPrice ?? row.vendor_base_price, 0); }
function productCalories(row: Record<string, unknown>) { return number(row.calories_per_unit ?? row.calories, 0); }
function productProtein(row: Record<string, unknown>) { return number(row.protein_g ?? row.protein, 0); }
function productDistance(row: Record<string, unknown>) { return number(row.distance_km ?? row.liveDistanceKm, 0); }
function productDietaryTags(row: Record<string, unknown>) {
  const value = row.dietary_tags ?? row.dietaryTags;
  return Array.isArray(value) ? value.map(text).filter(Boolean) : text(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function compactProduct(row: Record<string, unknown>) {
  return {
    item_id: productId(row),
    name: productName(row),
    vendor_id: text(row.vendor_id || row.vendorId),
    vendor_name: text(row.vendor_name || row.vendorName || row.businessName),
    category: text(row.category),
    unit: text(row.unit || row.baseUnit),
    price: productPrice(row),
    stock: number(row.stock_quantity ?? row.stock, 0),
    calories: productCalories(row),
    protein_g: productProtein(row),
    carbs_g: number(row.carbs_g ?? row.carbs, 0),
    fat_g: number(row.fat_g ?? row.fat, 0),
    fibre_g: number(row.fibre_g ?? row.fibre, 0),
    nutrition_available: productCalories(row) > 0 && text(row.nutrition_status).toLowerCase() !== "pending_review",
    dietary_tags: productDietaryTags(row),
    distance_km: productDistance(row),
    delivery_enabled: Boolean(row.delivery_enabled ?? row.delivery),
    pickup_enabled: Boolean(row.pickup_enabled ?? row.pickup),
  };
}

function customerTools(): ToolDefinition[] {
  return [
    {
      type: "function", name: "search_catalogue",
      description: "Search the signed-in customer's currently serviceable ShePlates catalogue. Use this whenever the customer asks what is available, nearby, cheaper, healthier, lower calorie, higher protein, from a category, from a vendor, or suitable for a budget. Returns only real currently serviceable items.",
      parameters: {
        type: "object", additionalProperties: false,
        properties: {
          query: { type: "string", description: "Optional product/vendor/category words to match. Use an empty string when filters alone express the request." },
          category: { type: "string", description: "Optional exact or partial category." },
          vendor: { type: "string", description: "Optional vendor name." },
          max_price: { type: "number", description: "Maximum price for one item when the request implies one." },
          max_calories: { type: "number", description: "Maximum calories per selling pack." },
          min_protein: { type: "number", description: "Minimum protein grams per selling pack." },
          dietary_tags: { type: "array", items: { type: "string" }, description: "Dietary tags the item should match." },
          max_distance_km: { type: "number", description: "Optional maximum distance in kilometres." },
          sort_by: { type: "string", enum: ["relevance", "price_low", "calories_low", "protein_high", "distance_low"] },
          limit: { type: "integer", minimum: 1, maximum: 12 },
        },
        required: ["query", "category", "vendor", "max_price", "max_calories", "min_protein", "dietary_tags", "max_distance_km", "sort_by", "limit"],
      }, strict: true,
    },
    {
      type: "function", name: "get_customer_context",
      description: "Get the signed-in customer's own food preferences and remembered commerce preferences. Use when personalization is useful. Never returns another customer's information.",
      parameters: { type: "object", additionalProperties: false, properties: {}, required: [] }, strict: true,
    },
    {
      type: "function", name: "get_current_cart",
      description: "Get the signed-in customer's current review basket.",
      parameters: { type: "object", additionalProperties: false, properties: {}, required: [] }, strict: true,
    },
    {
      type: "function", name: "build_cart",
      description: "Validate a proposed basket against the current serviceable catalogue and calculate the live total. This is read-only and never checks out or charges the customer. Use before proposing a multi-item basket or when the customer asks to add a set of items.",
      parameters: {
        type: "object", additionalProperties: false,
        properties: {
          items: { type: "array", minItems: 1, maxItems: 12, items: { type: "object", additionalProperties: false, properties: { item_id: { type: "string" }, quantity: { type: "number", minimum: 0.001 } }, required: ["item_id", "quantity"] } },
          budget: { type: "number", description: "Use -1 when no overall basket budget was stated." },
        },
        required: ["items", "budget"],
      }, strict: true,
    },
    {
      type: "function", name: "get_order_history",
      description: "Get recent orders belonging only to the signed-in customer. Use for repeat-order, purchase-history and order questions.",
      parameters: { type: "object", additionalProperties: false, properties: { limit: { type: "integer", minimum: 1, maximum: 20 } }, required: ["limit"] }, strict: true,
    },
    {
      type: "function", name: "get_order_status",
      description: "Get one order belonging to the signed-in customer. Use when the customer refers to an order number or asks about a specific or next order.",
      parameters: { type: "object", additionalProperties: false, properties: { order_reference: { type: "string" } }, required: ["order_reference"] }, strict: true,
    },
    {
      type: "function", name: "get_schedules",
      description: "Get the signed-in customer's own recurring product schedules.",
      parameters: { type: "object", additionalProperties: false, properties: {}, required: [] }, strict: true,
    },
    {
      type: "function", name: "get_quotations",
      description: "Get the signed-in customer's own monthly requirements and vendor quotations.",
      parameters: { type: "object", additionalProperties: false, properties: {}, required: [] }, strict: true,
    },
  ];
}

function vendorTools(): ToolDefinition[] {
  return [
    { type: "function", name: "get_vendor_workspace", description: "Get the signed-in vendor's own store profile and operational status.", parameters: { type: "object", additionalProperties: false, properties: {}, required: [] }, strict: true },
    { type: "function", name: "search_vendor_catalogue", description: "Search only the signed-in vendor's own catalogue and stock.", parameters: { type: "object", additionalProperties: false, properties: { query: { type: "string" }, low_stock_only: { type: "boolean" }, limit: { type: "integer", minimum: 1, maximum: 30 } }, required: ["query", "low_stock_only", "limit"] }, strict: true },
    { type: "function", name: "get_vendor_orders", description: "Get only orders assigned to the signed-in vendor.", parameters: { type: "object", additionalProperties: false, properties: { limit: { type: "integer", minimum: 1, maximum: 50 } }, required: ["limit"] }, strict: true },
    { type: "function", name: "get_quote_opportunities", description: "Get RFQ opportunities visible to the signed-in vendor and that vendor's own quotations.", parameters: { type: "object", additionalProperties: false, properties: {}, required: [] }, strict: true },
    { type: "function", name: "get_vendor_payouts", description: "Get only the signed-in vendor's payouts and settlement records.", parameters: { type: "object", additionalProperties: false, properties: { limit: { type: "integer", minimum: 1, maximum: 50 } }, required: ["limit"] }, strict: true },
  ];
}

function operationsTools(admin: boolean): ToolDefinition[] {
  const base: ToolDefinition[] = [
    { type: "function", name: "get_operational_summary", description: "Get a compact operational summary across the records authorised for Operations.", parameters: { type: "object", additionalProperties: false, properties: {}, required: [] }, strict: true },
    { type: "function", name: "search_operational_orders", description: "Search authorised platform orders by status, vendor/customer reference or free text.", parameters: { type: "object", additionalProperties: false, properties: { query: { type: "string" }, status: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 50 } }, required: ["query", "status", "limit"] }, strict: true },
    { type: "function", name: "search_vendors", description: "Search authorised vendor operational records.", parameters: { type: "object", additionalProperties: false, properties: { query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 50 } }, required: ["query", "limit"] }, strict: true },
    { type: "function", name: "get_operational_exceptions", description: "Get cancellations, payment/payout states and open support tickets that may need operational attention.", parameters: { type: "object", additionalProperties: false, properties: { limit: { type: "integer", minimum: 1, maximum: 50 } }, required: ["limit"] }, strict: true },
  ];
  if (admin) base.push(
    { type: "function", name: "get_campaigns", description: "Get Super Admin campaign and merchandising context.", parameters: { type: "object", additionalProperties: false, properties: {}, required: [] }, strict: true },
    { type: "function", name: "get_governance_summary", description: "Get Super Admin-only governance, settings, vendor-plan and audit context.", parameters: { type: "object", additionalProperties: false, properties: {}, required: [] }, strict: true },
  );
  return base;
}

function toolsForRole(role: Role) {
  return role === "customer" ? customerTools() : role === "vendor" ? vendorTools() : operationsTools(role === "admin");
}

function filterSearch(products: Record<string, unknown>[], args: Record<string, unknown>) {
  const query = text(args.query).toLowerCase();
  const terms = query.split(/\s+/).filter((term) => term.length > 1);
  const category = text(args.category).toLowerCase();
  const vendor = text(args.vendor).toLowerCase();
  const maxPrice = number(args.max_price, -1);
  const maxCalories = number(args.max_calories, -1);
  const minProtein = number(args.min_protein, -1);
  const maxDistance = number(args.max_distance_km, -1);
  const tags = Array.isArray(args.dietary_tags) ? args.dietary_tags.map((tag) => text(tag).toLowerCase()).filter(Boolean) : [];
  const sortBy = text(args.sort_by) || "relevance";
  const limit = Math.max(1, Math.min(12, Math.floor(number(args.limit, 8))));
  const scored = products.map((row) => {
    const compact = compactProduct(row);
    const haystack = `${compact.name} ${compact.vendor_name} ${compact.category} ${compact.dietary_tags.join(" ")}`.toLowerCase();
    const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
    return { row, compact, score, haystack };
  }).filter(({ compact, score, haystack }) => {
    if (terms.length && score === 0) return false;
    if (category && !compact.category.toLowerCase().includes(category)) return false;
    if (vendor && !compact.vendor_name.toLowerCase().includes(vendor)) return false;
    if (maxPrice >= 0 && compact.price > maxPrice) return false;
    if (maxCalories >= 0 && (!compact.nutrition_available || compact.calories > maxCalories)) return false;
    if (minProtein >= 0 && compact.protein_g < minProtein) return false;
    if (maxDistance >= 0 && compact.distance_km > maxDistance) return false;
    if (tags.length && !tags.every((tag) => haystack.includes(tag))) return false;
    return true;
  });
  scored.sort((a, b) => {
    if (sortBy === "price_low") return a.compact.price - b.compact.price;
    if (sortBy === "calories_low") return (a.compact.nutrition_available ? a.compact.calories : Number.POSITIVE_INFINITY) - (b.compact.nutrition_available ? b.compact.calories : Number.POSITIVE_INFINITY);
    if (sortBy === "protein_high") return b.compact.protein_g - a.compact.protein_g;
    if (sortBy === "distance_low") return a.compact.distance_km - b.compact.distance_km;
    return b.score - a.score || a.compact.distance_km - b.compact.distance_km || a.compact.price - b.compact.price;
  });
  return scored.slice(0, limit).map(({ compact }) => compact);
}

function executeTool(role: Role, context: Record<string, unknown>, name: string, args: Record<string, unknown>) {
  if (role === "customer") {
    const products = asObjects(context.availableProducts);
    if (name === "search_catalogue") {
      const items = filterSearch(products, args);
      return { count: items.length, items, source: "current_serviceable_marketplace" };
    }
    if (name === "get_customer_context") return { preferences: context.preferences || null, remembered_preferences: context.memory || [] };
    if (name === "get_current_cart") {
      const productMap = new Map<string, ReturnType<typeof compactProduct>>();
      for (const row of products) {
        const id = productId(row);
        if (id) productMap.set(id, compactProduct(row));
      }
      const items = asObjects(context.cartItems).map((row) => ({
        ...row,
        product: productMap.get(text(row.menu_item_id)) || null,
        line_total: Math.round(number(row.unit_price, 0) * number(row.quantity, 1) * 100) / 100,
      }));
      return { items, total: Math.round(items.reduce((sum, item) => sum + number(item.line_total, 0), 0) * 100) / 100 };
    }
    if (name === "build_cart") {
      const allowed = new Map<string, Record<string, unknown>>();
      for (const row of products) {
        const id = productId(row);
        if (id) allowed.set(id, row);
      }
      const requested = Array.isArray(args.items) ? args.items.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [];
      const budget = number(args.budget, -1);
      let total = 0;
      const items = requested.map((request) => {
        const id = text(request.item_id); const quantity = Math.max(0.001, number(request.quantity, 1)); const row = allowed.get(id);
        if (!row) return { item_id: id, quantity, valid: false, reason: "Item is not currently serviceable" };
        const compact = compactProduct(row); const lineTotal = Math.round(compact.price * quantity * 100) / 100; total += lineTotal;
        return { ...compact, quantity, line_total: lineTotal, valid: true };
      });
      total = Math.round(total * 100) / 100;
      return { items, total, currency: "INR", within_budget: budget < 0 || total <= budget + 0.001, budget: budget < 0 ? null : budget, requires_customer_confirmation: true };
    }
    if (name === "get_order_history") {
      const limit = Math.max(1, Math.min(20, Math.floor(number(args.limit, 10))));
      const orders = [...asObjects(context.orders)].sort((a, b) => text(b.created_at).localeCompare(text(a.created_at)));
      return { orders: orders.slice(0, limit) };
    }
    if (name === "get_order_status") {
      const ref = text(args.order_reference).toLowerCase(); const orders = asObjects(context.orders);
      const today = new Date().toISOString().slice(0, 10);
      const nextOrder = [...orders].filter((row) => text(row.scheduled_date) >= today && !["cancelled", "completed"].includes(text(row.status).toLowerCase())).sort((a, b) => text(a.scheduled_date).localeCompare(text(b.scheduled_date)))[0];
      const latestOrder = [...orders].sort((a, b) => text(b.created_at).localeCompare(text(a.created_at)))[0];
      const order = orders.find((row) => text(row.id).toLowerCase() === ref || text(row.order_number).toLowerCase() === ref) || (ref === "next" ? nextOrder : undefined) || (["latest", "last", "recent"].includes(ref) ? latestOrder : undefined);
      return order ? { order } : { error: "No matching order exists in this customer account." };
    }
    if (name === "get_schedules") return { schedules: context.schedules || [] };
    if (name === "get_quotations") return { requirements: context.requirements || [], quotations: context.quotations || [] };
  }

  if (role === "vendor") {
    if (name === "get_vendor_workspace") return { vendor: context.vendor || null };
    if (name === "search_vendor_catalogue") {
      const query = text(args.query).toLowerCase(); const lowStock = Boolean(args.low_stock_only); const limit = Math.max(1, Math.min(30, Math.floor(number(args.limit, 20))));
      const products = asObjects(context.products).filter((row) => {
        const hay = `${text(row.name)} ${text(row.category)} ${text(row.unit)}`.toLowerCase();
        if (query && !query.split(/\s+/).every((term) => hay.includes(term))) return false;
        if (lowStock && number(row.stock_quantity, 0) > 10) return false;
        return true;
      }).slice(0, limit);
      return { count: products.length, products };
    }
    if (name === "get_vendor_orders") return { orders: asObjects(context.orders).slice(0, Math.max(1, Math.min(50, Math.floor(number(args.limit, 20))))) };
    if (name === "get_quote_opportunities") return { opportunities: context.quoteOpportunities || context.quoteInvitations || [], quotations: context.quotations || [] };
    if (name === "get_vendor_payouts") return { payouts: asObjects(context.payouts).slice(0, Math.max(1, Math.min(50, Math.floor(number(args.limit, 20))))) };
  }

  if (role === "operations" || role === "admin") {
    if (name === "get_operational_summary") return {
      customers: asObjects(context.customers).length, vendors: asObjects(context.vendors).length, products: asObjects(context.products).length,
      orders: asObjects(context.orders).length, open_cancellations: asObjects(context.cancellations).filter((row) => !["approved", "rejected", "refunded"].includes(text(row.status).toLowerCase())).length,
      open_tickets: asObjects(context.tickets).filter((row) => !["resolved", "closed"].includes(text(row.status).toLowerCase())).length,
    };
    if (name === "search_operational_orders") {
      const query = text(args.query).toLowerCase(); const status = text(args.status).toLowerCase(); const limit = Math.max(1, Math.min(50, Math.floor(number(args.limit, 20))));
      const rows = asObjects(context.orders).filter((row) => {
        const hay = Object.values(row).map(text).join(" ").toLowerCase();
        return (!query || hay.includes(query)) && (!status || text(row.status).toLowerCase().includes(status));
      }).slice(0, limit);
      return { count: rows.length, orders: rows };
    }
    if (name === "search_vendors") {
      const query = text(args.query).toLowerCase(); const limit = Math.max(1, Math.min(50, Math.floor(number(args.limit, 20))));
      const rows = asObjects(context.vendors).filter((row) => !query || Object.values(row).map(text).join(" ").toLowerCase().includes(query)).slice(0, limit);
      return { count: rows.length, vendors: rows };
    }
    if (name === "get_operational_exceptions") {
      const limit = Math.max(1, Math.min(50, Math.floor(number(args.limit, 20))));
      return { cancellations: asObjects(context.cancellations).slice(0, limit), payments: asObjects(context.payments).slice(0, limit), payouts: asObjects(context.payouts).slice(0, limit), tickets: asObjects(context.tickets).slice(0, limit) };
    }
    if (role === "admin" && name === "get_campaigns") return { campaigns: context.campaigns || [], platformSettings: context.platformSettings || [] };
    if (role === "admin" && name === "get_governance_summary") return { audit: asObjects(context.audit).slice(0, 50), vendorPlans: context.vendorPlans || [], assistantActions: asObjects(context.assistantActions).slice(0, 50) };
  }
  return { error: "Tool is not available in this role workspace." };
}

function functionCalls(response: OpenAIResponse): ToolCall[] {
  return (response.output || []).filter((item) => item.type === "function_call" && item.call_id && item.name).map((item) => {
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(item.arguments || "{}") as Record<string, unknown>; } catch { args = {}; }
    return { callId: item.call_id!, name: item.name!, args };
  });
}

function extractOutputText(response: OpenAIResponse) {
  if (typeof response.output_text === "string" && response.output_text.trim()) return response.output_text.trim();
  const chunks: string[] = [];
  for (const item of response.output || []) {
    if (item.type !== "message") continue;
    for (const content of item.content || []) if (content.type === "output_text" && content.text) chunks.push(content.text);
  }
  return chunks.join("\n").trim();
}

function extractRefusal(response: OpenAIResponse) {
  for (const item of response.output || []) for (const content of item.content || []) if (content.type === "refusal" && content.refusal) return content.refusal;
  return "";
}

function finalSchema(role: Role) {
  const properties: Record<string, unknown> = {
    reply: { type: "string" },
    intent: { type: "string", enum: ["browse", "recommend", "add_to_basket", "remove_from_basket", "view_basket", "track", "navigate", "support", "quality_issue", "clarify", "answer", "other"] },
    budget: { type: "number" },
    selectedProductIds: { type: "array", items: { type: "string" }, maxItems: 8 },
    basketProductIds: { type: "array", items: { type: "string" }, maxItems: 8 },
    removeProductIds: { type: "array", items: { type: "string" }, maxItems: 8 },
    navigateTo: { type: "string", enum: ["", "Marketplace", "Cart", "My schedule", "Monthly requirement", "My quotations", "Orders", "Profile & food", "Ticket centre"] },
    clarifyingQuestion: { type: "string" }, requiresPhoto: { type: "boolean" }, targetOrderId: { type: "string" }, createTicket: { type: "boolean" },
    ticketSubject: { type: "string" }, ticketCategory: { type: "string", enum: ["Order", "Payment", "Vendor", "Delivery", "Other"] }, ticketPriority: { type: "string", enum: ["Low", "Normal", "High", "Urgent"] },
  };
  const required = ["reply", "intent", "budget", "selectedProductIds", "basketProductIds", "removeProductIds", "navigateTo", "clarifyingQuestion", "requiresPhoto", "targetOrderId", "createTicket", "ticketSubject", "ticketCategory", "ticketPriority"];
  if (role === "customer") {
    properties.memoryUpdates = { type: "array", maxItems: 5, items: { type: "object", additionalProperties: false, properties: { key: { type: "string", enum: [...MEMORY_KEYS] }, value: { type: "string" }, confidence: { type: "number" } }, required: ["key", "value", "confidence"] } };
    required.push("memoryUpdates");
  }
  return { type: "object", additionalProperties: false, properties, required };
}

const apiBase = () => (process.env.AI_API_BASE || "https://api.openai.com/v1").replace(/\/$/, "");

/** Latency settings for the reasoning model family: minimal reasoning effort and short answers. A shopping
 * assistant that picks tools and writes two sentences does not need deep reasoning, and each reasoning
 * token is waiting time for the customer. Models that do not accept the settings get the plain request. */
let fastParamsSupported = true;
function withFastParams(model: string, payload: Record<string, unknown>) {
  if (!fastParamsSupported || !/^(gpt-5|o\d)/i.test(model) || process.env.AI_REASONING_EFFORT === "default") return payload;
  const text = payload.text as Record<string, unknown> | undefined;
  return { ...payload, reasoning: { effort: process.env.AI_REASONING_EFFORT || "minimal" }, ...(text ? { text: { ...text, verbosity: "low" } } : {}) };
}
function withoutFastParams(payload: Record<string, unknown>) {
  const { reasoning, ...rest } = payload; void reasoning;
  const text = rest.text as Record<string, unknown> | undefined;
  if (text) { const { verbosity, ...t } = text; void verbosity; return { ...rest, text: t }; }
  return rest;
}

async function postResponses(apiKey: string, payload: Record<string, unknown>) {
  const response = await fetch(`${apiBase()}/responses`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const raw = await response.text();
  let data: OpenAIResponse = {};
  try { data = JSON.parse(raw) as OpenAIResponse; } catch { /* handled below */ }
  if (!response.ok) {
    const message = data.error?.message || raw.slice(0, 500) || `Assistant request failed with ${response.status}`;
    const error = new Error(message) as Error & { status?: number; code?: string };
    error.status = response.status; error.code = data.error?.code;
    throw error;
  }
  return data;
}

/** Pulls the text of the "reply" field out of a JSON document that is still being written. "reply" is the first
 * property of the result schema, so its words arrive first. Handles escapes and stops at the closing quote. */
export function extractPartialReply(partial: string): string {
  const key = partial.indexOf('"reply"');
  if (key < 0) return "";
  const colon = partial.indexOf(":", key + 7);
  const open = colon < 0 ? -1 : partial.indexOf('"', colon + 1);
  if (open < 0) return "";
  let out = "";
  for (let i = open + 1; i < partial.length; i++) {
    const ch = partial[i];
    if (ch === '"') return out;
    if (ch !== "\\") { out += ch; continue; }
    const next = partial[i + 1];
    if (next === undefined) return out;               // escape not finished yet
    if (next === "u") { const hex = partial.slice(i + 2, i + 6); if (hex.length < 4) return out; out += String.fromCharCode(parseInt(hex, 16)); i += 5; continue; }
    out += next === "n" ? "\n" : next === "t" ? "\t" : next; i += 1;
  }
  return out;
}

/** Same request, but read as a stream: text deltas are reported as they arrive and the finished response object
 * is returned exactly as the non-streaming call would have returned it. */
async function postResponsesStream(apiKey: string, payload: Record<string, unknown>, onText: (textSoFar: string) => void) {
  const response = await fetch(`${apiBase()}/responses`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "text/event-stream" }, body: JSON.stringify({ ...payload, stream: true }) });
  if (!response.ok || !response.body) {
    const raw = await response.text();
    let data: OpenAIResponse = {};
    try { data = JSON.parse(raw) as OpenAIResponse; } catch { /* not json */ }
    const error = new Error(data.error?.message || raw.slice(0, 500) || `Assistant request failed with ${response.status}`) as Error & { status?: number; code?: string };
    error.status = response.status; error.code = data.error?.code;
    throw error;
  }
  const reader = response.body.getReader(); const decoder = new TextDecoder();
  let buffer = "", text = "", finished: OpenAIResponse | null = null;
  const handle = (block: string) => {
    const dataLine = block.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("");
    if (!dataLine || dataLine === "[DONE]") return;
    let event: { type?: string; delta?: string; response?: OpenAIResponse; error?: { message?: string; code?: string }; message?: string };
    try { event = JSON.parse(dataLine); } catch { return; }
    if (event.type === "response.output_text.delta" && typeof event.delta === "string") { text += event.delta; onText(text); }
    else if (event.type === "response.completed") finished = event.response || null;
    else if (event.type === "response.failed" || event.type === "error") {
      const failure = new Error(event.response?.error?.message || event.error?.message || event.message || "The assistant stream failed") as Error & { code?: string };
      failure.code = event.response?.error?.code || event.error?.code; throw failure;
    }
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut: number;
    while ((cut = buffer.indexOf("\n\n")) >= 0) { handle(buffer.slice(0, cut)); buffer = buffer.slice(cut + 2); }
  }
  if (buffer.trim()) handle(buffer);
  if (!finished) throw new Error("The assistant stream ended before a result arrived");
  return finished as OpenAIResponse;
}

async function callResponses(apiKey: string, payload: Record<string, unknown>, onText?: (textSoFar: string) => void) {
  const model = String(payload.model || "");
  const fast = withFastParams(model, payload);
  const send = (body: Record<string, unknown>) => (onText ? postResponsesStream(apiKey, body, onText) : postResponses(apiKey, body));
  try { return await send(fast); }
  catch (error) {
    const typed = error as Error & { status?: number };
    // a 400 that mentions the latency settings means this model rejects them: remember it and retry plainly
    if (fast !== payload && typed.status === 400 && /reasoning|verbosity|unsupported|not supported|unknown parameter/i.test(typed.message)) { fastParamsSupported = false; return send(withoutFastParams(payload)); }
    throw error;
  }
}

function instructionsForRole(role: Role) {
  const shared = `You are She Agent, ShePlates' natural agentic-commerce assistant. Understand normal human language semantically; never require command phrases. You achieve commerce outcomes by using the available business tools whenever current ShePlates facts are needed. Never invent a product, price, vendor, availability, nutrition value, order, schedule, quotation, payment state or business fact. Do not answer a current-data question from memory when a relevant business tool can verify it. Keep responses concise, natural and useful. Do not mention internal implementation, databases, APIs, model providers, tool protocols or developer configuration. Consequential actions remain human-confirmed.`;
  if (role === "customer") return `${shared} You are scoped to this signed-in customer only. For product discovery, use search_catalogue. For a multi-item recommendation, normally search first and then validate the proposed basket with build_cart. Use get_current_cart before answering basket/cart questions. When the customer naturally asks you to add, order, buy, keep, put, or remove products, use the catalogue/cart tools as needed and return the exact live product IDs in basketProductIds/removeProductIds; basketProductIds means the app should persist those items into the customer's saved cart, and navigateTo should normally be Cart when the customer wants to review or checkout. Do not claim that something was added unless the IDs are returned for the app to persist. Use get_customer_context for personalization when useful, not as a substitute for live catalogue search. Use get_order_history for previous/recent purchases and get_order_status for a specific/next/latest order; never invent past food names. Use get_schedules and get_quotations for those questions. If the user says 'near me', 'available', 'low calorie', 'under a budget', 'healthy', 'something for me', or any equivalent natural wording, infer the constraints and call the appropriate tools rather than asking the user to reformulate. Never treat missing nutrition as zero calories or zero protein; nutrition_available=false means nutrition is pending and must not be ranked as a low-calorie or high-protein choice. Use exact item IDs returned by tools in selectedProductIds/basketProductIds. Never reveal another customer's data. memoryUpdates may contain only stable, non-sensitive shopping preferences that the customer explicitly states or repeatedly confirms.`;
  if (role === "vendor") return `${shared} You are scoped to this signed-in vendor only. Use vendor tools to answer about this store, its catalogue, stock, own orders, RFQs, staff and payouts. Never reveal another vendor's private records.`;
  if (role === "operations") return `${shared} You are scoped to authorised operational records. You may analyse cross-platform operational data through Operations tools, but do not claim Super Admin governance access.`;
  return `${shared} You are scoped to authorised Super Admin records. You may use operational and governance tools to analyse the platform, while leaving consequential actions for explicit human confirmation.`;
}

export async function runToolDrivenCommerceAgent(args: {
  apiKey: string;
  model: string;
  role: Role;
  message: string;
  history: AgentHistoryItem[];
  /** May still be loading: the first model call does not need it, only the tools do. */
  context: Record<string, unknown> | Promise<Record<string, unknown>>;
  /** Called with the reply text so far while the model is still writing it. */
  onReply?: (replySoFar: string) => void;
}) {
  const tools = toolsForRole(args.role);
  const instructions = instructionsForRole(args.role);
  const recent = args.history.slice(-12).map((item) => ({ role: item.role === "agent" ? "assistant" : "user", content: item.text, shown_product_ids: item.productIds || [] }));
  const schema = finalSchema(args.role);
  const onText = args.onReply ? (textSoFar: string) => { const reply = extractPartialReply(textSoFar); if (reply) args.onReply?.(reply); } : undefined;
  const initialPayload = (model: string) => ({
    model,
    instructions,
    input: `Recent conversation: ${JSON.stringify(recent)}\nCurrent user message: ${args.message}`,
    tools,
    tool_choice: "auto",
    parallel_tool_calls: true,
    text: { format: { type: "json_schema", name: "sheplates_commerce_result", strict: true, schema } },
  });
  let activeModel = args.model || "gpt-5.6-luna";
  let response: OpenAIResponse;
  try {
    response = await callResponses(args.apiKey, initialPayload(activeModel), onText);
  } catch (error) {
    const typed = error as Error & { status?: number };
    const fallbackModel = "gpt-5.6-luna";
    if (activeModel !== fallbackModel && (typed.status === 400 || typed.status === 404)) {
      activeModel = fallbackModel;
      response = await callResponses(args.apiKey, initialPayload(activeModel), onText);
    } else throw error;
  }

  for (let round = 0; round < 6; round++) {
    const calls = functionCalls(response);
    if (!calls.length) break;
    const toolContext = await args.context;
    const outputs = calls.map((call) => ({ type: "function_call_output", call_id: call.callId, output: JSON.stringify(executeTool(args.role, toolContext, call.name, call.args)) }));
    response = await callResponses(args.apiKey, {
      model: activeModel,
      previous_response_id: response.id,
      instructions,
      input: outputs,
      tools,
      tool_choice: "auto",
      parallel_tool_calls: true,
      text: { format: { type: "json_schema", name: "sheplates_commerce_result", strict: true, schema } },
    }, onText);
  }

  const refusal = extractRefusal(response);
  if (refusal) throw new Error("The assistant could not answer that request.");
  const output = extractOutputText(response);
  if (!output) throw new Error("The assistant returned no usable response.");
  let parsed: CommerceResult;
  try { parsed = JSON.parse(output) as CommerceResult; } catch { throw new Error("The assistant returned an unreadable response."); }
  if (!parsed || typeof parsed.reply !== "string" || !parsed.intent || !Array.isArray(parsed.selectedProductIds) || !Array.isArray(parsed.basketProductIds) || !Array.isArray(parsed.removeProductIds)) throw new Error("The assistant returned an incomplete response.");
  return parsed;
}
