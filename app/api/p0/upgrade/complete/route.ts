import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const authorization = request.headers.get("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");

  // Step 1: Validate configuration and authentication token
  if (!url || !anonKey || !serviceRoleKey || !token) {
    console.error("[P0 Upgrade] Missing configuration or access token", {
      hasUrl: Boolean(url),
      hasAnonKey: Boolean(anonKey),
      hasServiceRoleKey: Boolean(serviceRoleKey),
      hasToken: Boolean(token),
    });

    return NextResponse.json(
      { error: "Sign in with the invited vendor account first." },
      { status: 401 }
    );
  }

  // Step 2: Parse and validate invitation ID
  let invitationId: string;

  try {
    const body = (await request.json()) as {
      invitationId?: string;
    };

    invitationId = String(body.invitationId || "");

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        invitationId
      )
    ) {
      return NextResponse.json(
        { error: "The invitation link is invalid." },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "The invitation request is invalid." },
      { status: 400 }
    );
  }

  console.log("[P0 Upgrade] Request received", {
    hasToken: true,
    hasInvitationId: true,
  });

  // Step 3: Authenticate the caller
  const caller = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data: authData, error: authError } =
    await caller.auth.getUser(token);

  if (authError || !authData.user) {
    console.error("[P0 Upgrade] Authentication failed", {
      message: authError?.message,
      status: authError?.status,
    });

    return NextResponse.json(
      {
        error:
          "The authenticated vendor account could not be verified. Please sign in again.",
      },
      { status: 401 }
    );
  }

  console.log("[P0 Upgrade] Authentication successful", {
    userId: authData.user.id,
    email: authData.user.email,
  });

  // Step 4: Call the database function using the service role
  const admin = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  console.log("[P0 Upgrade] Calling p0_complete_upgrade", {
    invitationId,
    inviteeId: authData.user.id,
  });

  const { data: vendorId, error: upgradeError } = await admin.rpc(
    "p0_complete_upgrade",
    {
      p_invitation: invitationId,
      p_invitee: authData.user.id,
    }
  );

  if (upgradeError) {
    console.error("[P0 Upgrade] Database function failed", {
      message: upgradeError.message,
      code: upgradeError.code,
      details: upgradeError.details,
      hint: upgradeError.hint,
    });

    const message =
      /p0_upgrade_invitations|p0_vendor_history|p0_complete_upgrade/i.test(
        upgradeError.message
      )
        ? "P0 upgrade completion is unavailable until the reviewed lifecycle migration is applied."
        : upgradeError.message;

    return NextResponse.json(
      { error: message },
      { status: 409 }
    );
  }

  console.log("[P0 Upgrade] Upgrade completed successfully", {
    vendorId,
  });

  return NextResponse.json({
    vendorId,
    completed: true,
  });
}