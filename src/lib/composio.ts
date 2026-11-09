import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Composio } from "@composio/core";

// Composio holds the Gmail OAuth connection (Composio-managed app). We only
// ever need the API key + the user id the connection was saved under.

let client: Composio | null = null;

export function composio(): Composio {
  if (!client) {
    const apiKey = process.env.COMPOSIO_API_KEY;
    if (!apiKey) throw new Error("Missing COMPOSIO_API_KEY");
    client = new Composio({ apiKey });
  }
  return client;
}

export function composioUserId(): string {
  const id = process.env.COMPOSIO_USER_ID;
  if (!id) throw new Error("Missing COMPOSIO_USER_ID");
  return id;
}

// Manual tool execution needs a toolkit version. "latest" + skip-check keeps
// working as Composio ships new Gmail tool versions.
const VERSION = { dangerouslySkipVersionCheck: true } as const;

type ExecResult = { successful: boolean; error?: string | null; data?: Record<string, unknown> };

async function run(tool: string, args: Record<string, unknown>): Promise<ExecResult> {
  return (await composio().tools.execute(tool, {
    userId: composioUserId(),
    arguments: args,
    ...VERSION,
  })) as ExecResult;
}

export class GmailError extends Error {
  constructor(
    message: string,
    readonly permanent: boolean,
  ) {
    super(message);
  }
}

// Not-connected / bad-input errors never fix themselves on retry.
const PERMANENT = /no (active )?connected account|connection.*(not found|inactive|expired)|unauthori[sz]ed|invalid_grant|invalid (recipient|email)|forbidden/i;

function fail(where: string, err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err ?? "unknown error");
  throw new GmailError(`${where}: ${msg}`, PERMANENT.test(msg));
}

export async function sendInvoiceEmail(args: {
  to: string;
  subject: string;
  body: string;
  pdf: Buffer;
  fileName: string;
}): Promise<{ messageId: string | null }> {
  // 1. Stage the PDF with Composio so Gmail can attach it.
  const filePath = path.join(tmpdir(), args.fileName);
  await writeFile(filePath, args.pdf);
  let attachment;
  try {
    attachment = await composio().files.upload({
      file: filePath,
      toolSlug: "GMAIL_SEND_EMAIL",
      toolkitSlug: "gmail",
    });
  } catch (e) {
    fail("Uploading the PDF to Composio failed", e);
  }

  // 2. Send from the connected Gmail.
  let res: ExecResult;
  try {
    res = await run("GMAIL_SEND_EMAIL", {
      recipient_email: args.to,
      subject: args.subject,
      body: args.body,
      is_html: false,
      attachment,
    });
  } catch (e) {
    fail("Gmail send failed", e);
  }
  if (!res.successful) fail("Gmail send failed", res.error);

  const d = (res.data ?? {}) as Record<string, any>;
  return { messageId: d.id ?? d.response_data?.id ?? d.messageId ?? null };
}

// Used before a retry re-sends: did the first attempt actually go out?
export async function findSentInvoice(to: string, subject: string): Promise<boolean> {
  const res = await run("GMAIL_FETCH_EMAILS", {
    query: `in:sent to:${to} subject:"${subject.replace(/"/g, "")}" newer_than:1d`,
    max_results: 1,
    include_payload: false,
  });
  if (!res.successful) throw new Error(`Checking Sent mail failed: ${res.error ?? "unknown"}`);
  const d = (res.data ?? {}) as Record<string, any>;
  const messages = d.messages ?? d.response_data?.messages ?? [];
  return Array.isArray(messages) && messages.length > 0;
}

export async function gmailProfileEmail(): Promise<string | null> {
  const res = await run("GMAIL_GET_PROFILE", {});
  const d = (res.data ?? {}) as Record<string, any>;
  return d.emailAddress ?? d.response_data?.emailAddress ?? null;
}
