import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { uniqueById } from "./connect-map";
import type { Role } from "./sheplates-data";
import { nextFoodDropWindow } from "./food-drops";

let browserClient: SupabaseClient | null = null;

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function isLiveSupabaseMode() {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "false" && isSupabaseConfigured();
}

export type LiveMarketplaceRow = {
  item_id: string; vendor_id: string; vendor_name: string; item_name: string; category: string;
  unit: string; quantity_step: number; stock_quantity: number; image_url: string | null;
  customer_price: number; calories_per_unit: number; protein_g: number; carbs_g: number;
  fat_g: number; fibre_g: number; dietary_tags: string[]; pack_amount: number | null;
  pack_measure: string | null; delivery_enabled: boolean; pickup_enabled: boolean;
  distance_km: number;
  // Added by V7_6_MARKETPLACE_NEARBY_RETURN_COORDS.sql — undefined until that
  // migration is applied, since the RPC simply won't return these columns yet.
  vendor_lat?: number; vendor_lng?: number;
  // Added by V7_7_MARKETPLACE_NEARBY_RETURN_PLAN.sql — undefined until applied.
  vendor_plan_code?: string;
};

export type MarketplaceDiagnostics = {
  verified_vendors: number; open_vendors: number; vendors_with_products: number;
  vendors_in_radius: number; serviceable_products: number;
};

export type LiveVendorRow = {
  id: string; owner_id: string | null; vendor_kind?: "subscription" | "p0_connect"; name: string; category: string; locality: string; address: string | null;
  latitude: number | null; longitude: number | null; service_radius_km: number;
  delivery_enabled: boolean; pickup_enabled: boolean; store_open_today: boolean;
  verification_status: string; operational_status: string; marketplace_visible: boolean;
  plan_id: string | null;
  // Embedded via the vendors.plan_id -> vendor_plans foreign key. This client
  // has no generated Database types, so supabase-js can't confirm the FK is
  // many-to-one — it types (and may return) this as an array either way.
  vendor_plans?: { code: string; name: string } | { code: string; name: string }[] | null;
};

export type LiveMenuItemRow = {
  id: string; vendor_id: string; name: string; category: string; unit: string;
  quantity_step: number; stock_quantity: number; vendor_base_price: number; active: boolean;
  calories_per_unit: number; protein_g: number; carbs_g: number; fat_g: number; fibre_g: number;
  dietary_tags: string[]; pack_amount: number | null; pack_measure: string | null; image_url: string | null;
  nutrition_status?: string | null; nutrition_confidence?: number | null; nutrition_note?: string | null;
};

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) return null;
  if (!browserClient) {
    browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
    );
  }
  return browserClient;
}

export async function liveSignIn(email: string, password: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
  if (error) throw new Error(error.message || "The email or password could not be verified.");
  let { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, role, vendor_id, tours_completed")
    .eq("id", data.user.id)
    .single();
  // tours_completed is added by the V7.4 migration. Fall back to a plain
  // select so sign-in still works on a database that hasn't run it yet.
  if (profileError && /tours_completed/i.test(profileError.message || "")) {
    const fallback = await supabase.from("profiles").select("full_name, role, vendor_id").eq("id", data.user.id).single();
    profile = fallback.data ? { ...fallback.data, tours_completed: [] } : null;
    profileError = fallback.error;
  }
  if (profileError) {
    throw new Error(
      profileError.code === "PGRST116"
        ? "This Auth account has no ShePlates role profile. Run the packaged staff-user setup command, then sign in again."
        : profileError.message,
    );
  }
  const liveProfile = profile as { full_name: string; role: string; vendor_id: string | null; tours_completed?: string[] } | null;
  if (!liveProfile || !["customer", "vendor", "operations", "admin"].includes(liveProfile.role)) {
    throw new Error("This account has an invalid ShePlates role profile. Contact your administrator.");
  }
  return {
    user: data.user,
    profile: {
      ...liveProfile,
      role: liveProfile.role as Role,
      tours_completed: liveProfile.tours_completed || [],
    },
  };
}

export async function liveSignUp(input: {
  name: string;
  email: string;
  password: string;
  role: "customer" | "vendor";
}) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");

  // Temporary UAT flow: customer/vendor self-signup is created as confirmed by
  // the server route so no verification email/OTP is required. Authentication
  // is still enforced with email + password on every future sign-in.
  const response = await fetch("/api/auth/direct-signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const result = await response.json() as { userId?: string; error?: string };
  if (!response.ok || !result.userId) throw new Error(result.error || "Unable to create the account.");

  const signedIn = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });
  if (signedIn.error || !signedIn.data.user) throw signedIn.error || new Error("Account created, but sign-in failed.");
  return signedIn.data;
}

export async function saveLiveCustomerPrivacy(privateAccount: boolean) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const result = await supabase.rpc("set_private_account", { p_private: privateAccount });
  if (result.error) throw result.error;
}

export async function liveSignOut() {
  const supabase = getSupabaseBrowserClient();
  if (supabase) await supabase.auth.signOut();
}

export function getAppUrl() {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173";
}

export async function sendPasswordResetEmail(email: string, redirectTo?: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local to send password reset emails.");
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error("Enter a valid email address.");
  }
  const defaultRedirect = `${getAppUrl().replace(/\/$/, "")}/reset-password`;
  const targetRedirect = redirectTo || defaultRedirect;
  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: targetRedirect,
  });
  // Do NOT surface Supabase errors (rate limit, user not found, etc.) to the UI.
  // For security and UX, always show the success banner so we don't leak whether
  // an account exists for a given email, and so transient limits don't confuse users.
  void error;
  return { success: true, email: normalizedEmail };
}

export async function updatePassword(newPassword: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local to update passwords.");
  if (!newPassword || newPassword.length < 8) {
    throw new Error("Use a password with at least 8 characters.");
  }
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    throw new Error(error.message || "Could not update your password. The reset link may have expired or is invalid.");
  }
  return data;
}

export async function getAccessToken() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function saveLiveCustomerLocation(input: { userId: string; address: string; latitude: number; longitude: number }) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const result = await supabase.from("customer_preferences").upsert({
    customer_id: input.userId,
    address: input.address,
    latitude: input.latitude,
    longitude: input.longitude,
    onboarding_complete: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "customer_id" });
  if (result.error) throw result.error;
}

export async function loadLiveCustomerPreference(userId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const [prefResult, profileResult] = await Promise.all([
    supabase.from("customer_preferences").select("*").eq("customer_id", userId).maybeSingle(),
    supabase.from("profiles").select("phone, full_name").eq("id", userId).maybeSingle(),
  ]);
  if (prefResult.error) throw prefResult.error;
  if (!prefResult.data) {
    if (profileResult.data) {
      return {
        phone: profileResult.data.phone || "",
        full_name: profileResult.data.full_name || "",
      };
    }
    return null;
  }
  return {
    ...prefResult.data,
    phone: profileResult.data?.phone || "",
    full_name: profileResult.data?.full_name || "",
  };
}

export async function loadLiveCustomerMemory(userId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const result = await supabase.from("customer_ai_memory").select("memory_key,memory_value,confidence,updated_at").eq("customer_id", userId).order("updated_at", { ascending: false }).limit(30);
  if (result.error) return [];
  return result.data || [];
}

export async function clearLiveCustomerMemory(userId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const result = await supabase.from("customer_ai_memory").delete().eq("customer_id", userId);
  if (result.error) throw result.error;
}

export async function loadLiveMarketplace(latitude: number, longitude: number) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const [items, diagnostics, homeConfig] = await Promise.all([
    supabase.rpc("marketplace_menu_nearby", { customer_lat: latitude, customer_lng: longitude }),
    supabase.rpc("marketplace_visibility_diagnostics", { customer_lat: latitude, customer_lng: longitude }),
    supabase.from("platform_settings").select("config").eq("setting_key", "marketplace_home").maybeSingle(),
  ]);
  if (items.error) throw items.error;
  if (diagnostics.error) throw diagnostics.error;
  if (homeConfig.error) console.error("Homepage merchandising is unavailable:", homeConfig.error.message);
  const config = homeConfig.error ? null : homeConfig.data?.config as { featuredProductIds?: string[]; recommendationPopupEnabled?: boolean; maxFeatured?: number } | null;
  return {
    items: (items.data || []) as LiveMarketplaceRow[],
    diagnostics: ((diagnostics.data || [])[0] || null) as MarketplaceDiagnostics | null,
    merchandising: { featuredProductIds: config?.featuredProductIds || [], recommendationPopupEnabled: config?.recommendationPopupEnabled ?? true, maxFeatured: config?.maxFeatured || 6 },
    merchandisingError: homeConfig.error ? homeConfig.error.message : null,
  };
}

export interface ConnectVendor {
  vendor_kind?: string;
  vendor_id: string;
  vendor_name: string;
  category: string;
  description: string | null;
  locality: string;
  address: string | null;
  latitude: number;
  longitude: number;
  whatsapp_number: string | null;
  operating_hours: Record<string, unknown> | null;
  logo_url: string | null;
  distance_km: number;
  service_radius_km: number;
  store_open_today: boolean;
}

export function normalizeWhatsAppNumber(phone: string, defaultCountryCode = "+91"): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  const international = trimmed.startsWith("00") ? `+${trimmed.slice(2)}` : trimmed;
  const digits = international.replace(/\D/g, "");
  const normalized = international.startsWith("+")
    ? `+${digits}`
    : `${defaultCountryCode}${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

export type WhatsAppClickSource = "map" | "vendor_profile" | "search";

export async function trackLiveVendorWhatsAppClick(
  vendorId: string,
  source: WhatsAppClickSource,
) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !isLiveSupabaseMode()) {
    throw new Error("Live WhatsApp click tracking is not available.");
  }

  const { error } = await supabase.rpc("track_vendor_whatsapp_click", {
    target_vendor_id: vendorId,
    click_source: source,
  });
  if (error) throw error;
}

export async function loadConnectVendorsNearby(
  latitude: number,
  longitude: number
): Promise<ConnectVendor[]> {
  const supabase = getSupabaseBrowserClient();

  if (!supabase || !isLiveSupabaseMode()) {
    throw new Error("Live Connect access is not available.");
  }

  const { data, error } = await supabase.rpc("connect_vendors_nearby", {
    customer_lat: latitude,
    customer_lng: longitude,
  });

  if (error) {
    console.error("Failed to load Connect vendors:", error.message);
    throw error;
  }

  return uniqueById((data ?? []) as ConnectVendor[], (vendor) => vendor.vendor_id)
    .filter((vendor) => vendor.vendor_kind === "p0_connect");
}

export async function loadLiveVendorWorkspace(vendorId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const vendorPromise = supabase.from("vendors").select("id,owner_id,name,category,locality,address,latitude,longitude,service_radius_km,delivery_enabled,pickup_enabled,store_open_today,verification_status,operational_status,marketplace_visible,plan_id,vendor_plans(code,name)").eq("id", vendorId).single();
  const documentsPromise = supabase.from("vendor_documents").select("document_number,storage_path,expiry_date,verification_status").eq("vendor_id", vendorId).order("created_at", { ascending: false }).limit(1);
  const productResult = await supabase.from("vendor_menu_items").select("id,vendor_id,name,category,unit,quantity_step,stock_quantity,vendor_base_price,active,calories_per_unit,protein_g,carbs_g,fat_g,fibre_g,dietary_tags,pack_amount,pack_measure,image_url,nutrition_status,nutrition_confidence,nutrition_note").eq("vendor_id", vendorId).order("created_at", { ascending: false });
  let productRows = productResult.data as LiveMenuItemRow[] | null;
  let productError = productResult.error;
  if (productError && /nutrition_status|nutrition_confidence|nutrition_note/i.test(productError.message || "")) {
    const fallbackProducts = await supabase.from("vendor_menu_items").select("id,vendor_id,name,category,unit,quantity_step,stock_quantity,vendor_base_price,active,calories_per_unit,protein_g,carbs_g,fat_g,fibre_g,dietary_tags,pack_amount,pack_measure,image_url").eq("vendor_id", vendorId).order("created_at", { ascending: false });
    productRows = fallbackProducts.data as LiveMenuItemRow[] | null;
    productError = fallbackProducts.error;
  }
  const [initialVendor, documents] = await Promise.all([vendorPromise, documentsPromise]);
  const vendor = initialVendor;
  if (vendor.error) throw vendor.error;
  if (productError) throw productError;
  if (documents.error) throw documents.error;
  return { vendor: vendor.data as LiveVendorRow, products: productRows || [], document: documents.data?.[0] || null };
}

export async function loadLiveVendorWorkspaceForOwner(userId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const result = await supabase.from("vendors").select("id").eq("owner_id", userId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (result.error) throw result.error;
  return result.data ? loadLiveVendorWorkspace(result.data.id) : null;
}

export async function loadLiveOperationsWorkspace() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const [vendors, products, profiles, documents, homeConfig, campaigns] = await Promise.all([
    supabase.from("vendors").select("id,owner_id,vendor_kind,name,category,locality,address,latitude,longitude,service_radius_km,delivery_enabled,pickup_enabled,store_open_today,verification_status,operational_status,marketplace_visible,plan_id,vendor_plans(code,name)").order("created_at", { ascending: false }),
    supabase.from("vendor_menu_items").select("id,vendor_id,name,category,unit,quantity_step,stock_quantity,vendor_base_price,active,calories_per_unit,protein_g,carbs_g,fat_g,fibre_g,dietary_tags,pack_amount,pack_measure,image_url").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id,full_name,role,vendor_id"),
    supabase.from("vendor_documents").select("vendor_id,document_number,storage_path,expiry_date,verification_status").order("created_at", { ascending: false }),
    supabase.from("platform_settings").select("config").eq("setting_key", "marketplace_home").maybeSingle(),
    supabase.from("marketing_campaigns").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  let vendorRows: LiveVendorRow[];
  if (!vendors.error) {
    vendorRows = (vendors.data || []) as LiveVendorRow[];
  } else if ((vendors.error.code === "42703" || vendors.error.code === "PGRST204") && /vendor_kind/i.test(vendors.error.message)) {
    const fallback = await supabase.from("vendors").select("id,owner_id,name,category,locality,address,latitude,longitude,service_radius_km,delivery_enabled,pickup_enabled,store_open_today,verification_status,operational_status,marketplace_visible,plan_id,vendor_plans(code,name)").order("created_at", { ascending: false });
    if (fallback.error) throw fallback.error;
    vendorRows = (fallback.data || []).map((row) => ({ ...row, vendor_kind: "subscription" })) as LiveVendorRow[];
  } else {
    throw vendors.error;
  }
  for (const result of [products, profiles, documents]) if (result.error) throw result.error;
  if (homeConfig.error) console.error("Homepage merchandising is unavailable:", homeConfig.error.message);
  if (campaigns.error) console.error("Marketing campaigns are unavailable:", campaigns.error.message);
  const config = homeConfig.error ? null : homeConfig.data?.config as { featuredProductIds?: string[]; recommendationPopupEnabled?: boolean; maxFeatured?: number } | null;
  const merchandisingError = homeConfig.error?.message || campaigns.error?.message || null;
  return { vendors: vendorRows, products: (products.data || []) as LiveMenuItemRow[], profiles: profiles.data || [], documents: documents.data || [], merchandising: { featuredProductIds: config?.featuredProductIds || [], recommendationPopupEnabled: config?.recommendationPopupEnabled ?? true, maxFeatured: config?.maxFeatured || 6 }, campaigns: campaigns.error ? [] : (campaigns.data || []), merchandisingError };
}

export async function saveLiveMarketplaceHome(config: { featuredProductIds: string[]; recommendationPopupEnabled: boolean; maxFeatured: number }) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const result = await supabase.from("platform_settings").upsert({ setting_key: "marketplace_home", config, updated_at: new Date().toISOString() }, { onConflict: "setting_key" });
  if (result.error) throw result.error;
}

export type CampaignSaveInput = {
  id?: string; name: string; audience: string; offer: string; channel: string; status: string; aiRationale: string;
  headline?: string; subline?: string; emoji?: string; ctaLabel?: string; targetType?: string; targetValue?: string;
  segment?: string; startsAt?: string | null; endsAt?: string | null; priority?: number;
};
export async function saveLiveCampaign(input: CampaignSaveInput) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const row: Record<string, string | number | null> = {
    ...(input.id ? { id: input.id } : {}),
    name: input.name,
    audience: input.audience,
    offer: input.offer,
    channel: input.channel,
    status: input.status.toLowerCase(),
    ai_rationale: input.aiRationale,
    updated_at: new Date().toISOString(),
  };
  if (input.headline !== undefined) {
    Object.assign(row, {
      headline: input.headline.trim(),
      subline: (input.subline || "").trim(),
      emoji: input.emoji || "🎉",
      cta_label: (input.ctaLabel || "Shop now").trim() || "Shop now",
      target_type: input.targetType || "none",
      target_value: input.targetType && input.targetType !== "none" ? input.targetValue || null : null,
      segment: input.segment || "everyone",
      starts_at: input.startsAt || null,
      ends_at: input.endsAt || null,
      priority: Math.round(input.priority ?? 0),
    });
  }
  const result = await supabase.from("marketing_campaigns").upsert(row).select("id").single();
  if (result.error) throw new Error(/active_needs_headline/.test(result.error.message) ? "Write the headline customers will see before going live" : /window_check/.test(result.error.message) ? "The end must be after the start" : result.error.message);
  return result.data.id as string;
}

export async function deleteLiveCampaign(id: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const result = await supabase.from("marketing_campaigns").delete().eq("id", id);
  if (result.error) throw result.error;
}

export async function uploadLiveProductImage(vendorId: string, dataUrl: string) {
  const token = await getAccessToken();
  const response = await fetch("/api/product-image-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ vendorId, dataUrl }),
  });
  const result = await response.json() as { publicUrl?: string; error?: string };
  if (!response.ok || !result.publicUrl) throw new Error(result.error || "Image upload failed.");
  return result.publicUrl;
}

export async function saveLiveVendorProduct(input: {
  vendorId: string; name: string; category: string; unit: string; price: number; stock: number;
  active: boolean; calories: number; protein: number; carbs: number; fat: number; fibre: number;
  dietaryTags: string[]; packAmount: number; packMeasure: string; imageUrl?: string;
  nutritionStatus?: "verified" | "estimated" | "pending_review"; nutritionConfidence?: number; nutritionNote?: string;
}) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const payload = {
    vendor_id: input.vendorId, name: input.name, category: input.category, unit: input.unit,
    quantity_step: 1, vendor_base_price: input.price, stock_quantity: input.stock, active: input.active,
    calories_per_unit: input.calories, protein_g: input.protein, carbs_g: input.carbs,
    fat_g: input.fat, fibre_g: input.fibre, dietary_tags: input.dietaryTags,
    pack_amount: input.packAmount, pack_measure: input.packMeasure, image_url: input.imageUrl || null,
    nutrition_status: input.nutritionStatus || "pending_review",
    nutrition_confidence: input.nutritionConfidence ?? null,
    nutrition_note: input.nutritionNote || null,
  };
  let result = await supabase.from("vendor_menu_items").insert(payload).select("id").single();
  // Backward-compatible retry lets the UI keep working if the production migration
  // has not been applied yet; the release notes still require the migration.
  if (result.error && /nutrition_status|nutrition_confidence|nutrition_note/i.test(result.error.message || "")) {
    const { nutrition_status: _status, nutrition_confidence: _confidence, nutrition_note: _note, ...legacyPayload } = payload;
    void _status;
    void _confidence;
    void _note;
    result = await supabase.from("vendor_menu_items").insert(legacyPayload).select("id").single();
  }
  if (result.error) throw result.error;
  return result.data.id as string;
}

export async function notifyLiveNutritionReview(input: { productId: string; productName: string; reason: string }) {
  return commerceRequest({ action: "notify_nutrition_review", ...input });
}

export async function setLiveProductActive(productId: string, active: boolean) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const result = await supabase.from("vendor_menu_items").update({ active, updated_at: new Date().toISOString() }).eq("id", productId);
  if (result.error) throw result.error;
}

export async function updateLiveVendorControls(vendorId: string, patch: {
  store_open_today?: boolean; operational_status?: string; delivery_enabled?: boolean;
  pickup_enabled?: boolean; marketplace_visible?: boolean; service_radius_km?: number;
}) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const result = await supabase.from("vendors").update({
    ...patch,
    ...(patch.service_radius_km !== undefined ? { radius_updated_at: new Date().toISOString() } : {}),
    updated_at: new Date().toISOString(),
  }).eq("id", vendorId);
  if (result.error) throw result.error;
}

export async function saveLiveVendorPlan(vendorId: string, planCode: "taster" | "crave" | "thrive" | "crown") {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const plan = await supabase.from("vendor_plans").select("id").eq("code", planCode).single();
  if (plan.error) throw plan.error;
  const result = await supabase.from("vendors").update({ plan_id: plan.data.id, updated_at: new Date().toISOString() }).eq("id", vendorId);
  if (result.error) throw result.error;
}

export async function decideLiveVendorVerification(vendorId: string, verification: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const result = await supabase.rpc("review_vendor_and_notify", {
    target_vendor: vendorId,
    decision: verification,
    review_note: verification === "verified" ? null : "Please review the Operations decision and update the requested information.",
  });
  if (result.error) throw result.error;
}

export type LiveNotificationRow = {
  id: string; kind: string; title: string; body: string; entity_type: string | null;
  entity_id: string | null; read_at: string | null; created_at: string;
};

export function subscribeLiveNotifications(
  userId: string,
  onNotification: (notification: LiveNotificationRow) => void,
) {
  const supabase = getSupabaseBrowserClient();

  if (!supabase || !userId) {
    return () => {};
  }

  const channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `recipient_id=eq.${userId}`,
      },
      (payload) => {
        onNotification(payload.new as LiveNotificationRow);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function loadLiveNotifications() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const result = await supabase.from("notifications")
    .select("id,kind,title,body,entity_type,entity_id,read_at,created_at")
    .order("created_at", { ascending: false }).limit(100);
  if (result.error) throw result.error;
  return (result.data || []) as LiveNotificationRow[];
}

export async function markLiveNotificationsRead() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const result = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (result.error) throw result.error;
}

export async function saveLiveTourCompleted(userId: string, toursCompleted: string[]) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  // Best-effort: a user should never be blocked from dismissing a tour just
  // because the V7.4 migration (or a flaky connection) hasn't landed yet.
  await supabase.from("profiles").update({ tours_completed: toursCompleted }).eq("id", userId);
}

export async function saveLiveCustomerProfile(input: {
  userId: string; phone?: string; address: string; latitude: number; longitude: number;
  householdSize: number; diet: string; allergies: string[]; goals: string[]; instructions: string;
}) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const operations: Array<PromiseLike<{ error: unknown }>> = [
    supabase.from("customer_preferences").upsert({
      customer_id: input.userId, address: input.address, latitude: input.latitude, longitude: input.longitude,
      household_size: input.householdSize, diet: input.diet, allergies: input.allergies,
      health_goals: input.goals, dislikes_and_instructions: input.instructions,
      onboarding_complete: true, updated_at: new Date().toISOString(),
    }, { onConflict: "customer_id" }),
  ];
  if (input.phone !== undefined && input.phone.trim().length > 0) {
    operations.push(supabase.from("profiles").update({ phone: input.phone.trim() }).eq("id", input.userId));
  }
  const results = await Promise.all(operations);
  for (const res of results) {
    if (res.error) throw res.error;
  }
}

export async function saveLiveVendorLocation(input: { vendorId: string; address: string; latitude: number; longitude: number; radiusKm: number }) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const result = await supabase.from("vendors").update({
    address: input.address,
    latitude: input.latitude,
    longitude: input.longitude,
    service_radius_km: input.radiusKm,
    radius_updated_at: new Date().toISOString(),
  }).eq("id", input.vendorId);
  if (result.error) throw result.error;
}

export async function submitLiveVendorApplication(input: {
  userId: string; businessName: string; category: string; locality: string;
  fssaiNumber: string; expiryDate: string; certificate: File; address?: string;
  latitude?: number; longitude?: number; radiusKm?: number; delivery?: boolean; pickup?: boolean;
  operatingHours?: Record<string, unknown>;
}) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const safeName = input.certificate.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const objectPath = `${input.userId}/${crypto.randomUUID()}-${safeName}`;
  const upload = await supabase.storage.from("vendor-certificates").upload(objectPath, input.certificate, { upsert: false });
  if (upload.error) throw upload.error;
  const vendor = await supabase.from("vendors").insert({
    owner_id: input.userId, name: input.businessName, category: input.category,
    locality: input.locality, verification_status: "submitted", operational_status: "inactive",
    address: input.address ?? input.locality, latitude: input.latitude, longitude: input.longitude,
    service_radius_km: input.radiusKm ?? 5, delivery_enabled: input.delivery ?? true,
    pickup_enabled: input.pickup ?? true, store_open_today: false,
    ...(input.operatingHours ? { operating_hours: input.operatingHours } : {}),
  }).select("id").single();
  if (vendor.error) throw vendor.error;
  const document = await supabase.from("vendor_documents").insert({
    vendor_id: vendor.data.id, document_type: "food_certificate", document_number: input.fssaiNumber,
    storage_path: objectPath, expiry_date: input.expiryDate, verification_status: "submitted",
  });
  if (document.error) throw document.error;
  const profile = await supabase.from("profiles").update({ vendor_id: vendor.data.id }).eq("id", input.userId).select("id").maybeSingle();
  if (profile.error) throw profile.error;
  if (!profile.data) throw new Error("Your vendor application was saved, but your account could not be linked to it. Please contact Operations before submitting again.");
  return vendor.data.id as string;
}

/**
 * Super-Admin-only: create a real, confirmed account with a role-scoped
 * profile (Operations or Super Admin) via the service-role-backed API route. The route
 * itself re-verifies the caller is an admin before touching Auth — this client call is
 * a convenience wrapper, not the security boundary.
 */
export async function createStaffUser(input: { name: string; email: string; role: "operations" | "admin" }) {
  const token = await getAccessToken();
  const response = await fetch("/api/admin/create-user", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(input),
  });
  const json = await response.json() as { userId?: string; email?: string; temporaryPassword?: string; error?: string };
  if (!response.ok || !json.temporaryPassword) throw new Error(json.error || "User could not be created");
  return json as { userId: string; email: string; temporaryPassword: string };
}

export async function requestEmailVerificationCode(input: { name: string; email: string; role: "customer" | "vendor" }) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Account verification is unavailable in this deployment.");
  const { error } = await supabase.auth.signInWithOtp({
    email: input.email,
    options: { shouldCreateUser: true, data: { full_name: input.name, role: input.role } },
  });
  if (error) throw error;
}

export async function verifyEmailCodeAndSetPassword(input: { email: string; token: string; password: string }) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Account verification is unavailable in this deployment.");
  const verified = await supabase.auth.verifyOtp({ email: input.email, token: input.token, type: "email" });
  if (verified.error || !verified.data.user) throw verified.error || new Error("The verification code is invalid or expired.");
  const updated = await supabase.auth.updateUser({ password: input.password });
  if (updated.error) throw updated.error;
  return verified.data;
}

export type LiveCommerceSnapshot = {
  orders: Array<Record<string, unknown>>;
  schedules: Array<Record<string, unknown>>;
  staff: Array<Record<string, unknown>>;
  assignments: Array<Record<string, unknown>>;
  thirdPartyDeliveries: Array<Record<string, unknown>>;
  thirdPartyDeliveryAvailable: boolean;
  cart?: Record<string, unknown> | null;
  cartItems?: Array<Record<string, unknown>>;
};

async function commerceRequest(body?: Record<string, unknown>) {
  const token = await getAccessToken();
  const response = await fetch("/api/commerce", {
    method: body ? "POST" : "GET",
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json() as Record<string, unknown> & { error?: string };
  if (!response.ok) throw new Error(result.error || "The latest commerce data could not be saved.");
  return result;
}

export async function loadLiveCommerceSnapshot() {
  return await commerceRequest() as unknown as LiveCommerceSnapshot;
}

export async function createLiveScheduledCheckout(input: {
  productId: string; startDate: string; endDate?: string; recurrence: string; weekdays: string[]; slot: string;
  quantity: number; unit: string; mode: string; deliveryInstructions?: string; customerPrice: number; perDeliveryTotal: number; total: number; whatsappReminder?: boolean;
}) {
  return commerceRequest({ action: "create_schedule", ...input });
}

export async function syncLiveCart(input: { items: Array<{ productId: string; quantity: number }>; createdBy?: "customer" | "she_agent" }) {
  return commerceRequest({ action: "sync_cart", items: input.items, createdBy: input.createdBy || "customer" });
}

export async function checkoutLiveCart(input?: { scheduledDate?: string; slot?: string; deliveryAddress?: string; mode?: string; deliveryInstructions?: string }) {
  return commerceRequest({ action: "checkout_cart", ...(input || {}) });
}

export async function acceptLiveThirdPartyDelivery(orderId: string) {
  return commerceRequest({ action: "accept_third_party_delivery", orderId });
}

export async function issueLiveThirdPartyDeliveryCode(orderId: string) {
  const result = await commerceRequest({ action: "issue_third_party_delivery_code", orderId });
  if (typeof result.code !== "string" || typeof result.expiresAt !== "string") {
    throw new Error("The delivery code response was incomplete.");
  }
  return { code: result.code, expiresAt: result.expiresAt };
}

export async function verifyLiveThirdPartyDeliveryCode(orderId: string, code: string) {
  return commerceRequest({ action: "verify_third_party_delivery_code", orderId, code });
}

export async function markLiveOrderPaid(input: { orderId: string; method: string; reference?: string }) {
  return commerceRequest({ action: "mark_paid", ...input });
}

export async function createLiveRazorpayOrder(orderId: string) {
  const token = await getAccessToken();
  const response = await fetch("/api/payments/razorpay", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action: "create_order", orderId }),
  });
  const result = await response.json() as Record<string, unknown> & { error?: string };
  if (!response.ok) throw new Error(result.error || "Could not create Razorpay order.");
  return result as {
    ok: boolean;
    keyId: string;
    razorpayOrderId: string;
    amount: number;
    currency: string;
    orderNumber: string;
    orderId: string;
    customer?: { name?: string; email?: string };
    description?: string;
  };
}

export async function verifyLiveRazorpayPayment(payload: {
  orderId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  const token = await getAccessToken();
  const response = await fetch("/api/payments/razorpay", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action: "verify_payment", ...payload }),
  });
  const result = await response.json() as Record<string, unknown> & { error?: string };
  if (!response.ok) throw new Error(result.error || "Payment verification failed.");
  return result;
}
export async function saveLiveDeliveryStaff(input: { staffId?: string; name: string; phone: string; active?: boolean }) {
  return commerceRequest({ action: "save_staff", ...input });
}

export async function deleteLiveDeliveryStaff(staffId: string) {
  return commerceRequest({ action: "delete_staff", staffId });
}

export async function saveLiveDeliverySlot(input: { slotId?: string; vendorId?: string; slotName: string; startTime: string; endTime: string; isActive?: boolean }) {
  return commerceRequest({ action: "save_delivery_slot", ...input });
}

export async function deleteLiveDeliverySlot(slotId: string) {
  return commerceRequest({ action: "delete_delivery_slot", slotId });
}

export async function toggleLiveDeliverySlot(slotId: string, active: boolean) {
  return commerceRequest({ action: "toggle_delivery_slot", slotId, active });
}

export async function assignLiveDeliveryStaff(orderId: string, staffId?: string) {
  return commerceRequest({ action: "assign_staff", orderId, staffId: staffId || "" });
}

export async function resubmitLiveVendorVerification(input: { documentNumber: string; expiryDate?: string }) {
  return commerceRequest({ action: "resubmit_verification", ...input });
}

export async function saveLiveOutletCertificate(input: { outletId: string; certificateNumber: string; certificateExpiry?: string }) {
  return commerceRequest({ action: "save_outlet_certificate", ...input });
}

export async function uploadLiveCertificate(input: {
  vendorId: string;
  file: File;
  outletId?: string;
  documentNumber?: string;
  expiryDate?: string;
}) {
  const token = await getAccessToken();
  const form = new FormData();
  form.append("file", input.file);
  form.append("vendorId", input.vendorId);
  if (input.outletId) form.append("outletId", input.outletId);
  if (input.documentNumber) form.append("documentNumber", input.documentNumber);
  if (input.expiryDate) form.append("expiryDate", input.expiryDate);
  const response = await fetch("/api/certificate-upload", { method: "POST", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: form });
  const result = await response.json() as { path?: string; fileName?: string; error?: string };
  if (!response.ok) throw new Error(result.error || "Certificate upload failed.");
  return result;
}

export async function updateLiveOrderStatus(orderId: string, status: string) {
  return commerceRequest({ action: "update_order_status", orderId, status });
}
export async function rescheduleLiveOrder(orderId: string, date: string, slot: string) {
  return commerceRequest({ action: "reschedule_order", orderId, date, slot });
}

// --- Taste Match (V8_1_TASTE_MATCH.sql) ---------------------------------
// Best-effort throughout: a missing table (migration not yet applied) or a
// transient error should degrade to "no taste data yet", never break the
// marketplace someone is trying to browse.

export async function loadLiveTasteProfile(customerId: string): Promise<{ weights: Record<string, number>; onboarded: boolean } | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const result = await supabase.from("taste_profiles").select("weights,onboarded").eq("customer_id", customerId).maybeSingle();
  if (result.error || !result.data) return null;
  return { weights: (result.data.weights as Record<string, number>) || {}, onboarded: Boolean(result.data.onboarded) };
}

export async function saveLiveTasteProfile(customerId: string, weights: Record<string, number>, onboarded: boolean) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  await supabase.from("taste_profiles").upsert({ customer_id: customerId, weights, onboarded, updated_at: new Date().toISOString() }, { onConflict: "customer_id" });
}

export async function recordLiveTasteFeedback(customerId: string, productId: string | null, signal: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  await supabase.from("taste_feedback").insert({ customer_id: customerId, product_id: productId, signal });
}

export async function fetchLiveFoodAttributes(products: { id: string; name: string; category: string }[]): Promise<Record<string, Record<string, number>>> {
  if (!products.length) return {};
  try {
    const token = await getAccessToken();
    if (!token) return {};
    const response = await fetch("/api/food-attributes", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ products }) });
    if (!response.ok) return {};
    const data = await response.json() as { attributes?: Record<string, Record<string, number>> };
    return data.attributes || {};
  } catch {
    return {};
  }
}

// --- Food Drops ----------------------------------------------------------
// Row -> camelCase mapping only; the overselling guard itself lives in the
// claim_food_drop() Postgres function (supabase/V8_2_FOOD_DROPS.sql), not
// here — this file never decides whether a claim succeeds, it just calls
// the RPC and surfaces whatever Postgres decided.
type FoodDropRow = {
  id: string; vendor_id: string; product_id: string; title: string; description: string | null;
  drop_price: number; original_price: number; total_quantity: number; remaining_quantity: number;
  starts_at: string; ends_at: string; status: "active" | "cancelled";
};
function mapFoodDropRow(row: FoodDropRow): import("@/lib/food-drops").FoodDrop {
  return {
    id: row.id, vendorId: row.vendor_id, productId: row.product_id, title: row.title,
    description: row.description || undefined, dropPrice: Number(row.drop_price), originalPrice: Number(row.original_price),
    totalQuantity: row.total_quantity, remainingQuantity: row.remaining_quantity,
    startsAt: row.starts_at, endsAt: row.ends_at, status: row.status,
  };
}
const FOOD_DROP_COLUMNS = "id,vendor_id,product_id,title,description,drop_price,original_price,total_quantity,remaining_quantity,starts_at,ends_at,status";

/** Marketplace-facing: today's drops, including those still waiting for the 8 PM opening.
 * Returns null (not []) when the list couldn't be fetched, so callers keep
 * what they already have instead of blanking the screen on a network error. */
export async function loadLiveFoodDrops(): Promise<import("@/lib/food-drops").FoodDrop[] | null> {
  // Demo mode keeps its own sample drops and must never read (or be overwritten by) the real table.
  if (!isLiveSupabaseMode()) return null;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const result = await supabase.from("food_drops").select(FOOD_DROP_COLUMNS).eq("status", "active").gt("ends_at", new Date().toISOString()).order("ends_at", { ascending: true });
  if (result.error || !result.data) return null;
  return (result.data as FoodDropRow[]).map(mapFoodDropRow);
}

/** Vendor-facing: every drop this vendor has ever created, for management/history. */
export async function loadLiveVendorFoodDrops(vendorId: string): Promise<import("@/lib/food-drops").FoodDrop[]> {
  if (!isLiveSupabaseMode()) return [];
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const result = await supabase.from("food_drops").select(FOOD_DROP_COLUMNS).eq("vendor_id", vendorId).order("created_at", { ascending: false });
  if (result.error || !result.data) return [];
  return (result.data as FoodDropRow[]).map(mapFoodDropRow);
}

export async function createLiveFoodDrop(input: {
  vendorId: string; productId: string; title: string; description?: string;
  dropPrice: number; originalPrice: number; totalQuantity: number;
}): Promise<import("@/lib/food-drops").FoodDrop> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const { startsAt, endsAt } = nextFoodDropWindow();
  const result = await supabase.from("food_drops").insert({
    vendor_id: input.vendorId, product_id: input.productId, title: input.title, description: input.description || null,
    drop_price: input.dropPrice, original_price: input.originalPrice,
    total_quantity: input.totalQuantity, remaining_quantity: input.totalQuantity,
    starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(),
  }).select(FOOD_DROP_COLUMNS).single();
  if (result.error || !result.data) throw result.error || new Error("Drop could not be created");
  return mapFoodDropRow(result.data as FoodDropRow);
}

export async function cancelLiveFoodDrop(dropId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const result = await supabase.from("food_drops").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", dropId);
  if (result.error) throw result.error;
}

/** The only write path for a claim — a thin wrapper around the atomic
 * claim_food_drop() RPC. Throws with Postgres's own message on any race,
 * closed-window, expiry, or capacity failure so
 * the caller can show it directly rather than trusting local stock math. */
export async function claimLiveFoodDrop(dropId: string, quantity: number): Promise<import("@/lib/food-drops").FoodDropClaim> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const result = await supabase.rpc("claim_food_drop", { p_drop_id: dropId, p_quantity: quantity }).single();
  if (result.error || !result.data) throw new Error(result.error?.message || "This drop could not be claimed");
  const row = result.data as { id: string; drop_id: string; customer_id: string; quantity: number; unit_price: number; total_price: number; claimed_at: string };
  return { id: row.id, dropId: row.drop_id, customerEmail: "", quantity: row.quantity, unitPrice: Number(row.unit_price), totalPrice: Number(row.total_price), claimedAt: row.claimed_at };
}

/** Vendor-facing claim history for a set of that vendor's own drops (analytics). */
export async function loadLiveFoodDropClaims(dropIds: string[]): Promise<import("@/lib/food-drops").FoodDropClaim[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !dropIds.length) return [];
  const result = await supabase.from("food_drop_claims").select("id,drop_id,customer_id,quantity,unit_price,total_price,claimed_at").in("drop_id", dropIds).order("claimed_at", { ascending: false });
  if (result.error || !result.data) return [];
  return result.data.map((row) => ({ id: row.id as string, dropId: row.drop_id as string, customerEmail: "", quantity: row.quantity as number, unitPrice: Number(row.unit_price), totalPrice: Number(row.total_price), claimedAt: row.claimed_at as string }));
}