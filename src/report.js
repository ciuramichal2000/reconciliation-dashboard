// Pure functions for the reconciliation report: no DOM, so they are tested with Node's built-in test runner.
// The report is the JSON that invoice-reconciler produces: { matched, amount_mismatch, unpaid_invoices, unmatched_payments }.

export const STATUSES = ["matched", "amount_mismatch", "unpaid_invoices", "unmatched_payments"];
export const LABELS = {
  matched: "Matched",
  amount_mismatch: "Amount mismatch",
  unpaid_invoices: "Unpaid invoice",
  unmatched_payments: "Unmatched payment",
};

const cents = (x) => Math.round(Number(x) * 100);

/** Flatten the report into one list of rows, one per item, each tagged with its status. */
export function toRows(report) {
  const rows = [];
  for (const m of report.matched ?? []) {
    rows.push({ status: "matched", label: LABELS.matched, reference: m.invoice, amount: null, currency: "", note: `paid by payment #${m.payment_id}` });
  }
  for (const m of report.amount_mismatch ?? []) {
    const d = cents(m.difference) / 100;
    rows.push({ status: "amount_mismatch", label: LABELS.amount_mismatch, reference: m.invoice, amount: d, currency: "", note: `payment #${m.payment_id} is ${d > 0 ? "over" : "under"} the invoice` });
  }
  for (const u of report.unpaid_invoices ?? []) {
    rows.push({ status: "unpaid_invoices", label: LABELS.unpaid_invoices, reference: u.invoice, amount: u.total, currency: u.currency, note: "no payment found" });
  }
  for (const p of report.unmatched_payments ?? []) {
    rows.push({ status: "unmatched_payments", label: LABELS.unmatched_payments, reference: `payment #${p.payment_id}`, amount: p.amount, currency: p.currency, note: p.description || "" });
  }
  return rows;
}

/** Counts per status and the money still open, summed per currency in whole cents (no floating-point drift). */
export function summarize(report) {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, (report[s] ?? []).length]));
  const sumBy = (items, field) => {
    const totals = {};
    for (const it of items) totals[it.currency] = (totals[it.currency] ?? 0) + cents(it[field]);
    return Object.fromEntries(Object.entries(totals).map(([c, v]) => [c, v / 100]));
  };
  return {
    counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    unpaidTotals: sumBy(report.unpaid_invoices ?? [], "total"),
    unmatchedTotals: sumBy(report.unmatched_payments ?? [], "amount"),
  };
}

/** Filter by status ("all" keeps everything) and by a case-insensitive text search over reference and note. */
export function filterRows(rows, { status = "all", text = "" } = {}) {
  const q = text.trim().toLowerCase();
  return rows.filter((r) => (status === "all" || r.status === status) && (!q || `${r.reference} ${r.note}`.toLowerCase().includes(q)));
}

/** "1,230.00" style money; an unknown currency code falls back to plain text instead of throwing. */
export function formatMoney(amount, currency, locale = "en-GB") {
  if (amount === null || amount === undefined) return "";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
  } catch {
    return `${Number(amount).toFixed(2)} ${currency}`.trim();
  }
}

/** Accept only a report with the four lists; anything else is an error the page can show instead of crashing. */
export function validateReport(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("The report must be a JSON object.");
  const bad = STATUSES.filter((s) => data[s] !== undefined && !Array.isArray(data[s]));
  if (bad.length) throw new Error(`These fields must be lists: ${bad.join(", ")}.`);
  if (STATUSES.every((s) => data[s] === undefined)) throw new Error("This does not look like a reconciliation report.");
  return data;
}
