import test from "node:test";
import assert from "node:assert/strict";
import {
  MAP_GRID_DEGREES, STATUS_TTL_MS, checkStatusVideoSeconds, coarsePin, coarsen, distanceKm, formatPeopleDistance, groupStatuses, halfKm,
  handleMatches, isStatusActive, normaliseHandleQuery, personOnMap, searchReady, statusExpiry, statusTimeLeft, statusVisibleTo,
} from "../lib/people-rules.ts";

// People and Statuses: the promises we make about privacy and about what disappears. The database applies the same
// rules in supabase/V9_3_PEOPLE_STATUS.sql.

const NOW = Date.parse("2026-10-20T12:00:00Z");
const iso = (hours) => new Date(NOW + hours * 3_600_000).toISOString();
const HOME = { lat: 11.0383, lng: 76.9781 };
const north = (km) => ({ lat: HOME.lat + km / 111.32, lng: HOME.lng });
const aud = (o = {}) => ({ authorId: "a", viewerId: "v", expiresAt: iso(10), viewerFollowsAuthor: false, authorDiscoverable: true, authorPin: north(2), viewerPin: HOME, radiusKm: 5, alreadyViewed: false, ...o });

test("a status lasts 24 hours: active just before, gone at the mark", () => {
  assert.equal(STATUS_TTL_MS, 86_400_000);
  const expires = statusExpiry(NOW);
  assert.equal(new Date(expires).getTime() - NOW, STATUS_TTL_MS);
  assert.equal(isStatusActive({ expiresAt: expires }, NOW + STATUS_TTL_MS - 1), true);
  assert.equal(isStatusActive({ expiresAt: expires }, NOW + STATUS_TTL_MS), false);
  assert.equal(isStatusActive({ expiresAt: expires }, NOW + STATUS_TTL_MS + 5000), false);
});

test("time left is coarse and never negative", () => {
  assert.equal(statusTimeLeft(iso(23.5), NOW), "23h left");
  assert.equal(statusTimeLeft(iso(1), NOW), "1h left");
  assert.equal(statusTimeLeft(new Date(NOW + 45 * 60_000).toISOString(), NOW), "45 min left");
  assert.equal(statusTimeLeft(new Date(NOW + 20_000).toISOString(), NOW), "1 min left");
  assert.equal(statusTimeLeft(iso(-1), NOW), "Expired");
  assert.equal(statusTimeLeft("nonsense", NOW), "Expired");
});

test("a follower can watch; a stranger only if the author is on the map and within the radius", () => {
  assert.equal(statusVisibleTo(aud({ viewerFollowsAuthor: true, authorDiscoverable: false, authorPin: null }), NOW), true);
  assert.equal(statusVisibleTo(aud(), NOW), true);                                    // nearby and discoverable
  assert.equal(statusVisibleTo(aud({ authorDiscoverable: false }), NOW), false);       // not on the map: hidden from strangers
  assert.equal(statusVisibleTo(aud({ authorPin: north(8) }), NOW), false);             // 8 km away, radius 5
  assert.equal(statusVisibleTo(aud({ authorPin: north(8), radiusKm: 10 }), NOW), true);
  assert.equal(statusVisibleTo(aud({ authorPin: north(45), radiusKm: 99 }), NOW), false); // the radius is capped at 30 km
  assert.equal(statusVisibleTo(aud({ viewerPin: null }), NOW), false);                  // no pin, no nearby
});

test("private account statuses are visible only to approved followers", () => {
  assert.equal(statusVisibleTo(aud({ authorPrivateAccount: true }), NOW), false);
  assert.equal(statusVisibleTo(aud({ authorPrivateAccount: true, viewerFollowsAuthor: true }), NOW), true);
});

test("view-once, expiry and your own status", () => {
  assert.equal(statusVisibleTo(aud({ alreadyViewed: true }), NOW), false);
  assert.equal(statusVisibleTo(aud({ viewerFollowsAuthor: true, alreadyViewed: true }), NOW), false);
  assert.equal(statusVisibleTo(aud({ expiresAt: iso(-0.01) }), NOW), false);
  assert.equal(statusVisibleTo(aud({ viewerId: "a" }), NOW), false);
});

test("the map position is snapped to a ~550 m grid, never the exact pin", () => {
  assert.equal(MAP_GRID_DEGREES, 0.005);
  const exact = { lat: 11.0383247, lng: 76.9780717 };
  const c = coarsePin(exact);
  assert.equal(c.lat, 11.04);
  assert.equal(c.lng, 76.98);
  assert.ok(distanceKm(exact, c) < 0.5, "the snapped point stays close");
  assert.notDeepEqual(c, exact);
  for (const v of [11.0383, 11.0399, 11.0401, 76.9776, 76.9781]) assert.equal(Math.round((coarsen(v) / MAP_GRID_DEGREES) * 1e6) / 1e6 % 1, 0, `${v} -> ${coarsen(v)} is on the grid`);
  assert.equal(coarsen(coarsen(11.03832)), coarsen(11.03832), "snapping twice changes nothing");
});

test("distances shown for people are to the nearest half kilometre", () => {
  assert.equal(halfKm(0.2), 0); assert.equal(halfKm(0.3), 0.5); assert.equal(halfKm(1.74), 1.5); assert.equal(halfKm(1.76), 2);
  assert.equal(formatPeopleDistance(0.1), "Under 0.5 km");
  assert.equal(formatPeopleDistance(1.6), "1.5 km");
  assert.equal(formatPeopleDistance(null), "");
});

test("only people who chose the map appear on it, inside the radius", () => {
  const person = (o = {}) => ({ discoverable: true, pin: north(3), ...o });
  assert.equal(personOnMap(person(), HOME, 5), true);
  assert.equal(personOnMap(person({ discoverable: false }), HOME, 5), false);
  assert.equal(personOnMap(person({ pin: null }), HOME, 5), false);
  assert.equal(personOnMap(person({ pin: north(7) }), HOME, 5), false);
  assert.equal(personOnMap(person(), null, 5), false);
});

test("searching by handle: at least two letters, @ and case ignored, prefix match", () => {
  assert.equal(normaliseHandleQuery("  @Priya_Eats "), "priya_eats");
  assert.equal(searchReady("p"), false); assert.equal(searchReady("@p"), false); assert.equal(searchReady("pr"), true); assert.equal(searchReady(null), false);
  assert.equal(handleMatches("priya_eats", "PRI"), true);
  assert.equal(handleMatches("priya_eats", "@riya"), false);   // prefix, not substring
  assert.equal(handleMatches("priya_eats", ""), true);          // an empty filter keeps everyone
});

test("the status rail puts followed people first, newest author first, oldest status first within an author", () => {
  const items = [
    { authorId: "near1", createdAt: iso(-1), source: "nearby", id: 1 },
    { authorId: "fol1", createdAt: iso(-5), source: "following", id: 2 },
    { authorId: "fol1", createdAt: iso(-2), source: "following", id: 3 },
    { authorId: "fol2", createdAt: iso(-1), source: "following", id: 4 },
    { authorId: "near2", createdAt: iso(-3), source: "nearby", id: 5 },
  ];
  const groups = groupStatuses(items);
  assert.deepEqual(groups.map((g) => g.authorId), ["fol2", "fol1", "near1", "near2"]);
  assert.deepEqual(groups[1].items.map((i) => i.id), [2, 3]);
  assert.equal(groups[0].source, "following");
  assert.equal(groups[2].source, "nearby");
});

test("a video status is at most 30 seconds", () => {
  assert.equal(checkStatusVideoSeconds(30), null);
  assert.equal(checkStatusVideoSeconds(1), null);
  assert.match(checkStatusVideoSeconds(31), /at most 30 seconds/);
  assert.ok(checkStatusVideoSeconds(0));
  assert.ok(checkStatusVideoSeconds(Number.NaN));
});
