import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type AppRole = "customer" | "vendor" | "operations" | "admin";
type P0Action = "create" | "review" | "cancel" | "reactivate" | "upgrade" | "upload";
type P0Permissions = Record<`can_${P0Action}`, boolean>;

const EMPTY_PERMISSIONS: P0Permissions = {
  can_create: false,
  can_review: false,
  can_cancel: false,
  can_reactivate: false,
  can_upgrade: false,
  can_upload: false,
};

function clients(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anonKey || !serviceRoleKey || !token) return null;

  return {
    token,
    caller: createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    }),
    admin: createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

type Clients = NonNullable<ReturnType<typeof clients>>;
type P0Context = Clients & {
  userId: string;
  email: string;
  role: AppRole;
  permissions: P0Permissions;
};

async function context(request: Request): Promise<P0Context | null> {
  const c = clients(request);
  if (!c) return null;
  const { data: authData, error: authError } = await c.caller.auth.getUser(c.token);
  if (authError || !authData.user?.email) return null;

  const { data: profile, error: profileError } = await c.admin
    .from("profiles")
    .select("id,role")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError || !profile || !["operations", "admin"].includes(profile.role)) return null;

  let permissions = EMPTY_PERMISSIONS;
  if (profile.role === "operations") {
    const { data, error } = await c.admin
      .from("p0_vendor_permissions")
      .select("can_create,can_review,can_cancel,can_reactivate,can_upgrade,can_upload")
      .eq("profile_id", authData.user.id)
      .maybeSingle();
    if (error) throw error;
    permissions = { ...EMPTY_PERMISSIONS, ...(data || {}) };
  }

  return {
    ...c,
    userId: authData.user.id,
    email: authData.user.email,
    role: profile.role as AppRole,
    permissions,
  };
}

function can(contextValue: P0Context, action: P0Action) {
  return contextValue.role === "admin" || contextValue.permissions[`can_${action}`];
}

function errorResponse(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
      ? error.message
      : "P0 vendor request failed.";
  if (/p0_vendor_permissions|p0_upgrade_invitations|vendor_kind|p0_actor_can|p0_create_vendor/i.test(message)) {
    return NextResponse.json(
      { error: "P0 Connect is unavailable until the reviewed P0 lifecycle migration is applied." },
      { status: 503 },
    );
  }
  return NextResponse.json({ error: message }, { status: 400 });
}

async function findAuthUserByEmail(admin: SupabaseClient, email: string) {
  const pageSize = 1000;
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: pageSize });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.trim().toLowerCase() === email);
    if (match) return match;
    if (data.users.length < pageSize) return null;
  }
  throw new Error("Unable to safely check account ownership. Ask Super Admin to retry.");
}

function inviteUrl(request: Request, invitationId: string) {
  const url = new URL("/p0/upgrade", request.url);
  url.searchParams.set("invitation", invitationId);
  return url.toString();
}

async function registerExistingAccountClaim(
  ctx: P0Context,
  vendorId: string,
  planCode: string,
  email: string,
  existingUser: Awaited<ReturnType<typeof findAuthUserByEmail>>,
  request: Request,
) {
  if (!existingUser) throw new Error("The existing account could not be verified.");
  const { data: profile, error: profileError } = await ctx.admin
    .from("profiles")
    .select("role,vendor_id")
    .eq("id", existingUser.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (profile?.role !== "vendor" || profile.vendor_id) {
    throw new Error("This existing account cannot be linked automatically. Use the separately authorized ownership-claim process.");
  }

  const { data: invitationId, error: startError } = await ctx.admin.rpc("p0_start_upgrade_invitation", {
    p_actor: ctx.userId,
    p_vendor: vendorId,
    p_plan_code: planCode,
    p_email: email,
  });
  if (startError) throw startError;
  const { error: markError } = await ctx.admin.rpc("p0_mark_upgrade_invitation", {
    p_actor: ctx.userId,
    p_invitation: invitationId,
    p_delivery_status: "claim_pending",
    p_provider_user_id: existingUser.id,
  });
  if (markError) throw markError;

  return NextResponse.json({
    invitationId,
    claimUrl: inviteUrl(request, invitationId),
    status: "claim_pending",
    message: "No account changes were made. The account owner must sign in and confirm this claim.",
  });
}

export async function GET(request: Request) {
  try {
    const ctx = await context(request);
    if (!ctx) return NextResponse.json({ error: "Sign in with an authorized Operations or Super Admin account." }, { status: 401 });
    if (ctx.role !== "admin" && !Object.values(ctx.permissions).some(Boolean)) {
      return NextResponse.json({ error: "Your Operations account has no assigned P0 permissions." }, { status: 403 });
    }

    const { data: vendors, error: vendorsError } = await ctx.admin
      .from("vendors")
      .select("id,vendor_kind,p0_contact_name,p0_contact_phone,p0_fssai_required,p0_cancelled_at,name,category,description,locality,address,latitude,longitude,service_radius_km,verification_status,operational_status,marketplace_visible,connect_enabled,whatsapp_number,logo_url,created_at")
      .eq("vendor_kind", "p0_connect")
      .order("created_at", { ascending: false });
    if (vendorsError) throw vendorsError;

    const ids = (vendors || []).map((vendor) => vendor.id);
    const [{ data: documents, error: documentsError }, { data: invitations, error: invitationsError }] = await Promise.all([
      ids.length
        ? ctx.admin.from("vendor_documents").select("id,vendor_id,document_number,expiry_date,verification_status,storage_path").in("vendor_id", ids).eq("document_type", "food_certificate").order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      ids.length
        ? ctx.admin.from("p0_upgrade_invitations").select("id,vendor_id,invited_email,status,expires_at,created_at,plan_id").in("vendor_id", ids).order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (documentsError) throw documentsError;
    if (invitationsError) throw invitationsError;

    let operationsUsers: Array<{ id: string; full_name: string; permissions: P0Permissions }> = [];
    if (ctx.role === "admin") {
      const { data: profiles, error: profileError } = await ctx.admin
        .from("profiles")
        .select("id,full_name")
        .eq("role", "operations")
        .order("full_name");
      if (profileError) throw profileError;
      const { data: grants, error: grantsError } = await ctx.admin
        .from("p0_vendor_permissions")
        .select("profile_id,can_create,can_review,can_cancel,can_reactivate,can_upgrade,can_upload");
      if (grantsError) throw grantsError;
      operationsUsers = (profiles || []).map((profile) => ({
        id: profile.id,
        full_name: profile.full_name,
        permissions: { ...EMPTY_PERMISSIONS, ...(grants || []).find((grant) => grant.profile_id === profile.id) },
      }));
    }

    return NextResponse.json({
      vendors: vendors || [],
      documents: documents || [],
      invitations: invitations || [],
      permissions: ctx.permissions,
      operationsUsers,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await context(request);
    if (!ctx) return NextResponse.json({ error: "Sign in with an authorized Operations or Super Admin account." }, { status: 401 });
    let body: Record<string, unknown>;
    let shopImage: File | null = null;
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const imageValue = form.get("shopImage");
      if (imageValue !== null) {
        if (!(imageValue instanceof File)) return NextResponse.json({ error: "Choose a valid shop image file." }, { status: 400 });
        if (imageValue.size > 0) shopImage = imageValue;
      }
      body = Object.fromEntries([...form.entries()].filter(([key]) => key !== "shopImage"));
    } else {
      body = await request.json() as Record<string, unknown>;
    }
    const action = String(body.action || "");

    if (action === "permissions") {
      if (ctx.role !== "admin") return NextResponse.json({ error: "Only Super Admin can assign P0 Operations permissions." }, { status: 403 });
      const { error } = await ctx.admin.rpc("p0_set_operations_permissions", {
        p_actor: ctx.userId,
        p_operations_profile: String(body.profileId || ""),
        p_permissions: body.permissions || {},
      });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    const actionPermission: Partial<Record<string, P0Action>> = {
      create: "create",
      cancel: "cancel",
      reactivate: "reactivate",
      upgrade: "upgrade",
    };
    const permission = actionPermission[action];
    if (permission && !can(ctx, permission)) {
      return NextResponse.json({ error: `Your account is not authorized to ${action} P0 vendors.` }, { status: 403 });
    }

    if (action === "create") {
      const durationHours = Number(body.durationHours);
      if (!Number.isFinite(durationHours) || durationHours < 1 || durationHours > 24) {
        return NextResponse.json({ error: "Operating duration must be between 1 and 24 hours." }, { status: 400 });
      }
      if (shopImage && !["image/png", "image/jpeg", "image/webp"].includes(shopImage.type)) {
        return NextResponse.json({ error: "Upload a PNG, JPG or WebP shop image." }, { status: 400 });
      }
      let imagePath: string | null = null;
      let logoUrl = body.logoUrl || null;
      if (shopImage) {
        if (shopImage.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Shop image must be under 10 MB." }, { status: 413 });
        const extension = shopImage.type === "image/jpeg" ? "jpg" : shopImage.type === "image/png" ? "png" : "webp";
        imagePath = `p0-connect/${crypto.randomUUID()}.${extension}`;
        const uploaded = await ctx.admin.storage.from("p0-shop-images").upload(imagePath, shopImage, {
          contentType: shopImage.type,
          upsert: false,
        });
        if (uploaded.error) throw uploaded.error;
        logoUrl = ctx.admin.storage.from("p0-shop-images").getPublicUrl(imagePath).data.publicUrl;
      }
      try {
        const { data, error } = await ctx.admin.rpc("p0_create_vendor", {
          p_actor: ctx.userId,
          p_name: body.name,
          p_category: body.category,
          p_description: body.description || null,
          p_locality: body.locality,
          p_address: body.address || null,
          p_latitude: Number(body.latitude),
          p_longitude: Number(body.longitude),
          p_service_radius_km: Number(body.serviceRadiusKm),
          p_contact_name: body.contactName,
          p_contact_phone: body.contactPhone,
          p_whatsapp_number: body.whatsappNumber,
          p_fssai_required: body.fssaiRequired === true || body.fssaiRequired === "true",
          p_logo_url: logoUrl,
          p_operating_hours: { duration_hours: durationHours },
        });
        if (error) throw error;
        return NextResponse.json({ vendorId: data }, { status: 201 });
      } catch (error) {
        if (imagePath) {
          const removed = await ctx.admin.storage.from("p0-shop-images").remove([imagePath]);
          if (removed.error) console.error("P0 shop image cleanup failed:", removed.error.message);
        }
        throw error;
      }
    }

    if (action === "review") {
      if (!can(ctx, "review")) return NextResponse.json({ error: "Your account is not authorized to review P0 vendors." }, { status: 403 });
      const { error } = await ctx.caller.rpc("review_vendor_and_notify", {
        target_vendor: String(body.vendorId || ""),
        decision: String(body.decision || ""),
        review_note: body.note ? String(body.note) : null,
      });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === "cancel" || action === "reactivate") {
      const functionName = action === "cancel" ? "p0_cancel_vendor" : "p0_reactivate_vendor";
      const { error } = await ctx.admin.rpc(functionName, {
        p_actor: ctx.userId,
        p_vendor: String(body.vendorId || ""),
      });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === "upgrade") {
      const vendorId = String(body.vendorId || "");
      const planCode = String(body.planCode || "").toLowerCase();
      const email = String(body.email || "").trim().toLowerCase();
      const pending = await ctx.admin
        .from("p0_upgrade_invitations")
        .select("id,status,invited_email,provider_user_id,expires_at")
        .eq("vendor_id", vendorId)
        .in("status", ["pending", "sent", "claim_pending", "delivery_failed"])
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (pending.error) throw pending.error;
      if (pending.data && (pending.data.invited_email !== email || pending.data.status === "claim_pending")) {
        if (pending.data.invited_email === email && pending.data.status === "claim_pending") {
          return NextResponse.json({
            invitationId: pending.data.id,
            claimUrl: inviteUrl(request, pending.data.id),
            status: "claim_pending",
            message: "The account owner must sign in and confirm this claim.",
          });
        }
        return NextResponse.json({ error: "A different upgrade invitation is already pending for this vendor." }, { status: 409 });
      }

      const existingUser = await findAuthUserByEmail(ctx.admin, email);
      if (existingUser) {
        if (pending.data && pending.data.invited_email === email &&
          (!pending.data.provider_user_id || existingUser.id === pending.data.provider_user_id)) {
          const metaInvitation = existingUser.user_metadata?.p0_upgrade_invitation_id;
          if (metaInvitation !== pending.data.id) {
            return NextResponse.json({ error: "Existing account identity could not be safely matched to this invitation." }, { status: 409 });
          }
          const { data: existingProfile, error: existingProfileError } = await ctx.admin
            .from("profiles")
            .select("role,vendor_id")
            .eq("id", existingUser.id)
            .maybeSingle();
          if (existingProfileError) throw existingProfileError;
          if (existingProfile?.role !== "vendor" || existingProfile.vendor_id) {
            return NextResponse.json({ error: "This account can no longer accept this invitation." }, { status: 409 });
          }
          const { error: resendError } = await ctx.caller.auth.resend({
            type: "signup",
            email,
            options: { emailRedirectTo: inviteUrl(request, pending.data.id) },
          });
          if (resendError) throw resendError;
          const { error: markError } = await ctx.admin.rpc("p0_mark_upgrade_invitation", {
            p_actor: ctx.userId,
            p_invitation: pending.data.id,
            p_delivery_status: "sent",
            p_provider_user_id: existingUser.id,
          });
          if (markError) throw markError;
          return NextResponse.json({ invitationId: pending.data.id, status: "sent", retried: true });
        }
        return registerExistingAccountClaim(ctx, vendorId, planCode, email, existingUser, request);
      }

      const { data: invitationId, error: startError } = await ctx.admin.rpc("p0_start_upgrade_invitation", {
        p_actor: ctx.userId,
        p_vendor: vendorId,
        p_plan_code: planCode,
        p_email: email,
      });
      if (startError) throw startError;

        const { data: inviteData, error: inviteError } = await ctx.admin.auth.admin.inviteUserByEmail(email, {
          redirectTo: inviteUrl(request, invitationId),
          data: { full_name: "", role: "vendor", p0_upgrade_invitation_id: invitationId },
        });
        if (inviteError) {
  console.error("[P0 Upgrade] Supabase invitation failed:", {
    message: inviteError.message,
    status: inviteError.status,
    code: inviteError.code,
  });
}
        if (inviteError || !inviteData.user) {
          const { error: markError } = await ctx.admin.rpc("p0_mark_upgrade_invitation", {
            p_actor: ctx.userId,
            p_invitation: invitationId,
            p_delivery_status: "delivery_failed",
          });
          if (markError) throw markError;
          throw inviteError || new Error("Supabase Auth did not return an invited account.");
        }

        const { error: markError } = await ctx.admin.rpc("p0_mark_upgrade_invitation", {
          p_actor: ctx.userId,
          p_invitation: invitationId,
          p_delivery_status: "sent",
          p_provider_user_id: inviteData.user.id,
        });
        if (markError) throw markError;
        return NextResponse.json({ invitationId, status: "sent", expiresInDays: 7 });
      }

      return NextResponse.json({ error: "Unsupported P0 action." }, { status: 400 });
    } catch (error) {
      return errorResponse(error);
    }
  }
