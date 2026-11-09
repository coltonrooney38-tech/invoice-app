// Tiny password gate for a one-person tool. The cookie holds a SHA-256 of the
// password (never the password itself); changing FORM_PASSWORD signs everyone out.
export const AUTH_COOKIE = "invoice_auth";

export async function tokenFor(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(`invoice-app-v1:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isValidToken(token: string | undefined): Promise<boolean> {
  const pw = process.env.FORM_PASSWORD;
  if (!pw || !token) return false; // fail closed if no password is configured
  return safeEqual(token, await tokenFor(pw));
}
