import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

const CODE_DIGITS = 6;

export function generateDeliveryVerificationCode() {
  return randomInt(0, 10 ** CODE_DIGITS).toString().padStart(CODE_DIGITS, "0");
}

export function hashDeliveryVerificationCode(orderId, code, secret) {
  return createHmac("sha256", secret).update(`${orderId}:${code}`).digest("hex");
}

export function verifyDeliveryVerificationCode(orderId, code, expectedHash, secret) {
  if (!/^\d{6}$/.test(code) || !/^[a-f\d]{64}$/i.test(expectedHash)) return false;
  const actual = Buffer.from(hashDeliveryVerificationCode(orderId, code, secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}