import { BUSINESS } from "./business";
import { pdfFileName, renderInvoicePdf } from "./InvoicePdf";
import type { InvoiceInput } from "./schema";
import { computeTotals, formatDate, formatMoney } from "./totals";
import { sendInvoiceEmail } from "../lib/composio";

export function invoiceSubject(invoice: InvoiceInput) {
  return `Invoice ${invoice.invoiceNumber} from ${BUSINESS.name}`;
}

// Builds the PDF and emails it from the connected Gmail via Composio.
// Used directly by the website and by the (optional) Trigger.dev task.
export async function deliverInvoice(invoice: InvoiceInput) {
  const totals = computeTotals(invoice.items, invoice.taxRatePct, invoice.upfrontFee);
  const amountDue = formatMoney(totals.totalCents, BUSINESS.currency);

  const pdf = await renderInvoicePdf(invoice);

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

  const { messageId } = await sendInvoiceEmail({
    to: invoice.clientEmail,
    subject: invoiceSubject(invoice),
    body,
    pdf,
    fileName: pdfFileName(invoice),
  });

  return { invoiceNumber: invoice.invoiceNumber, sentTo: invoice.clientEmail, total: amountDue, messageId };
}
