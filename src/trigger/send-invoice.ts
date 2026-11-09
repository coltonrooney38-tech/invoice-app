import { AbortTaskRunError, logger, schemaTask, tags } from "@trigger.dev/sdk";
import { BUSINESS } from "../invoice/business";
import { pdfFileName, renderInvoicePdf } from "../invoice/InvoicePdf";
import { InvoiceInputSchema } from "../invoice/schema";
import { computeTotals, formatDate, formatMoney } from "../invoice/totals";
import { findSentInvoice, GmailError, sendInvoiceEmail } from "../lib/composio";

export const sendInvoice = schemaTask({
  id: "send-invoice",
  schema: InvoiceInputSchema,
  maxDuration: 120,
  run: async (invoice, { ctx }) => {
    await tags.add([`invoice:${invoice.invoiceNumber}`, `client:${invoice.clientEmail}`]);

    const totals = computeTotals(invoice.items, invoice.taxRatePct, invoice.upfrontFee);
    const amountDue = formatMoney(totals.totalCents, BUSINESS.currency);
    const subject = `Invoice ${invoice.invoiceNumber} from ${BUSINESS.name}`;
    const result = { invoiceNumber: invoice.invoiceNumber, sentTo: invoice.clientEmail, total: amountDue };

    // Retry after an unclear failure (e.g. Gmail accepted it but the response
    // timed out)? Check Sent first so the client is never emailed twice.
    if (ctx.attempt.number > 1 && (await findSentInvoice(invoice.clientEmail, subject))) {
      logger.info("Already in Sent mail; not sending again", { subject });
      return { ...result, alreadySent: true };
    }

    // 1. Build the PDF
    const pdf = await renderInvoicePdf(invoice);
    logger.info("PDF rendered", { bytes: pdf.length, amountDue });

    // 2. Email it from your Gmail via Composio
    // Always a short personal note; the form's Notes (if any) are added too.
    const body = [
      `Hi ${invoice.clientName},`,
      "",
      "I hope you're doing well! I really appreciate you working with us, and it's been a pleasure helping your business.",
      "",
      `Attached is invoice ${invoice.invoiceNumber} for ${amountDue} (${BUSINESS.paymentDetails}), due ${formatDate(invoice.dueDate)}.`,
      ...(invoice.notes ? ["", invoice.notes] : []),
      "",
      "If you have any questions about it at all, just reply to this email and I'll get right back to you.",
      "",
      "Thanks again,",
      BUSINESS.name,
    ].join("\n");

    try {
      const { messageId } = await sendInvoiceEmail({
        to: invoice.clientEmail,
        subject,
        body,
        pdf,
        fileName: pdfFileName(invoice),
      });
      logger.info("Invoice emailed", { to: invoice.clientEmail, messageId });
      return { ...result, alreadySent: false, messageId };
    } catch (e) {
      if (e instanceof GmailError && e.permanent) {
        throw new AbortTaskRunError(`${e.message}. If Gmail isn't connected, run "npm run connect".`);
      }
      throw e;
    }
  },
});
