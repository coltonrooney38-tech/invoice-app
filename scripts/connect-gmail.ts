import "dotenv/config";
import { Composio } from "@composio/core";

/**
 * One-time: connect your Gmail to Composio.   npm run connect
 *
 * Prints a Google sign-in link; approve it in your browser and this script
 * waits until the connection is ACTIVE, then shows which address is connected.
 * Safe to re-run: it does nothing if Gmail is already connected.
 */

async function main() {
  const apiKey = process.env.COMPOSIO_API_KEY;
  const userId = process.env.COMPOSIO_USER_ID;
  if (!apiKey) throw new Error("Missing COMPOSIO_API_KEY in .env");
  if (!userId) throw new Error("Missing COMPOSIO_USER_ID in .env");
  const composio = new Composio({ apiKey });

  const existing = await composio.connectedAccounts.list({ userIds: [userId], statuses: ["ACTIVE"] });
  const active = existing.items.find((a) => a.toolkit?.slug?.toLowerCase() === "gmail");

  if (active) {
    console.log(`✓ Gmail is already connected (account ${active.id}).`);
  } else {
    // Reuse the Composio-managed Gmail auth config if one exists, else create it.
    const configs = await composio.authConfigs.list({ toolkit: "gmail", isComposioManaged: true });
    const authConfigId = configs.items[0]?.id ?? (await composio.authConfigs.create("gmail")).id;
    const request = await composio.connectedAccounts.link(userId, authConfigId);
    console.log("\nOpen this link and approve Gmail access:\n");
    console.log(`  ${request.redirectUrl}\n`);
    console.log("Waiting for you to finish (up to 10 minutes)…");
    const account = await request.waitForConnection(600_000);
    console.log(`✓ Gmail connected (account ${account.id}).`);
  }

  const profile = await composio.tools.execute("GMAIL_GET_PROFILE", {
    userId,
    arguments: {},
    dangerouslySkipVersionCheck: true,
  });
  const d = (profile.data ?? {}) as Record<string, any>;
  const email = d.emailAddress ?? d.response_data?.emailAddress;
  console.log(email ? `  Invoices will be sent from: ${email}` : "  (Couldn't read the Gmail address.)");
}

main().catch((err) => {
  console.error("\n✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
