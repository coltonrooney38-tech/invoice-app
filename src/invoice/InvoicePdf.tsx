import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { BUSINESS } from "./business";
import type { InvoiceInput } from "./schema";
import { computeTotals, formatDate, formatMoney } from "./totals";

const INK = "#16181d";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const ACCENT = "#c2410c";

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: "Helvetica", color: INK, lineHeight: 1.4 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 36 },
  headerRight: { alignItems: "flex-end" },
  logo: { width: 120, maxHeight: 60, objectFit: "contain", marginBottom: 8 },
  // Large text needs its own lineHeight: the page's 1.4 is inherited as a
  // fixed 14pt line, which would make big text overlap the next row.
  bizName: { fontSize: 15, lineHeight: 1.3, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  muted: { color: MUTED },
  title: {
    fontSize: 26,
    lineHeight: 1.15,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    textAlign: "right",
    marginBottom: 8,
  },
  metaRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 2 },
  metaLabel: { color: MUTED, width: 70, textAlign: "right", marginRight: 8 },
  metaValue: { width: 110, textAlign: "right" },
  sectionLabel: { fontSize: 8, color: MUTED, letterSpacing: 1, marginBottom: 4 },
  billTo: { marginBottom: 28 },
  bold: { fontFamily: "Helvetica-Bold" },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: INK,
    paddingBottom: 6,
    fontFamily: "Helvetica-Bold",
  },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 8 },
  cDesc: { flex: 1, paddingRight: 8 },
  cQty: { width: 50, textAlign: "right" },
  cRate: { width: 80, textAlign: "right" },
  cAmt: { width: 90, textAlign: "right" },
  totals: { marginTop: 14, marginLeft: "auto", width: 230 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: INK,
    marginTop: 4,
    paddingTop: 6,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  footer: { marginTop: 40 },
  block: { marginBottom: 14 },
});

export function InvoicePdf({ invoice }: { invoice: InvoiceInput }) {
  const b = BUSINESS;
  const t = computeTotals(invoice.items, invoice.taxRatePct, invoice.upfrontFee);
  const money = (c: number) => formatMoney(c, b.currency);

  return (
    <Document title={`Invoice ${invoice.invoiceNumber}`} author={b.name}>
      <Page size="LETTER" style={s.page}>
        <View style={s.header}>
          <View>
            {b.logoUrl ? <Image src={b.logoUrl} style={s.logo} /> : null}
            <Text style={s.bizName}>{b.name}</Text>
            {b.addressLines.map((l) => (
              <Text key={l} style={s.muted}>{l}</Text>
            ))}
            {b.email ? <Text style={s.muted}>{b.email}</Text> : null}
            {b.phone ? <Text style={s.muted}>{b.phone}</Text> : null}
          </View>
          <View style={s.headerRight}>
            <Text style={s.title}>INVOICE</Text>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Invoice #</Text>
              <Text style={s.metaValue}>{invoice.invoiceNumber}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Issued</Text>
              <Text style={s.metaValue}>{formatDate(invoice.issueDate)}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Due</Text>
              <Text style={[s.metaValue, s.bold]}>{formatDate(invoice.dueDate)}</Text>
            </View>
          </View>
        </View>

        <View style={s.billTo}>
          <Text style={s.sectionLabel}>BILL TO</Text>
          <Text style={s.bold}>{invoice.clientName}</Text>
          {invoice.clientAddress
            ? invoice.clientAddress.split("\n").map((l, i) => <Text key={i}>{l}</Text>)
            : null}
          <Text style={s.muted}>{invoice.clientEmail}</Text>
        </View>

        <View style={s.tableHead}>
          <Text style={s.cDesc}>Description</Text>
          <Text style={s.cQty}>Qty</Text>
          <Text style={s.cRate}>Rate</Text>
          <Text style={s.cAmt}>Amount</Text>
        </View>
        {t.lines.map((l, i) => (
          <View key={i} style={s.row} wrap={false}>
            <Text style={s.cDesc}>{l.description}</Text>
            <Text style={s.cQty}>{l.quantity}</Text>
            <Text style={s.cRate}>{money(Math.round(l.rate * 100))}</Text>
            <Text style={s.cAmt}>{money(l.amountCents)}</Text>
          </View>
        ))}

        <View style={s.totals} wrap={false}>
          <View style={s.totalRow}>
            <Text style={s.muted}>Subtotal</Text>
            <Text>{money(t.subtotalCents)}</Text>
          </View>
          {t.upfrontFeeCents > 0 ? (
            <View style={s.totalRow}>
              <Text style={s.muted}>Upfront fee</Text>
              <Text>{money(t.upfrontFeeCents)}</Text>
            </View>
          ) : null}
          {invoice.taxRatePct > 0 ? (
            <View style={s.totalRow}>
              <Text style={s.muted}>Tax ({invoice.taxRatePct}%)</Text>
              <Text>{money(t.taxCents)}</Text>
            </View>
          ) : null}
          <View style={s.grandRow}>
            <Text>Amount due</Text>
            <Text>{money(t.totalCents)}</Text>
          </View>
        </View>

        <View style={s.footer}>
          {invoice.notes ? (
            <View style={s.block}>
              <Text style={s.sectionLabel}>NOTES</Text>
              <Text>{invoice.notes}</Text>
            </View>
          ) : null}
          {b.paymentDetails ? (
            <View style={s.block}>
              <Text style={s.sectionLabel}>PAYMENT</Text>
              <Text>{b.paymentDetails}</Text>
            </View>
          ) : null}
          {b.paymentTerms ? <Text style={s.muted}>{b.paymentTerms}</Text> : null}
        </View>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(invoice: InvoiceInput): Promise<Buffer> {
  return renderToBuffer(<InvoicePdf invoice={invoice} />);
}

export const pdfFileName = (invoice: InvoiceInput) => `Invoice-${invoice.invoiceNumber}.pdf`;
