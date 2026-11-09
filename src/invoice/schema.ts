import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const LineItemSchema = z.object({
  description: z.string().trim().min(1, "Each line needs a description").max(300),
  quantity: z.number().positive("Qty must be more than 0").max(1_000_000),
  rate: z.number().min(0, "Rate can't be negative").max(100_000_000),
});

export const InvoiceInputSchema = z
  .object({
    clientName: z.string().trim().min(1, "Client name is required").max(200),
    clientEmail: z.string().trim().email("Enter a valid client email"),
    clientAddress: z.string().trim().max(500).default(""),
    // Used in the PDF filename, the email subject and the idempotency key.
    invoiceNumber: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{1,40}$/, "Invoice # can only use letters, numbers, - and _"),
    issueDate: isoDate,
    dueDate: isoDate,
    items: z.array(LineItemSchema).min(1, "Add at least one line item").max(50),
    // Optional one-off fee charged on top of the line items (USD).
    upfrontFee: z.number().min(0, "Upfront fee can't be negative").max(100_000_000).default(0),
    taxRatePct: z.number().min(0).max(100).default(0),
    notes: z.string().trim().max(2000).default(""),
  })
  .refine((v) => v.dueDate >= v.issueDate, {
    message: "Due date can't be before the issue date",
    path: ["dueDate"],
  });

export type LineItem = z.infer<typeof LineItemSchema>;
export type InvoiceInput = z.infer<typeof InvoiceInputSchema>;
