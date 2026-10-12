import { checkDraft } from "/v1-engine.mjs";

const draft = document.querySelector("#draft");
const evidence = document.querySelector("#evidence");
const count = document.querySelector("#count");
const check = document.querySelector("#check");
const loadSample = document.querySelector("#load-sample");
const error = document.querySelector("#form-error");
const empty = document.querySelector("#empty-state");
const result = document.querySelector("#result");
const badge = document.querySelector("#result-badge");
const panel = document.querySelector(".result-panel");
const sampleLabel = document.querySelector("#sample-label");
const clear = document.querySelector("#clear");

function invalidateReport() {
  result.hidden = true;
  empty.hidden = false;
  badge.textContent = "Waiting";
  badge.className = "badge neutral";
  result.replaceChildren();
  error.hidden = true;
}
draft.addEventListener("input", () => { count.textContent = String(draft.value.length); invalidateReport(); });
evidence.addEventListener("input", () => { sampleLabel.hidden = true; invalidateReport(); });
clear.addEventListener("click", () => {
  draft.value = "";
  evidence.value = "";
  count.textContent = "0";
  sampleLabel.hidden = true;
  error.textContent = "";
  invalidateReport();
  draft.focus();
});

loadSample.addEventListener("click", () => {
  invalidateReport();
  const now = new Date();
  const start = new Date(now.getTime() + 60 * 60_000);
  const end = new Date(start.getTime() + 30 * 60_000);
  draft.value = "We will ship ATL-142 on Friday. Can we meet for a review? Please see the attached launch brief.";
  evidence.value = JSON.stringify({
    tickets: [{ id: "ATL-142", title: "Atlas release", status: "blocked", blocker: "Synthetic security review", retrieved_at: now.toISOString(), source_url: "https://example.invalid/tickets/ATL-142" }],
    proposed_meetings: [{ quote: "Can we meet for a review?", start: start.toISOString(), end: end.toISOString() }],
    calendar_events: [{ id: "demo-event", title: "Synthetic existing meeting", start: start.toISOString(), end: end.toISOString(), retrieved_at: now.toISOString(), source_url: "https://example.invalid/calendar/demo-event" }],
    calendar_coverage: { start: start.toISOString(), end: end.toISOString(), retrieved_at: now.toISOString(), complete: true, evidence_set_id: "synthetic-demo" },
    attachments: [],
  }, null, 2);
  count.textContent = String(draft.value.length);
  error.hidden = true;
  sampleLabel.hidden = false;
  draft.focus();
});

function escapeHtml(value) {
  const node = document.createElement("span");
  node.textContent = String(value);
  return node.innerHTML;
}

const coverageHelp = {
  complete: "Evidence supplied for the recognized checks; this does not mean the draft is correct.",
  partial: "Some relevant evidence is missing or the supplied read is incomplete.",
  missing: "Required evidence or its retrieval time was not supplied.",
  stale: "Relevant evidence is too old or dated in the future. Refresh it before relying on the result.",
  ambiguous: "A claim, time, or file name needs clarification before it can be fully checked.",
  not_applicable: "No supported claim was recognized for this category. Other wording may be missed.",
};

function sourceMarkup(source) {
  const label = escapeHtml(source.id);
  const url = source.url ? new URL(source.url) : null;
  const synthetic = url && (url.hostname === "example.invalid" || url.hostname.endsWith(".example.invalid"));
  const link = url && !synthetic ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${label} · ${escapeHtml(url.hostname)}</a>` : `${label}${synthetic ? " · synthetic source (not a live link)" : ""}`;
  return `${link}${source.retrieved_at ? ` · retrieved ${escapeHtml(source.retrieved_at)}` : ""}`;
}

function render(report) {
  const statusMap = {
    needs_review: ["Review", "review"],
    insufficient_evidence: ["Incomplete", "incomplete"],
    no_conflicts_found: ["No conflicts found", "clean"],
  };
  const [label, className] = statusMap[report.status];
  badge.textContent = label;
  badge.className = `badge ${className}`;
  const findings = report.findings.length ? report.findings.map((item) => `
    <article class="finding">
      <h3>${escapeHtml(item.title)}</h3>
      <p class="quote">“${escapeHtml(item.quote)}”</p>
      <p>${escapeHtml(item.evidence)}</p>
      <p><strong>Suggested review:</strong> ${escapeHtml(item.suggestion)}</p>
      <ul class="sources">${item.sources.map(source => `<li>${sourceMarkup(source)}</li>`).join("")}</ul>
    </article>`).join("") : '<article class="finding"><h3>No supported conflict detected</h3><p>Read the coverage below before relying on this result.</p></article>';
  const coverage = report.coverage.map((item) => `
    <div class="coverage-row">
      <strong>${escapeHtml(item.family)}</strong>
      <div><span class="state">${escapeHtml(item.status.replaceAll("_", " "))}</span><p>${coverageHelp[item.status]}</p>${item.reasons.length ? `<p>${escapeHtml(item.reasons.map(reason => reason.replaceAll("_", " ").replace(":", ": ")).join(" · "))}</p>` : ""}</div>
    </div>`).join("");
  result.innerHTML = `${findings}<h3>Evidence coverage</h3>${coverage}<p class="help">Possible conflicts only. Human review is required; this result does not certify the draft or grant permission to send.</p>`;
  empty.hidden = true;
  result.hidden = false;
}

check.addEventListener("click", () => {
  error.hidden = true;
  invalidateReport();
  panel.setAttribute("aria-busy", "true");
  try {
    const parsed = evidence.value.trim() ? JSON.parse(evidence.value) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.hasOwn(parsed, "draft")) throw new Error("Evidence JSON must be an object without a draft field. Enter the draft in the message box.");
    render(checkDraft({ ...parsed, draft: draft.value }));
  } catch (caught) {
    error.textContent = caught instanceof SyntaxError ? "Evidence JSON is not valid." : caught.message;
    error.hidden = false;
    error.focus();
  } finally {
    panel.setAttribute("aria-busy", "false");
  }
});
