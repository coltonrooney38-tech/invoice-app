"use server";

import { cookies } from "next/headers";
import { runs, tasks } from "@trigger.dev/sdk";
import { AUTH_COOKIE, isValidToken } from "@/lib/auth";
import { InvoiceInputSchema } from "@/invoice/schema";
import type { sendInvoice } from "@/trigger/send-invoice";

async function requireAuth() {
  if (!(await isValidToken((await cookies()).get(AUTH_COOKIE)?.value))) {
    throw new Error("Not signed in. Reload the page and sign in again.");
  }
}

export type SubmitResult = { ok: true; runId: string } | { ok: false; error: string };

export async function submitInvoice(input: unknown): Promise<SubmitResult> {
  await requireAuth();
  const parsed = InvoiceInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" · ") };
  }
  try {
    const handle = await tasks.trigger<typeof sendInvoice>("send-invoice", parsed.data, {
      // A double-click or re-send of the same invoice # within 10 minutes
      // reuses the first run instead of emailing the client twice.
      idempotencyKey: `invoice-${parsed.data.invoiceNumber}`,
      idempotencyKeyTTL: "10m",
    });
    return { ok: true, runId: handle.id };
  } catch (e) {
    return { ok: false, error: `Couldn't start the job: ${(e as Error).message}` };
  }
}

export type RunStatus = {
  status: string;
  done: boolean;
  ok: boolean;
  error?: string;
  output?: { total?: string; sentTo?: string };
};

const FAILED = new Set(["FAILED", "CRASHED", "CANCELED", "SYSTEM_FAILURE", "EXPIRED", "TIMED_OUT"]);

export async function getRunStatus(runId: string): Promise<RunStatus> {
  await requireAuth();
  const run = await runs.retrieve<typeof sendInvoice>(runId);
  const failed = FAILED.has(run.status);
  return {
    status: run.status,
    done: run.status === "COMPLETED" || failed,
    ok: run.status === "COMPLETED",
    error: failed ? (run.error?.message ?? run.status) : undefined,
    output: run.status === "COMPLETED" ? run.output : undefined,
  };
}
