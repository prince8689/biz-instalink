// Server-only Razorpay REST helpers (Workers-compatible: fetch + WebCrypto).

const API = "https://api.razorpay.com/v1";

function credentials(): { keyId: string; keySecret: string } {
  const keyId = process.env["RAZORPAY_KEY_ID"];
  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keyId || !keySecret) throw new Error("Payments are not configured on the server.");
  return { keyId, keySecret };
}

export function getPublicKeyId(): string {
  return credentials().keyId;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

export async function createRazorpayOrder(
  amountPaise: number,
  currency: string,
  notes: Record<string, string>,
): Promise<RazorpayOrder> {
  const { keyId, keySecret } = credentials();
  const auth = btoa(`${keyId}:${keySecret}`);
  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: amountPaise, currency, notes, payment_capture: 1 }),
  });
  const body = (await res.json()) as { id?: string; amount?: number; currency?: string; error?: { description?: string } };
  if (!res.ok || !body.id) {
    throw new Error(`Could not start payment: ${body.error?.description ?? `HTTP ${res.status}`}`);
  }
  return { id: body.id, amount: body.amount ?? amountPaise, currency: body.currency ?? currency };
}

/** Verifies the Razorpay checkout signature: HMAC_SHA256(order_id|payment_id, secret). */
export async function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
): Promise<boolean> {
  const { keySecret } = credentials();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(keySecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${orderId}|${paymentId}`),
  );
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}
