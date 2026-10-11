export const ENGINE_VERSION = "0.1.0";

const MAX = Object.freeze({
  draft: 20_000,
  records: 100,
  meetings: 20,
  batch: 20,
});

const TICKET_STATUSES = new Set(["blocked", "in_progress", "done", "cancelled", "unknown"]);
const COVERAGE_STATES = new Set(["complete", "partial", "missing", "stale", "ambiguous", "not_applicable"]);
const DAY_MS = 86_400_000;

export class InputError extends Error {
  constructor(message, path = "input") {
    super(`${path}: ${message}`);
    this.name = "InputError";
    this.code = "INVALID_INPUT";
    this.path = path;
  }
}

function plainObject(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InputError("must be an object", path);
  }
  return value;
}

function exactKeys(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new InputError(`unknown field ${key}`, path);
  }
}

function stringValue(value, path, min, max) {
  if (typeof value !== "string" || value.length < min || value.length > max) {
    throw new InputError(`must be a string between ${min} and ${max} characters`, path);
  }
  return value;
}

function enumValue(value, allowed, path) {
  if (!allowed.has(value)) throw new InputError(`must be one of ${[...allowed].join(", ")}`, path);
  return value;
}

function validDate(value, path) {
  stringValue(value, path, 10, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new InputError("must be YYYY-MM-DD", path);
  const [, year, month, day] = match.map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new InputError("is not a real calendar date", path);
  }
  return value;
}

export function parseOffsetDateTime(value, path = "timestamp") {
  stringValue(value, path, 1, 40);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) throw new InputError("must be an ISO date-time with an explicit UTC offset", path);
  const [, y, mo, d, h, mi, s = "0", , offset] = match;
  validDate(`${y}-${mo}-${d}`, path);
  if (+h > 23 || +mi > 59 || +s > 59) throw new InputError("contains an invalid time", path);
  if (offset !== "Z") {
    const [oh, om] = offset.slice(1).split(":").map(Number);
    if (oh > 23 || om > 59) throw new InputError("contains an invalid UTC offset", path);
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new InputError("is not a valid date-time", path);
  return milliseconds;
}

function httpsUrl(value, path) {
  stringValue(value, path, 1, 2_000);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new InputError("must be a valid HTTPS URL", path);
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new InputError("must use HTTPS and must not contain credentials", path);
  }
  return value;
}

function validateArray(value, path, max, validateItem) {
  if (!Array.isArray(value) || value.length > max) throw new InputError(`must be an array with at most ${max} items`, path);
  return value.map((item, index) => validateItem(item, `${path}[${index}]`));
}

function validateTicket(value, path) {
  plainObject(value, path);
  exactKeys(value, ["id", "title", "status", "blocker", "due_date", "source_url", "retrieved_at", "updated_at"], path);
  const result = {
    id: stringValue(value.id, `${path}.id`, 1, 100),
    title: stringValue(value.title, `${path}.title`, 1, 500),
    status: enumValue(value.status, TICKET_STATUSES, `${path}.status`),
  };
  if (value.blocker !== undefined) result.blocker = stringValue(value.blocker, `${path}.blocker`, 1, 2_000);
  if (value.due_date !== undefined) result.due_date = validDate(value.due_date, `${path}.due_date`);
  if (value.source_url !== undefined) result.source_url = httpsUrl(value.source_url, `${path}.source_url`);
  if (value.retrieved_at !== undefined) {
    parseOffsetDateTime(value.retrieved_at, `${path}.retrieved_at`);
    result.retrieved_at = value.retrieved_at;
  }
  if (value.updated_at !== undefined) {
    parseOffsetDateTime(value.updated_at, `${path}.updated_at`);
    result.updated_at = value.updated_at;
  }
  return result;
}

function validateEvent(value, path) {
  plainObject(value, path);
  exactKeys(value, ["id", "title", "start", "end", "source_url", "retrieved_at", "status", "availability"], path);
  const start = parseOffsetDateTime(value.start, `${path}.start`);
  const end = parseOffsetDateTime(value.end, `${path}.end`);
  if (end <= start) throw new InputError("end must be after start", path);
  const result = {
    id: stringValue(value.id, `${path}.id`, 1, 100),
    title: stringValue(value.title, `${path}.title`, 1, 500),
    start: value.start,
    end: value.end,
  };
  if (value.source_url !== undefined) result.source_url = httpsUrl(value.source_url, `${path}.source_url`);
  if (value.retrieved_at !== undefined) {
    parseOffsetDateTime(value.retrieved_at, `${path}.retrieved_at`);
    result.retrieved_at = value.retrieved_at;
  }
  if (value.status !== undefined) result.status = enumValue(value.status, new Set(["confirmed", "cancelled"]), `${path}.status`);
  if (value.availability !== undefined) result.availability = enumValue(value.availability, new Set(["busy", "free"]), `${path}.availability`);
  return result;
}

function validateAttachment(value, path) {
  plainObject(value, path);
  exactKeys(value, ["name", "source_url"], path);
  const result = { name: stringValue(value.name, `${path}.name`, 1, 500) };
  if (value.source_url !== undefined) result.source_url = httpsUrl(value.source_url, `${path}.source_url`);
  return result;
}

function validateMeeting(value, path, draft) {
  plainObject(value, path);
  exactKeys(value, ["quote", "start", "end"], path);
  const quote = stringValue(value.quote, `${path}.quote`, 1, 2_000);
  if (!draft.includes(quote)) throw new InputError("quote must occur exactly in the draft", `${path}.quote`);
  const start = parseOffsetDateTime(value.start, `${path}.start`);
  const end = parseOffsetDateTime(value.end, `${path}.end`);
  if (end <= start) throw new InputError("end must be after start", path);
  return { quote, start: value.start, end: value.end };
}

function validateCoverage(value, path) {
  plainObject(value, path);
  exactKeys(value, ["start", "end", "retrieved_at", "complete", "evidence_set_id"], path);
  const start = parseOffsetDateTime(value.start, `${path}.start`);
  const end = parseOffsetDateTime(value.end, `${path}.end`);
  if (end <= start) throw new InputError("end must be after start", path);
  if (typeof value.complete !== "boolean") throw new InputError("must be boolean", `${path}.complete`);
  parseOffsetDateTime(value.retrieved_at, `${path}.retrieved_at`);
  const result = { start: value.start, end: value.end, retrieved_at: value.retrieved_at, complete: value.complete };
  if (value.evidence_set_id !== undefined) result.evidence_set_id = stringValue(value.evidence_set_id, `${path}.evidence_set_id`, 1, 200);
  return result;
}

function assertUnique(records, path) {
  const seen = new Set();
  for (const record of records) {
    const key = record.id.toLowerCase();
    if (seen.has(key)) throw new InputError("IDs must be unique case-insensitively", path);
    seen.add(key);
  }
}

export function validateCheckInput(value) {
  plainObject(value, "input");
  exactKeys(value, ["draft", "tickets", "calendar_events", "attachments", "proposed_meetings", "calendar_coverage", "timezone", "reference_date", "use_synced_sources"], "input");
  const result = { draft: stringValue(value.draft, "input.draft", 1, MAX.draft) };
  if (value.tickets !== undefined) {
    result.tickets = validateArray(value.tickets, "input.tickets", MAX.records, validateTicket);
    assertUnique(result.tickets, "input.tickets");
  }
  if (value.calendar_events !== undefined) {
    result.calendar_events = validateArray(value.calendar_events, "input.calendar_events", MAX.records, validateEvent);
    assertUnique(result.calendar_events, "input.calendar_events");
  }
  if (value.attachments !== undefined) result.attachments = validateArray(value.attachments, "input.attachments", MAX.records, validateAttachment);
  if (value.proposed_meetings !== undefined) {
    result.proposed_meetings = validateArray(value.proposed_meetings, "input.proposed_meetings", MAX.meetings, (item, path) => validateMeeting(item, path, result.draft));
  }
  if (value.calendar_coverage !== undefined) result.calendar_coverage = validateCoverage(value.calendar_coverage, "input.calendar_coverage");
  if (value.timezone !== undefined && value.timezone !== "UTC") throw new InputError("only UTC is currently supported", "input.timezone");
  if (value.timezone !== undefined) result.timezone = value.timezone;
  if (value.reference_date !== undefined) result.reference_date = validDate(value.reference_date, "input.reference_date");
  if (value.use_synced_sources !== undefined && typeof value.use_synced_sources !== "boolean") throw new InputError("must be boolean", "input.use_synced_sources");
  if (value.use_synced_sources !== undefined) result.use_synced_sources = value.use_synced_sources;
  return result;
}

function sentenceList(draft) {
  return draft.split(/(?<=[.!?])\s+|\n+/).map((text) => text.trim()).filter(Boolean);
}

function escaped(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasId(text, id) {
  return new RegExp(`(^|[^A-Za-z0-9_-])${escaped(id)}(?=$|[^A-Za-z0-9_-])`, "i").test(text);
}

function trueDeliveryNegation(text) {
  return /\b(?:will|would|can|could|may|might|should)\s+not\s+(?:ship|deliver|release|complete)\b|\b(?:won't|cannot|can't)\s+(?:ship|deliver|release|complete)\b/i.test(text);
}

function deliveryLanguage(text) {
  return /\b(?:ship|ships|shipping|deliver|delivers|delivery|release|releases|complete|completed|finish|finished)\b/i.test(text);
}

function conditionalDelivery(text) {
  return /\bif\b/i.test(text) && deliveryLanguage(text);
}

function ticketClaims(draft, tickets = []) {
  const claims = [];
  for (const sentence of sentenceList(draft)) {
    if (!deliveryLanguage(sentence) || trueDeliveryNegation(sentence)) continue;
    for (const ticket of tickets) {
      if (!hasId(sentence, ticket.id)) continue;
      claims.push({ id: `ticket:${ticket.id.toLowerCase()}:${claims.length + 1}`, quote: sentence, ticket, ambiguous: conditionalDelivery(sentence) });
    }
  }
  return claims;
}

function anyTicketReferences(draft) {
  return [...draft.matchAll(/\b[A-Z][A-Z0-9]{1,9}-\d+\b/gi)].map((match) => match[0]);
}

function meetingLanguage(draft) {
  return sentenceList(draft).filter((sentence) => /\b(?:meet|meeting|call|review)\b/i.test(sentence) && !/\b(?:not|cancel(?:led)?)\s+(?:meet|meeting|call|review)\b/i.test(sentence));
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function parseNaturalMeetings(input) {
  const candidates = meetingLanguage(input.draft);
  const results = [];
  const reasons = [];
  for (const quote of candidates) {
    if (/\bnext\s+(?:sun|mon|tues|wednes|thurs|fri|satur)day\b/i.test(quote)) {
      reasons.push("next_weekday_is_ambiguous");
      continue;
    }
    const weekdayMatch = new RegExp(`\\b(${WEEKDAYS.join("|")})\\b`, "i").exec(quote);
    const timeMatch = /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\s*(UTC)?\b/i.exec(quote);
    if (!weekdayMatch || !timeMatch || !input.reference_date || input.timezone !== "UTC") {
      reasons.push("explicit_offset_interval_required");
      continue;
    }
    let hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2] || 0);
    const period = timeMatch[3]?.replaceAll(".", "").toLowerCase();
    if (period === "pm" && hour < 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) {
      reasons.push("invalid_natural_time");
      continue;
    }
    let duration = null;
    if (/\bfor\s+(?:an|one)\s+hour\b/i.test(quote)) duration = 60;
    else if (/\bfor\s+half\s+an?\s+hour\b/i.test(quote)) duration = 30;
    else {
      const durationMatch = /\bfor\s+(\d+)\s*(minutes?|mins?|hours?|hrs?)\b/i.exec(quote);
      if (durationMatch) duration = Number(durationMatch[1]) * (/hour|hr/i.test(durationMatch[2]) ? 60 : 1);
    }
    if (!duration) {
      reasons.push("duration_required");
      continue;
    }
    const reference = new Date(`${input.reference_date}T00:00:00Z`);
    const targetDay = WEEKDAYS.indexOf(weekdayMatch[1].toLowerCase());
    const delta = (targetDay - reference.getUTCDay() + 7) % 7;
    const start = reference.getTime() + delta * DAY_MS + hour * 3_600_000 + minute * 60_000;
    results.push({ quote, start: new Date(start).toISOString(), end: new Date(start + duration * 60_000).toISOString(), natural: true });
    reasons.push("natural_language_interval_requires_confirmation");
  }
  return { meetings: results, reasons };
}

function normalizeReference(value) {
  return value.toLowerCase().replace(/\.[a-z0-9]{1,8}$/i, "").replace(/\b(?:the|a|an|file|document|doc)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
}

function attachmentClaims(draft) {
  const claims = [];
  for (const sentence of sentenceList(draft)) {
    if (/\b(?:not|isn't|is not)\s+attached\b/i.test(sentence)) continue;
    const match = /\battached\s+([^,.!?;\n]+)|\battachment\s+(?:named\s+)?([^,.!?;\n]+)/i.exec(sentence);
    if (!match) continue;
    const label = (match[1] || match[2]).replace(/^(?:the|a|an)\s+/i, "").trim();
    if (label) claims.push({ id: `attachment:${claims.length + 1}`, quote: sentence, label });
  }
  return claims;
}

function ageState(timestamp, now, maxAge) {
  if (!timestamp) return "missing";
  const time = Date.parse(timestamp);
  if (time - now > 60_000 || now - time > maxAge) return "stale";
  return "fresh";
}

function sourceRefs(records) {
  return records.map((record) => ({ id: record.id || record.name, ...(record.source_url ? { url: record.source_url } : {}), ...(record.retrieved_at ? { retrieved_at: record.retrieved_at } : {}) }));
}

function stableId(value) {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193);
  }
  return (result >>> 0).toString(36);
}

function coverage(family, status, mode, details = {}) {
  if (!COVERAGE_STATES.has(status)) throw new Error(`Invalid coverage state ${status}`);
  return { family, status, source_mode: mode, matched_claim_ids: [], evidence_set_ids: [], intervals: [], retrieval_status: status, reasons: [], ...details };
}

function finding(kind, title, quote, evidence, records, suggestion, confidence = "medium") {
  return {
    id: `${kind}:${stableId(`${kind}\n${quote}\n${evidence}`)}`,
    kind,
    title,
    quote,
    evidence,
    sources: sourceRefs(records),
    suggestion,
    confidence,
  };
}

function calendarResult(input, now, sourceMode) {
  let proposals = input.proposed_meetings;
  const detected = meetingLanguage(input.draft);
  let interpretationReasons = [];
  let natural = false;
  if (proposals === undefined && detected.length) {
    const parsed = parseNaturalMeetings(input);
    proposals = parsed.meetings;
    interpretationReasons = parsed.reasons;
    natural = proposals.length > 0;
  }
  if (!detected.length && (!proposals || proposals.length === 0)) {
    return { findings: [], coverage: coverage("calendar", "not_applicable", sourceMode) };
  }
  if (input.proposed_meetings !== undefined && input.proposed_meetings.length === 0 && detected.length) {
    return { findings: [], coverage: coverage("calendar", "ambiguous", sourceMode, { reasons: ["explicit_empty_meetings_conflicts_with_detected_meeting_language"] }) };
  }
  if (!proposals || proposals.length === 0) {
    return { findings: [], coverage: coverage("calendar", "ambiguous", sourceMode, { reasons: [...new Set(["meeting_interval_unresolved", ...interpretationReasons])] }) };
  }

  const events = input.calendar_events || [];
  const findings = [];
  for (const proposal of proposals) {
    const pStart = Date.parse(proposal.start);
    const pEnd = Date.parse(proposal.end);
    for (const event of events) {
      if (event.status === "cancelled" || event.availability === "free") continue;
      if (pStart < Date.parse(event.end) && Date.parse(event.start) < pEnd) {
        const freshness = ageState(event.retrieved_at, now, 15 * 60_000);
        findings.push(finding(
          "calendar_overlap",
          "Proposed meeting overlaps a busy event",
          proposal.quote,
          `${event.title} overlaps ${proposal.start} to ${proposal.end}.`,
          [event],
          "Choose another time or confirm the conflict with the attendee.",
          freshness === "fresh" ? "high" : "low",
        ));
      }
    }
  }

  const envelope = input.calendar_coverage;
  let state = events.length ? "partial" : "missing";
  const reasons = [];
  if (!envelope) reasons.push("complete_calendar_coverage_not_supplied");
  else {
    const freshness = ageState(envelope.retrieved_at, now, 15 * 60_000);
    const minStart = Math.min(...proposals.map((item) => Date.parse(item.start)));
    const maxEnd = Math.max(...proposals.map((item) => Date.parse(item.end)));
    const spans = Date.parse(envelope.start) <= minStart && Date.parse(envelope.end) >= maxEnd;
    if (freshness === "stale") {
      state = "stale";
      reasons.push("calendar_coverage_is_stale_or_future_dated");
    } else if (!envelope.complete) {
      state = "partial";
      reasons.push("calendar_coverage_is_partial");
    } else if (!spans) {
      state = "partial";
      reasons.push("calendar_coverage_does_not_span_every_proposal");
    } else {
      state = natural ? "ambiguous" : "complete";
    }
  }
  if (natural && state !== "stale") state = "ambiguous";
  reasons.push(...interpretationReasons);
  return {
    findings,
    coverage: coverage("calendar", state, sourceMode, {
      matched_claim_ids: proposals.map((_, index) => `meeting:${index + 1}`),
      evidence_set_ids: envelope?.evidence_set_id ? [envelope.evidence_set_id] : [],
      intervals: proposals.map(({ start, end }) => ({ start, end })),
      reasons: [...new Set(reasons)],
    }),
  };
}

function ticketResult(input, now, sourceMode) {
  const references = anyTicketReferences(input.draft);
  const tickets = input.tickets || [];
  if (!references.length || !sentenceList(input.draft).some(deliveryLanguage)) {
    return { findings: [], coverage: coverage("tickets", "not_applicable", sourceMode) };
  }
  const positiveReferences = references.filter((reference) => sentenceList(input.draft).some((sentence) => hasId(sentence, reference) && deliveryLanguage(sentence) && !trueDeliveryNegation(sentence)));
  if (positiveReferences.length === 0) {
    return { findings: [], coverage: coverage("tickets", "not_applicable", sourceMode) };
  }
  const claims = ticketClaims(input.draft, tickets);
  const matched = new Set(claims.map((claim) => claim.ticket.id.toLowerCase()));
  const missing = references.filter((id) => !tickets.some((ticket) => ticket.id.toLowerCase() === id.toLowerCase()));
  const ambiguousClaims = claims.filter((claim) => claim.ambiguous);
  const findings = [];
  for (const claim of claims) {
    if (claim.ambiguous) continue;
    const ticket = claim.ticket;
    if (ticket.status === "blocked" || ticket.status === "cancelled" || (ticket.status === "in_progress" && /\b(?:is|are|has been)\s+(?:done|complete|finished)\b/i.test(claim.quote))) {
      const fresh = ageState(ticket.retrieved_at, now, DAY_MS) === "fresh";
      findings.push(finding(
        "delivery_conflict",
        `Delivery commitment conflicts with ${ticket.id} status`,
        claim.quote,
        `${ticket.id} is ${ticket.status}${ticket.blocker ? `: ${ticket.blocker}` : "."}`,
        [ticket],
        `I will confirm the delivery status and timeline for ${ticket.id} before committing.`,
        fresh ? "medium" : "low",
      ));
    }
  }
  let state = "complete";
  const reasons = [];
  if (missing.length) {
    state = tickets.length ? "partial" : "missing";
    reasons.push(`missing_ticket_records:${missing.join(",")}`);
  }
  if (ambiguousClaims.length) {
    state = "ambiguous";
    reasons.push("conditional_delivery_claim_requires_confirmation");
  }
  const relevant = tickets.filter((ticket) => references.some((id) => id.toLowerCase() === ticket.id.toLowerCase()));
  if (relevant.some((ticket) => ageState(ticket.retrieved_at, now, DAY_MS) === "stale")) {
    state = "stale";
    reasons.push("ticket_evidence_is_stale_or_future_dated");
  } else if (relevant.some((ticket) => !ticket.retrieved_at) && state === "complete") {
    state = "missing";
    reasons.push("ticket_retrieval_time_missing");
  }
  if (relevant.some((ticket) => ticket.status === "unknown")) {
    if (state === "complete") state = "partial";
    reasons.push("ticket_status_unknown");
  }
  return {
    findings,
    coverage: coverage("tickets", state, sourceMode, {
      matched_claim_ids: claims.map((claim) => claim.id),
      evidence_set_ids: [...matched],
      reasons,
    }),
  };
}

function attachmentResult(input, sourceMode) {
  const claims = attachmentClaims(input.draft);
  if (!claims.length) return { findings: [], coverage: coverage("attachments", "not_applicable", sourceMode) };
  if (input.attachments === undefined) {
    return { findings: [], coverage: coverage("attachments", "missing", sourceMode, { matched_claim_ids: claims.map((claim) => claim.id), reasons: ["attachment_state_unknown"] }) };
  }
  const findings = [];
  for (const claim of claims) {
    const target = normalizeReference(claim.label);
    const matches = input.attachments.filter((attachment) => {
      const candidate = normalizeReference(attachment.name);
      return candidate === target || candidate.includes(target) || target.includes(candidate);
    });
    if (matches.length === 1) continue;
    const kind = input.attachments.length === 0 ? "missing_attachment" : "unresolved_reference";
    findings.push(finding(
      kind,
      kind === "missing_attachment" ? "Referenced attachment is missing" : "Referenced attachment could not be matched",
      claim.quote,
      input.attachments.length === 0 ? "The caller confirmed that no attachment is present." : `None of the supplied attachment names uniquely matches "${claim.label}".`,
      matches,
      "Attach the intended file or name the supplied attachment exactly.",
      "high",
    ));
  }
  const state = findings.some((item) => item.kind === "unresolved_reference") ? "ambiguous" : "complete";
  return { findings, coverage: coverage("attachments", state, sourceMode, { matched_claim_ids: claims.map((claim) => claim.id), reasons: state === "ambiguous" ? ["attachment_reference_not_uniquely_matched"] : [] }) };
}

export function analyzeRequestedFamilies(input) {
  const validated = validateCheckInput(input);
  return {
    tickets: anyTicketReferences(validated.draft).length > 0 && sentenceList(validated.draft).some(deliveryLanguage),
    calendar: meetingLanguage(validated.draft).length > 0 || (validated.proposed_meetings?.length || 0) > 0,
    attachments: attachmentClaims(validated.draft).length > 0,
  };
}

export function checkDraft(value, options = {}) {
  const input = validateCheckInput(value);
  const now = options.now === undefined ? Date.now() : typeof options.now === "number" ? options.now : Date.parse(options.now);
  if (!Number.isFinite(now)) throw new InputError("now must be a valid date-time", "options.now");
  const modes = options.sourceModes || {};
  const ticket = ticketResult(input, now, modes.tickets || (input.tickets !== undefined ? "direct" : "none"));
  const calendar = calendarResult(input, now, modes.calendar || ((input.calendar_events !== undefined || input.calendar_coverage !== undefined) ? "direct" : "none"));
  const attachments = attachmentResult(input, modes.attachments || (input.attachments !== undefined ? "direct" : "none"));
  const coverageItems = [ticket.coverage, calendar.coverage, attachments.coverage];
  const findings = [...ticket.findings, ...calendar.findings, ...attachments.findings];
  const incomplete = coverageItems.some((item) => !["complete", "not_applicable"].includes(item.status));
  const applicable = coverageItems.some((item) => item.status !== "not_applicable");
  const status = findings.length ? "needs_review" : incomplete || !applicable ? "insufficient_evidence" : "no_conflicts_found";
  return {
    engine_version: ENGINE_VERSION,
    status,
    findings,
    coverage: coverageItems,
    checked_at: new Date(now).toISOString(),
    limitations: [
      "Findings are possible conflicts for human review, not proof that a draft is true or safe to send.",
      "Synapse Guard does not send messages or modify source systems.",
    ],
  };
}

export function validateBatchInput(value) {
  plainObject(value, "input");
  exactKeys(value, ["drafts", "tickets", "calendar_events", "attachments", "calendar_coverage"], "input");
  if (!Array.isArray(value.drafts) || value.drafts.length < 1 || value.drafts.length > MAX.batch) throw new InputError("must contain 1 to 20 drafts", "input.drafts");
  const ids = new Set();
  const drafts = value.drafts.map((item, index) => {
    const path = `input.drafts[${index}]`;
    plainObject(item, path);
    exactKeys(item, ["id", "draft", "proposed_meetings", "attachments"], path);
    const id = stringValue(item.id, `${path}.id`, 1, 200);
    if (ids.has(id)) throw new InputError("draft IDs must be unique", `${path}.id`);
    ids.add(id);
    const draft = stringValue(item.draft, `${path}.draft`, 1, MAX.draft);
    const result = { id, draft };
    if (item.proposed_meetings !== undefined) result.proposed_meetings = validateArray(item.proposed_meetings, `${path}.proposed_meetings`, MAX.meetings, (meeting, meetingPath) => validateMeeting(meeting, meetingPath, draft));
    if (item.attachments !== undefined) result.attachments = validateArray(item.attachments, `${path}.attachments`, MAX.records, validateAttachment);
    return result;
  });
  const shared = validateCheckInput({
    draft: "placeholder",
    ...(value.tickets !== undefined ? { tickets: value.tickets } : {}),
    ...(value.calendar_events !== undefined ? { calendar_events: value.calendar_events } : {}),
    ...(value.attachments !== undefined ? { attachments: value.attachments } : {}),
    ...(value.calendar_coverage !== undefined ? { calendar_coverage: value.calendar_coverage } : {}),
  });
  delete shared.draft;
  return { drafts, ...shared };
}

export function checkBatch(value, options = {}) {
  const input = validateBatchInput(value);
  return {
    engine_version: ENGINE_VERSION,
    results: input.drafts.map((item) => ({
      id: item.id,
      report: checkDraft({
        draft: item.draft,
        ...(item.proposed_meetings !== undefined ? { proposed_meetings: item.proposed_meetings } : {}),
        ...(item.attachments !== undefined ? { attachments: item.attachments } : input.attachments !== undefined ? { attachments: input.attachments } : {}),
        ...(input.tickets !== undefined ? { tickets: input.tickets } : {}),
        ...(input.calendar_events !== undefined ? { calendar_events: input.calendar_events } : {}),
        ...(input.calendar_coverage !== undefined ? { calendar_coverage: input.calendar_coverage } : {}),
      }, options),
    })),
  };
}
