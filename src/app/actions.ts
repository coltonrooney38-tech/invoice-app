"use server";

import { cookies } from "next/headers";
import { AUTH_COOKIE, isValidToken } from "@/lib/auth";
import { InvoiceInputSchema } from "@/invoice/schema";
import { deliverInvoice } from "@/invoice/send";
import { GmailError } from "@/lib/composio";

async function requireAuth() {
  if (!(await isValidToken((await cookies()).get(AUTH_COOKIE)?.value))) {
    throw new Error("Not signed in. Reload the page and sign in again.");
  }
}

export type SubmitResult =
  | { ok: true; total: string; sentTo: string }
  | { ok: false; error: string };

// Sends right away from the server (PDF + Gmail via Composio). No background
// worker needed, so the site works without Trigger.dev.
export async function submitInvoice(input: unknown): Promise<SubmitResult> {
  await requireAuth();
  const parsed = InvoiceInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" · ") };
  }
  try {
    const { total, sentTo } = await deliverInvoice(parsed.data);
    return { ok: true, total, sentTo };
  } catch (e) {
    const msg = (e as Error).message;
    console.error("submitInvoice failed:", msg);
    return {
      ok: false,
      error:
        e instanceof GmailError && e.permanent
          ? `${msg}. Gmail may need reconnecting (npm run connect).`
          : `Couldn't send: ${msg}`,
    };
  }
}
