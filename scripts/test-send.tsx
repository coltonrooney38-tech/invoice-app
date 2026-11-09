import "dotenv/config";
import { BUSINESS } from "../src/invoice/business";
import { pdfFileName, renderInvoicePdf } from "../src/invoice/InvoicePdf";
import { InvoiceInputSchema } from "../src/invoice/schema";
import { sendInvoiceEmail } from "../src/lib/composio";

// npm run test-send  →  emails a TEST invoice to your own Gmail (BUSINESS.email)
// through the same PDF + Composio code the Trigger.dev task uses.
const invoice = InvoiceInputSchema.parse({
  clientName: "Test Client",
  clientEmail: BUSINESS.email,
  clientAddress: "123 Test St\nLewisville, TX 75077",
  invoiceNumber: `TEST-${Date.now().toString().slice(-6)}`,
  issueDate: "2026-11-06",
  dueDate: "2026-11-20",
  items: [{ description: "Test line item (ignore)", quantity: 1, rate: 1 }],
  taxRatePct: 0,
  upfrontFee: 0,
  notes: "This is a test invoice from the invoice app.",
});

async function main() {
  const pdf = await renderInvoicePdf(invoice);
  const { messageId } = await sendInvoiceEmail({
    to: invoice.clientEmail,
    subject: `TEST Invoice ${invoice.invoiceNumber} from ${BUSINESS.name}`,
    body: "Test send from the invoice app. The PDF should be attached.",
    pdf,
    fileName: pdfFileName(invoice),
  });
  console.log(`✓ Sent ${invoice.invoiceNumber} to ${invoice.clientEmail} (message ${messageId ?? "?"})`);
}

main().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
