import test from "node:test";
import assert from "node:assert/strict";
import { extractPartialReply } from "../lib/she-agent-commerce-runtime.ts";

// She Agent streams its answer: the reply is the first property of the result JSON, so the words can be
// shown while the rest of the document is still being written.

test("returns nothing until the reply text has started", () => {
  assert.equal(extractPartialReply(""), "");
  assert.equal(extractPartialReply('{"rep'), "");
  assert.equal(extractPartialReply('{"reply"'), "");
  assert.equal(extractPartialReply('{"reply":'), "");
});

test("returns the words written so far, growing with each chunk", () => {
  assert.equal(extractPartialReply('{"reply":"Hi'), "Hi");
  assert.equal(extractPartialReply('{"reply":"Hi there, I found'), "Hi there, I found");
  assert.equal(extractPartialReply('{"reply":"Hi there!","intent":"answer"'), "Hi there!");
});

test("stops at the closing quote and ignores the other fields", () => {
  assert.equal(extractPartialReply('{"reply":"Done.","intent":"browse","budget":-1,"clarifyingQuestion":"not this"}'), "Done.");
});

test("decodes escapes and waits for an unfinished one", () => {
  assert.equal(extractPartialReply('{"reply":"She said \\"hello\\" today"}'), 'She said "hello" today');
  assert.equal(extractPartialReply('{"reply":"Line one\\nLine two"}'), "Line one\nLine two");
  assert.equal(extractPartialReply('{"reply":"Price \\u20b9120 only"}'), "Price ₹120 only");
  assert.equal(extractPartialReply('{"reply":"Cut off \\'), "Cut off ");
  assert.equal(extractPartialReply('{"reply":"Rupee \\u20'), "Rupee ");
});

test("tolerates spaces after the colon", () => {
  assert.equal(extractPartialReply('{ "reply" :   "Spaced out'), "Spaced out");
});
