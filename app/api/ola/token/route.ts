import { NextResponse } from "next/server";
import { olaAccessToken, olaApiBase, olaConfigured } from "@/lib/ola-maps";

// Tells the browser how to load the Ola map: a short-lived access token (our client secret stays on the server),
// or, if only a domain-restricted public key is configured, that key. Nothing here is cacheable.
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!olaConfigured()) return NextResponse.json({ enabled: false }, { status: 200, headers });
  // only our own pages may ask: a cross-site page cannot borrow the token
  const origin = request.headers.get("origin") || request.headers.get("referer");
  if (origin) { try { if (new URL(origin).host !== new URL(request.url).host) return NextResponse.json({ enabled: false }, { status: 403, headers }); } catch { return NextResponse.json({ enabled: false }, { status: 403, headers }); } }
  const style = process.env.NEXT_PUBLIC_OLA_MAP_STYLE || "default-light-standard";
  const base = olaApiBase();
  try {
    if (process.env.OLA_MAPS_CLIENT_ID && process.env.OLA_MAPS_CLIENT_SECRET) {
      const { token, expiresIn } = await olaAccessToken();
      return NextResponse.json({ enabled: true, auth: "token", token, expiresIn, base, style }, { headers });
    }
    const key = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY;
    if (key) return NextResponse.json({ enabled: true, auth: "key", key, base, style }, { headers });
    // an API key that is only allowed on the server cannot be given to the browser: use the standard map instead
    return NextResponse.json({ enabled: false }, { headers });
  } catch (error) {
    console.error("Ola Maps token failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ enabled: false, error: "Map sign-in failed" }, { status: 200, headers });
  }
}
