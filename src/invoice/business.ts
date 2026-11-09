// Everything printed on every invoice. This file is the only place to edit it.
// The Vercel preview and the Trigger.dev send both read it, so the PDF you
// preview is the same PDF the client gets.
export const BUSINESS = {
  name: "Rooney Response Co",
  email: "coltonrooney38@gmail.com", // the Gmail invoices are sent from (connected via `npm run connect`)
  addressLines: ["648 Chinn Chapel Rd", "Lewisville, TX 75077"] as string[],
  phone: "", // optional
  logoUrl: "", // optional public https URL to a PNG/JPG
  paymentDetails: "USD",
  paymentTerms: "Payment due within 14 days.",
  currency: "USD",
  defaultTaxRatePct: 0,
  defaultDueDays: 14,
} as const;

export type Business = typeof BUSINESS;
