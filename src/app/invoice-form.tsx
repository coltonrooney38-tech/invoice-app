"use client";

import { useEffect, useRef, useState } from "react";
import { BUSINESS } from "@/invoice/business";
import type { InvoiceInput } from "@/invoice/schema";
import { computeTotals, formatMoney } from "@/invoice/totals";
import { getRunStatus, submitInvoice } from "./actions";

type Item = { description: string; quantity: string; rate: string };
type Preview = { url: string; payload: InvoiceInput };
type Phase =
  | { kind: "idle" }
  | { kind: "previewing" }
  | { kind: "sending"; label: string }
  | { kind: "sent"; message: string }
  | { kind: "error"; message: string };

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return ymd(new Date(y, m - 1, d + days));
};
const newInvoiceNumber = () => {
  const d = new Date();
  return `INV-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
};
const blankItem = (): Item => ({ description: "", quantity: "1", rate: "" });
const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
const money = (c: number) => formatMoney(c, BUSINESS.currency);

export function InvoiceForm() {
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [taxRatePct, setTaxRatePct] = useState(String(BUSINESS.defaultTaxRatePct));
  const [upfrontFee, setUpfrontFee] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([blankItem()]);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [preview, setPreview] = useState<Preview | null>(null);
  const polling = useRef(false);

  // Dates and the invoice # depend on your local clock, so set them after mount.
  function resetDefaults() {
    const today = ymd(new Date());
    setInvoiceNumber(newInvoiceNumber());
    setIssueDate(today);
    setDueDate(addDays(today, BUSINESS.defaultDueDays));
  }
  useEffect(resetDefaults, []);

  // Free the blob URL whenever the preview closes or changes.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const parsedItems = items.map((i) => ({
    description: i.description,
    quantity: num(i.quantity) || 0,
    rate: num(i.rate) || 0,
  }));
  const totals = computeTotals(parsedItems, num(taxRatePct) || 0, num(upfrontFee) || 0);

  const updateItem = (idx: number, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  function buildPayload(): InvoiceInput {
    return {
      clientName,
      clientEmail,
      clientAddress,
      invoiceNumber,
      issueDate,
      dueDate,
      taxRatePct: num(taxRatePct) || 0,
      upfrontFee: num(upfrontFee) || 0,
      notes,
      items: items
        .filter((i) => i.description.trim() || i.rate.trim())
        .map((i) => ({ description: i.description, quantity: num(i.quantity), rate: num(i.rate) })),
    };
  }

  async function onPreview(e: React.FormEvent) {
    e.preventDefault();
    if (phase.kind === "previewing" || phase.kind === "sending") return;
    setPhase({ kind: "previewing" });
    const payload = buildPayload();
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok || !res.headers.get("content-type")?.includes("application/pdf")) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? `Preview failed (${res.status})`);
      }
      const url = URL.createObjectURL(await res.blob());
      setPreview({ url, payload });
      setPhase({ kind: "idle" });
    } catch (err) {
      setPhase({ kind: "error", message: (err as Error).message });
    }
  }

  async function onSend() {
    if (!preview || phase.kind === "sending") return;
    const payload = preview.payload; // exactly what was previewed
    setPhase({ kind: "sending", label: "Starting…" });

    const res = await submitInvoice(payload).catch((err: Error) => ({ ok: false as const, error: err.message }));
    if (!res.ok) {
      setPhase({ kind: "error", message: res.error });
      return;
    }

    setPhase({ kind: "sending", label: "Building the PDF and emailing it…" });
    polling.current = true;
    const started = Date.now();
    while (polling.current && Date.now() - started < 3 * 60_000) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const s = await getRunStatus(res.runId);
        if (s.done) {
          polling.current = false;
          setPreview(null);
          setPhase(
            s.ok
              ? { kind: "sent", message: `Sent the ${s.output?.total ?? ""} invoice to ${s.output?.sentTo ?? payload.clientEmail}.` }
              : { kind: "error", message: s.error ?? "The job failed." },
          );
          return;
        }
        setPhase({
          kind: "sending",
          label: s.status === "EXECUTING" ? "Building the PDF and emailing it…" : "Queued…",
        });
      } catch {
        /* transient; keep polling */
      }
    }
    polling.current = false;
    setPreview(null);
    setPhase({ kind: "error", message: `Still running. Check run ${res.runId} in the Trigger.dev dashboard.` });
  }

  function startNew() {
    setClientName("");
    setClientEmail("");
    setClientAddress("");
    setNotes("");
    setUpfrontFee("");
    setItems([blankItem()]);
    setTaxRatePct(String(BUSINESS.defaultTaxRatePct));
    resetDefaults();
    setPhase({ kind: "idle" });
  }

  const busy = phase.kind === "previewing" || phase.kind === "sending";

  return (
    <>
      <form onSubmit={onPreview} className="space-y-5">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">New invoice</h1>
          <p className="text-sm text-[var(--muted)]">From {BUSINESS.name} · sent from your Gmail</p>
        </header>

        <section className="card space-y-4">
          <h2 className="section-title">Client</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field">
              <span>Name</span>
              <input value={clientName} onChange={(e) => setClientName(e.target.value)} required />
            </label>
            <label className="field">
              <span>Email</span>
              <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} required />
            </label>
          </div>
          <label className="field">
            <span>Address <em>(optional)</em></span>
            <textarea rows={2} value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} />
          </label>
        </section>

        <section className="card space-y-4">
          <h2 className="section-title">Details</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="field">
              <span>Invoice #</span>
              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                required
                pattern="[A-Za-z0-9_\-]{1,40}"
                title="Letters, numbers, - and _ only"
              />
            </label>
            <label className="field">
              <span>Issue date</span>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => {
                  setIssueDate(e.target.value);
                  if (e.target.value) setDueDate(addDays(e.target.value, BUSINESS.defaultDueDays));
                }}
                required
              />
            </label>
            <label className="field">
              <span>Due date</span>
              <input type="date" value={dueDate} min={issueDate} onChange={(e) => setDueDate(e.target.value)} required />
            </label>
          </div>
        </section>

        <section className="card space-y-3">
          <h2 className="section-title">Line items</h2>
          <div className="hidden grid-cols-[1fr_4.5rem_6rem_6rem_2rem] gap-2 text-xs font-medium text-[var(--muted)] sm:grid">
            <span>Description</span><span>Qty</span><span>Rate</span><span className="text-right">Amount</span><span />
          </div>
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_4.5rem_6rem_2rem] gap-2 sm:grid-cols-[1fr_4.5rem_6rem_6rem_2rem]">
              <input
                aria-label="Description"
                placeholder="e.g. Website redesign"
                value={it.description}
                onChange={(e) => updateItem(i, { description: e.target.value })}
                required={i === 0}
                className="col-span-4 sm:col-span-1"
              />
              <input aria-label="Quantity" inputMode="decimal" value={it.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} />
              <input aria-label="Rate" inputMode="decimal" placeholder="0.00" value={it.rate} onChange={(e) => updateItem(i, { rate: e.target.value })} />
              <span className="self-center text-right tabular-nums">{money(totals.lines[i]?.amountCents ?? 0)}</span>
              <button
                type="button"
                className="btn-icon"
                aria-label="Remove line"
                disabled={items.length === 1}
                onClick={() => setItems((p) => p.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" className="btn-ghost" onClick={() => setItems((p) => [...p, blankItem()])}>
            + Add line
          </button>

          <div className="flex flex-wrap items-end justify-between gap-4 border-t border-[var(--line)] pt-4">
            <div className="flex flex-wrap items-end gap-4">
              <label className="field w-32">
                <span>Upfront fee <em>(optional)</em></span>
                <input inputMode="decimal" placeholder="0.00" value={upfrontFee} onChange={(e) => setUpfrontFee(e.target.value)} />
              </label>
              <label className="field w-24">
                <span>Tax %</span>
                <input inputMode="decimal" value={taxRatePct} onChange={(e) => setTaxRatePct(e.target.value)} />
              </label>
            </div>
            <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-sm tabular-nums">
              <dt className="text-[var(--muted)]">Subtotal</dt><dd className="text-right">{money(totals.subtotalCents)}</dd>
              {totals.upfrontFeeCents > 0 ? (
                <><dt className="text-[var(--muted)]">Upfront fee</dt><dd className="text-right">{money(totals.upfrontFeeCents)}</dd></>
              ) : null}
              <dt className="text-[var(--muted)]">Tax</dt><dd className="text-right">{money(totals.taxCents)}</dd>
              <dt className="text-base font-semibold">Total</dt><dd className="text-right text-base font-semibold">{money(totals.totalCents)}</dd>
            </dl>
          </div>
        </section>

        <section className="card">
          <label className="field">
            <span>Notes <em>(optional, printed on the invoice)</em></span>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3 pb-10">
          {phase.kind === "sent" ? (
            <>
              <p className="text-sm text-[var(--ok)]" role="status">✓ {phase.message}</p>
              <button type="button" className="btn-primary" onClick={startNew}>New invoice</button>
            </>
          ) : (
            <>
              {phase.kind === "error" && !preview ? (
                <p className="text-sm text-[var(--danger)]" role="alert">{phase.message}</p>
              ) : null}
              <button type="submit" className="btn-primary" disabled={busy}>
                {phase.kind === "previewing" ? "Building preview…" : `Preview invoice · ${money(totals.totalCents)}`}
              </button>
            </>
          )}
        </div>
      </form>

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Invoice preview">
          <div className="flex h-full max-h-[56rem] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-[var(--surface)] shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">Invoice {preview.payload.invoiceNumber}</p>
                <p className="truncate text-sm text-[var(--muted)]">To {preview.payload.clientEmail}</p>
              </div>
              <a href={preview.url} target="_blank" rel="noopener" className="text-sm underline">
                Open in new tab
              </a>
            </div>
            <iframe src={preview.url} title="Invoice PDF" className="min-h-0 flex-1 bg-white" />
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--line)] px-4 py-3">
              {phase.kind === "sending" ? <p className="mr-auto text-sm text-[var(--muted)]" role="status">{phase.label}</p> : null}
              {phase.kind === "error" ? <p className="mr-auto text-sm text-[var(--danger)]" role="alert">{phase.message}</p> : null}
              <button
                type="button"
                className="btn-ghost"
                disabled={phase.kind === "sending"}
                onClick={() => { setPreview(null); setPhase({ kind: "idle" }); }}
              >
                Edit
              </button>
              <button type="button" className="btn-primary" disabled={phase.kind === "sending"} onClick={onSend}>
                {phase.kind === "sending" ? "Sending…" : `Send to ${preview.payload.clientEmail}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
