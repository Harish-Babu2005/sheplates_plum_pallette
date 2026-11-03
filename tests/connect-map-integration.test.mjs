import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  hasValidMapCoordinates,
  mergeMarketplaceAndConnectPins,
  uniqueValidMapPins,
} from "../lib/connect-map.ts";

const discover = await readFile(new URL("../components/customer-v2/discover.tsx", import.meta.url), "utf8");
const mapSource = await readFile(new URL("../components/nearby-vendors-map.tsx", import.meta.url), "utf8");
const supabase = await readFile(new URL("../lib/supabase.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20261027000500_p0_vendor_lifecycle.sql", import.meta.url), "utf8");

const pin = (id, extra = {}) => ({
  id,
  name: id,
  lat: 12.9,
  lng: 80.2,
  distanceKm: 1,
  ...extra,
});

test("marketplace-only vendors retain their marketplace pin and do not gain a Connect action", () => {
  const marketplacePin = pin("marketplace", { photoUrl: "/market.jpg" });
  assert.deepEqual(mergeMarketplaceAndConnectPins([marketplacePin], []), [marketplacePin]);
  assert.match(discover, /connectVendor && connectNumber && onContact/);
  assert.match(discover, /onOpen\(vendor\.id\)/);
});

test("Connect-only vendors remain as one discoverable pin without catalogue requirements", () => {
  const connectPin = pin("connect", { photoUrl: "/connect.jpg" });
  const merged = mergeMarketplaceAndConnectPins([], [connectPin]);
  assert.deepEqual(merged, [connectPin]);
  assert.match(discover, /connectRows\.filter\(\(vendor\) => !rows\.some/);
  assert.doesNotMatch(discover, /connectRows.*vendor_menu_items/);
});

test("overlapping marketplace and Connect vendors retain marketplace data and a separate Connect action", () => {
  const marketplacePin = pin("shared", { name: "Marketplace name", photoUrl: "/valid-marketplace.jpg" });
  const connectPin = pin("shared", { name: "Connect name", photoUrl: null });
  const [merged] = mergeMarketplaceAndConnectPins([marketplacePin], [connectPin]);
  assert.equal(merged, marketplacePin);
  assert.equal(merged.name, "Marketplace name");
  assert.equal(merged.photoUrl, "/valid-marketplace.jpg");
  assert.match(discover, /connectVendor=\{connectVendor\} onContact=\{contactConnectVendor\}/);
  assert.match(discover, /connectVendor=\{selectedConnectVendor\} onContact=\{contactConnectVendor\}/);
});

test("missing or invalid WhatsApp numbers suppress the Connect action", () => {
  assert.match(discover, /const connectNumber = connectVendor\?\.whatsapp_number \? normalizeWhatsAppNumber/);
  assert.match(discover, /connectVendor && connectNumber && onContact/);
  assert.match(supabase, /return \/\^\\\+\[1-9\]\\d\{7,14\}\$\/\.test\(normalized\) \? normalized : null/);
});

test("disabled or unverified Connect activation never enters map action data", () => {
  const load = supabase.slice(supabase.indexOf("export async function loadConnectVendorsNearby"), supabase.indexOf("export async function loadLiveVendorWorkspace"));
  assert.match(migration, /v\.vendor_kind='p0_connect' AND v\.connect_enabled/i);
  assert.match(migration, /v\.verification_status='verified' AND v\.operational_status='active'/i);
  assert.match(migration, /vendor_kind text,vendor_id uuid/);
  assert.doesNotMatch(load, /from\("vendors"\)/);
  assert.match(load, /filter\(\(vendor\) => vendor\.vendor_kind === "p0_connect"\)/);
  assert.match(discover, /connectVendor && connectNumber && onContact/);
});

test("invalid coordinates and duplicate IDs cannot produce duplicate vendor pins", () => {
  const valid = pin("same");
  const invalid = pin("bad-lat", { lat: 91 });
  const invalidLongitude = pin("bad-lng", { lng: 181 });
  const duplicate = pin("same", { name: "duplicate" });
  assert.equal(hasValidMapCoordinates(valid), true);
  assert.equal(hasValidMapCoordinates(invalid), false);
  assert.equal(hasValidMapCoordinates(invalidLongitude), false);
  assert.deepEqual(uniqueValidMapPins([valid, invalid, invalidLongitude, duplicate]), [valid]);
  assert.match(mapSource, /uniqueValidMapPins\(raw\.vendors\)/);
});

test("People markers retain their separate data path while duplicate and invalid pins are guarded", () => {
  const firstPerson = { ...pin("person"), handle: "@one" };
  const secondPerson = { ...pin("person"), handle: "@duplicate" };
  assert.deepEqual(uniqueValidMapPins([firstPerson, secondPerson]), [firstPerson]);
  assert.match(mapSource, /uniqueValidMapPins\(raw\.people\)/);
  assert.match(discover, /tab === "People"\s*\?\s*\[\]/);
  assert.match(discover, /peopleQuery\.rows/);
});

test("Connect RPC failures retain the explicit error state without fabricated fallback results", () => {
  assert.match(discover, /status: "error"; error: string/);
  assert.match(discover, /setConnectLoad\(\{\s*locationKey: requestLocationKey,\s*status: "error"/);
  assert.match(discover, /connectError && <p role="alert"/);
  assert.doesNotMatch(discover, /connectError[\s\S]{0,250}state\.vendors/);
  assert.match(discover, /catch \(error\)[\s\S]{0,250}status: "error"/);
});

test("WhatsApp click tracking retains the existing RPC and map/search attribution", () => {
  assert.match(discover, /await trackLiveVendorWhatsAppClick\(vendor\.vendor_id, source\)/);
  assert.match(discover, /contactSource=\{query\.trim\(\) \? "search" : "map"\}/);
  assert.match(discover, /WhatsApp will open, but this contact click could not be recorded/);
});
