export function generateDeliveryVerificationCode(): string;
export function hashDeliveryVerificationCode(orderId: string, code: string, secret: string): string;
export function verifyDeliveryVerificationCode(orderId: string, code: string, expectedHash: string, secret: string): boolean;

