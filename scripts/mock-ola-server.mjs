// A small stand-in for the Ola Maps service, for tests that must not use real credentials.
// Run: node scripts/mock-ola-server.mjs [port]     (default 4599)
// It checks that a token or key was sent, serves an empty map style, and answers the address searches.
import http from "node:http";
const port = Number(process.argv[2] || process.env.PORT || 4599);
const seen = { token: 0, style: 0, tiles: 0, places: 0, unauthorised: 0 };
const send = (res, code, body) => { res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,content-type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" }); res.end(JSON.stringify(body)); };
const authed = (req, url) => req.headers.authorization === "Bearer mock-token" || url.searchParams.get("api_key") === "mock-key";
http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (url.pathname === "/__seen") return send(res, 200, seen);
  if (url.pathname === "/token" && req.method === "POST") {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const p = new URLSearchParams(body);
      if (p.get("grant_type") !== "client_credentials" || p.get("client_id") !== "mock-id" || p.get("client_secret") !== "mock-secret") return send(res, 400, { message: "Invalid client_id" });
      seen.token++; send(res, 200, { access_token: "mock-token", expires_in: 300, token_type: "Bearer" });
    }); return;
  }
  if (!authed(req, url)) { seen.unauthorised++; return send(res, 401, { message: "No credentials provided" }); }
  if (url.pathname.endsWith("/style.json")) {
    seen.style++;
    return send(res, 200, { version: 8, name: "mock", sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#e8e2dc" } }] });
  }
  if (url.pathname === "/places/v1/autocomplete") {
    seen.places++; const q = (url.searchParams.get("input") || "").toLowerCase();
    if (!q.includes("puram")) return send(res, 200, { status: "ok", predictions: [] });
    return send(res, 200, { status: "ok", predictions: [
      { description: "RS Puram, Coimbatore, Tamil Nadu", place_id: "mock:1", geometry: { location: { lat: 11.0066, lng: 76.9496 } } },
      { description: "Gandhipuram, Coimbatore, Tamil Nadu", place_id: "mock:2" },
    ] });
  }
  if (url.pathname === "/places/v1/details") { seen.places++; return send(res, 200, { status: "ok", result: { geometry: { location: { lat: 11.0183, lng: 76.9725 } } } }); }
  if (url.pathname === "/places/v1/geocode") { seen.places++; return send(res, 200, { status: "ok", geocodingResults: [{ formatted_address: "RS Puram, Coimbatore, Tamil Nadu 641002", geometry: { location: { lat: 11.0066, lng: 76.9496 } } }] }); }
  if (url.pathname === "/places/v1/reverse-geocode") { seen.places++; return send(res, 200, { status: "ok", results: [{ formatted_address: "Race Course Road, RS Puram, Coimbatore, Tamil Nadu" }] }); }
  send(res, 404, { message: "not found" });
}).listen(port, () => console.log(`mock Ola Maps on ${port}`));
