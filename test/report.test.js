import test from "node:test";
import assert from "node:assert/strict";
import { filterRows, formatMoney, summarize, toRows, validateReport } from "../src/report.js";

const report = {
  matched: [{ invoice: "FV/1", payment_id: 1, difference: 0 }],
  amount_mismatch: [{ invoice: "BO-2", payment_id: 2, difference: -5 }, { invoice: "GC-3", payment_id: 3, difference: 12.5 }],
  unpaid_invoices: [{ invoice: "A-1", total: 59.9, currency: "EUR" }, { invoice: "A-2", total: 40.1, currency: "EUR" }, { invoice: "U-1", total: 10, currency: "USD" }],
  unmatched_payments: [{ payment_id: 9, amount: 300, currency: "EUR", description: "Unknown sender" }],
};

test("toRows creates one row per item with its status and a readable note", () => {
  const rows = toRows(report);
  assert.equal(rows.length, 7);
  assert.deepEqual(rows.map((r) => r.status).slice(0, 3), ["matched", "amount_mismatch", "amount_mismatch"]);
  assert.match(rows[1].note, /under the invoice/);
  assert.match(rows[2].note, /over the invoice/);
  assert.equal(rows[6].reference, "payment #9");
});

test("summarize counts per status and sums open money per currency without floating-point drift", () => {
  const s = summarize(report);
  assert.deepEqual(s.counts, { matched: 1, amount_mismatch: 2, unpaid_invoices: 3, unmatched_payments: 1 });
  assert.equal(s.total, 7);
  assert.deepEqual(s.unpaidTotals, { EUR: 100, USD: 10 });                   // 59.9 + 40.1 is exactly 100
  assert.deepEqual(s.unmatchedTotals, { EUR: 300 });
});

test("summarize copes with missing lists", () => {
  const s = summarize({ matched: [{ invoice: "X", payment_id: 1, difference: 0 }] });
  assert.equal(s.total, 1);
  assert.deepEqual(s.unpaidTotals, {});
});

test("filterRows filters by status and by case-insensitive text over reference and note", () => {
  const rows = toRows(report);
  assert.equal(filterRows(rows, { status: "unpaid_invoices" }).length, 3);
  assert.equal(filterRows(rows, { status: "all" }).length, 7);
  assert.deepEqual(filterRows(rows, { text: "  unknown " }).map((r) => r.reference), ["payment #9"]);
  assert.deepEqual(filterRows(rows, { status: "matched", text: "a-1" }), []);
});

test("formatMoney formats amounts and falls back for an unknown currency code", () => {
  assert.match(formatMoney(1230, "EUR"), /1,230\.00/);
  assert.equal(formatMoney(null, "EUR"), "");
  assert.equal(formatMoney(5, "not-a-currency"), "5.00 not-a-currency");
});

test("validateReport accepts a report and rejects other JSON with a clear message", () => {
  assert.equal(validateReport(report), report);
  assert.throws(() => validateReport([]), /must be a JSON object/);
  assert.throws(() => validateReport({ matched: "x" }), /must be lists: matched/);
  assert.throws(() => validateReport({ hello: 1 }), /does not look like a reconciliation report/);
  assert.throws(() => validateReport(null), /JSON object/);
});
