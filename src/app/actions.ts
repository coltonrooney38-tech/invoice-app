"use server";

import { cookies } from "next/headers";
import { runs, tasks } from "@trigger.dev/sdk";
import { AUTH_COOKIE, isValidToken } from "@/lib/auth";
import { InvoiceInputSchema, type InvoiceInput } from "@/invoice/schema";
import { deliverInvoice } from "@/invoice/send";
import { GmailError } from "@/lib/composio";
import type { sendInvoice } from "@/trigger/send-invoice";

async function requireAuth() {
  if (!(await isValidToken((await cookies()).get(AUTH_COOKIE)?.value))) {
    throw new Error("Not signed in. Reload the page and sign in again.");
  }
}

export type SubmitResult =
  | { ok: true; total: string; sentTo: string; via: "trigger" | "direct" }
  | { ok: false; error: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const WAITING = new Set(["PENDING_VERSION", "QUEUED", "DELAYED", "WAITING_FOR_DEPLOY"]);
const FAILED = new Set(["FAILED", "CRASHED", "CANCELED", "SYSTEM_FAILURE", "EXPIRED", "TIMED_OUT"]);

type Outcome = { kind: "sent"; total: string; sentTo: string } | { kind: "failed"; error: string } | { kind: "unavailable" };

// Runs the send on Trigger.dev. If no deployed worker picks it up quickly
// (e.g. deploys aren't enabled yet), cancel it and report "unavailable" so
// the caller can send directly instead of leaving the invoice stuck.
async function viaTrigger(invoice: InvoiceInput): Promise<Outcome> {
  if (!process.env.TRIGGER_SECRET_KEY) return { kind: "unavailable" };
  let id: string;
  try {
    const handle = await tasks.trigger<typeof sendInvoice>("send-invoice", invoice, {
      idempotencyKey: `invoice-${invoice.invoiceNumber}-${Date.now()}`,
    });
    id = handle.id;
  } catch (e) {
    console.error("Trigger.dev trigger failed:", (e as Error).message);
    return { kind: "unavailable" };
  }

  const started = Date.now();
  while (Date.now() - started < 240_000) {
    await sleep(1500);
    const run = await runs.retrieve<typeof sendInvoice>(id).catch(() => null);
    if (!run) continue;
    if (run.status === "COMPLETED") {
      const out = run.output as { total?: string; sentTo?: string } | undefined;
      return { kind: "sent", total: out?.total ?? "", sentTo: out?.sentTo ?? invoice.clientEmail };
    }
    if (FAILED.has(run.status)) return { kind: "failed", error: run.error?.message ?? run.status };
    if (WAITING.has(run.status) && Date.now() - started > 15_000) {
      await runs.cancel(id).catch(() => {});
      const after = await runs.retrieve(id).catch(() => null);
      // Only fall back if it really never started, so the client isn't emailed twice.
      if (!after || after.status === "CANCELED") return { kind: "unavailable" };
    }
  }
  return { kind: "failed", error: `Still running on Trigger.dev (run ${id}). Check the dashboard before re-sending.` };
}

export async function submitInvoice(input: unknown): Promise<SubmitResult> {
  await requireAuth();
  const parsed = InvoiceInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" · ") };
  }

  const t = await viaTrigger(parsed.data);
  if (t.kind === "sent") return { ok: true, total: t.total, sentTo: t.sentTo, via: "trigger" };
  if (t.kind === "failed") return { ok: false, error: t.error };

  // Trigger.dev unavailable: send directly from this server.
  try {
    const { total, sentTo } = await deliverInvoice(parsed.data);
    return { ok: true, total, sentTo, via: "direct" };
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
