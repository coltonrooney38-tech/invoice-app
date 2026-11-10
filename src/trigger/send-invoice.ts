import { AbortTaskRunError, logger, schemaTask, tags } from "@trigger.dev/sdk";
import { InvoiceInputSchema } from "../invoice/schema";
import { deliverInvoice, invoiceSubject } from "../invoice/send";
import { findSentInvoice, GmailError } from "../lib/composio";

// Optional background version of the send. The website sends directly
// (src/app/actions.ts); this task is kept for when Trigger.dev deploys work.
export const sendInvoice = schemaTask({
  id: "send-invoice",
  schema: InvoiceInputSchema,
  maxDuration: 120,
  run: async (invoice, { ctx }) => {
    await tags.add([`invoice:${invoice.invoiceNumber}`, `client:${invoice.clientEmail}`]);

    // Retry after an unclear failure? Check Sent first so the client is never emailed twice.
    if (ctx.attempt.number > 1 && (await findSentInvoice(invoice.clientEmail, invoiceSubject(invoice)))) {
      logger.info("Already in Sent mail; not sending again");
      return { invoiceNumber: invoice.invoiceNumber, sentTo: invoice.clientEmail, alreadySent: true };
    }

    try {
      const result = await deliverInvoice(invoice);
      logger.info("Invoice emailed", result);
      return { ...result, alreadySent: false };
    } catch (e) {
      if (e instanceof GmailError && e.permanent) {
        throw new AbortTaskRunError(`${e.message}. If Gmail isn't connected, run "npm run connect".`);
      }
      throw e;
    }
  },
});
