// DOM glue only: loads the report, renders the cards and the table, wires the filters. All logic lives in report.js.
import { LABELS, STATUSES, filterRows, formatMoney, summarize, toRows, validateReport } from "./report.js";

const $ = (id) => document.getElementById(id);
let rows = [];

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;                       // textContent, never innerHTML: report data cannot inject markup
  if (className) node.className = className;
  return node;
}

function renderSummary(summary) {
  const box = $("summary");
  box.replaceChildren();
  for (const s of STATUSES) {
    const card = el("div", undefined, `card ${s}`);
    card.append(el("div", String(summary.counts[s]), "count"), el("div", LABELS[s], "label"));
    box.append(card);
  }
  const open = Object.entries(summary.unpaidTotals).map(([c, v]) => formatMoney(v, c)).join(", ") || "nothing";
  $("open-money").textContent = `Open invoices: ${open}`;
}

function renderTable() {
  const filtered = filterRows(rows, { status: $("status").value, text: $("search").value });
  const body = $("rows");
  body.replaceChildren();
  for (const r of filtered) {
    const tr = el("tr");
    const badge = el("td");
    badge.append(el("span", r.label, `badge ${r.status}`));
    tr.append(badge, el("td", r.reference), el("td", r.amount === null ? "" : formatMoney(r.amount, r.currency), "num"), el("td", r.note));
    body.append(tr);
  }
  $("empty").hidden = filtered.length > 0;
  $("count-shown").textContent = `${filtered.length} of ${rows.length} shown`;
}

async function load() {
  const src = new URLSearchParams(location.search).get("src") || "data/sample_report.json";
  try {
    const response = await fetch(src);
    if (!response.ok) throw new Error(`Could not load ${src} (HTTP ${response.status}).`);
    const report = validateReport(await response.json());
    rows = toRows(report);
    renderSummary(summarize(report));
    renderTable();
  } catch (e) {
    $("error").textContent = e.message;
    $("error").hidden = false;
  }
}

$("status").addEventListener("change", renderTable);
$("search").addEventListener("input", renderTable);
load();
