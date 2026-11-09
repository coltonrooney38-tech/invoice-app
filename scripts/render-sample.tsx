import { writeFile } from "node:fs/promises";
import { renderInvoicePdf } from "../src/invoice/InvoicePdf";
import { InvoiceInputSchema } from "../src/invoice/schema";

// npm run sample  →  sample-invoice.pdf (check the layout without sending anything)
const invoice = InvoiceInputSchema.parse({
  clientName: "Acme Plumbing",
  clientEmail: "owner@acmeplumbing.com",
  clientAddress: "42 Water St\nSpringfield, IL 62701",
  invoiceNumber: "INV-SAMPLE-001",
  issueDate: "2026-11-05",
  dueDate: "2026-11-19",
  items: [
    { description: "AI voice agent setup", quantity: 1, rate: 1500 },
    { description: "Monthly automation retainer", quantity: 1, rate: 497 },
    { description: "Extra workflow build (hours)", quantity: 3.5, rate: 85 },
  ],
  taxRatePct: 0,
  upfrontFee: 250,
  notes: "Thanks for choosing us. Reach out with any questions.",
});

renderInvoicePdf(invoice).then(async (pdf) => {
  await writeFile("sample-invoice.pdf", pdf);
  console.log(`Wrote sample-invoice.pdf (${pdf.length} bytes)`);
});
