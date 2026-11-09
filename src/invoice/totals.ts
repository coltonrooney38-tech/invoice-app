import type { LineItem } from "./schema";

export type Totals = {
  lines: (LineItem & { amountCents: number })[];
  subtotalCents: number;
  upfrontFeeCents: number;
  taxCents: number;
  totalCents: number;
};

// All money math in integer cents so totals never drift (0.1 + 0.2 problems).
// Tax applies to the line items plus the upfront fee.
export function computeTotals(items: LineItem[], taxRatePct: number, upfrontFee = 0): Totals {
  const lines = items.map((i) => ({ ...i, amountCents: Math.round(i.quantity * i.rate * 100) }));
  const subtotalCents = lines.reduce((sum, l) => sum + l.amountCents, 0);
  const upfrontFeeCents = Math.round(upfrontFee * 100);
  const taxCents = Math.round(((subtotalCents + upfrontFeeCents) * taxRatePct) / 100);
  return { lines, subtotalCents, upfrontFeeCents, taxCents, totalCents: subtotalCents + upfrontFeeCents + taxCents };
}

export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
