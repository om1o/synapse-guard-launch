import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDraft, checkBatch } from '../v1-engine.mjs';

const now = '2026-10-11T20:00:00Z';
const start = '2026-10-12T14:00:00Z';
const end = '2026-10-12T14:30:00Z';
const quote = 'Can we meet for a review?';
const proposal = { quote, start, end };
const envelope = { start, end, retrieved_at: now, complete: true };
const event = { id: 'synthetic-event', title: 'Synthetic meeting', start, end, retrieved_at: now };
const ticket = { id: 'ATL-142', title: 'Synthetic release', status: 'blocked', retrieved_at: now };
const inspect = input => checkDraft(input, { now });
const state = (report, family) => report.coverage.find(item => item.family === family).status;
const calendar = extra => inspect({ draft: quote, proposed_meetings: [proposal], calendar_events: [], calendar_coverage: envelope, ...extra });

test('synthetic sample has all three findings and complete evidence, not a clean result', () => {
  const report = inspect({ draft: `We will ship ATL-142 on Friday. ${quote} Please see the attached launch brief.`, tickets: [ticket], proposed_meetings: [proposal], calendar_events: [event], calendar_coverage: envelope, attachments: [] });
  assert.equal(report.status, 'needs_review');
  assert.deepEqual(report.findings.map(item => item.kind), ['delivery_conflict', 'calendar_overlap', 'missing_attachment']);
  assert.ok(report.coverage.every(item => item.status === 'complete'));
});

test('omitted calendar records cannot be replaced by a complete envelope', () => {
  const report = calendar({ calendar_events: undefined });
  assert.equal(state(report, 'calendar'), 'missing');
  assert.equal(report.status, 'insufficient_evidence');
});

test('explicit empty events plus fresh complete envelope can support no overlap', () => {
  assert.equal(calendar({}).status, 'no_conflicts_found');
});

test('empty events without a coverage envelope cannot prove availability', () => {
  assert.equal(state(calendar({ calendar_coverage: undefined }), 'calendar'), 'missing');
});

test('second unnormalized meeting keeps calendar ambiguous', () => {
  const report = calendar({ draft: `${quote} Can we call again later?` });
  assert.equal(state(report, 'calendar'), 'ambiguous');
  assert.equal(report.status, 'insufficient_evidence');
});

test('two requests in one sentence cannot share one supplied interval', () => {
  const report = calendar({ draft: 'Can we meet for a review and can we call again later?', proposed_meetings: [{ ...proposal, quote: 'Can we meet for a review' }] });
  assert.equal(state(report, 'calendar'), 'ambiguous');
});

test('one quote spanning two requests is not proof of two normalized intervals', () => {
  const draft = `${quote} Can we call again later?`;
  assert.equal(state(calendar({ draft, proposed_meetings: [{ ...proposal, quote: draft }] }), 'calendar'), 'ambiguous');
});

test('two independently normalized requests are covered', () => {
  const second = 'Can we call again later?';
  const report = calendar({ draft: `${quote} ${second}`, proposed_meetings: [proposal, { ...proposal, quote: second }] });
  assert.equal(state(report, 'calendar'), 'complete');
});

for (const availability of ['busy', 'free']) {
  test(`stale ${availability} event cannot be refreshed by envelope`, () => {
    const report = calendar({ calendar_events: [{ ...event, availability, retrieved_at: '2026-10-10T20:00:00Z' }] });
    assert.equal(state(report, 'calendar'), 'stale');
    assert.notEqual(report.status, 'no_conflicts_found');
  });
}

test('event without retrieval time remains missing', () => {
  assert.equal(state(calendar({ calendar_events: [{ ...event, retrieved_at: undefined }] }), 'calendar'), 'missing');
});

test('future-dated event remains stale', () => {
  assert.equal(state(calendar({ calendar_events: [{ ...event, retrieved_at: '2026-10-12T20:00:00Z' }] }), 'calendar'), 'stale');
});

test('stale events outside the proposed interval do not block an unrelated check', () => {
  const report = calendar({ calendar_events: [{ ...event, start: '2026-10-13T14:00:00Z', end: '2026-10-13T14:30:00Z', retrieved_at: '2026-10-10T20:00:00Z' }] });
  assert.equal(state(report, 'calendar'), 'complete');
});

test('fresh free and cancelled events do not create busy conflicts', () => {
  for (const extra of [{ availability: 'free' }, { status: 'cancelled' }]) {
    assert.equal(calendar({ calendar_events: [{ ...event, ...extra }] }).status, 'no_conflicts_found');
  }
});

test('narrow and partial envelopes stay partial', () => {
  for (const extra of [{ complete: false }, { end: '2026-10-12T14:15:00Z' }]) {
    assert.equal(state(calendar({ calendar_coverage: { ...envelope, ...extra } }), 'calendar'), 'partial');
  }
});

test('fresh events cannot conceal a stale envelope', () => {
  assert.equal(state(calendar({ calendar_events: [event], calendar_coverage: { ...envelope, retrieved_at: '2026-10-10T20:00:00Z' } }), 'calendar'), 'stale');
});

test('natural meeting interpretation remains ambiguous until confirmed', () => {
  const report = calendar({ draft: 'Can we meet Monday at 14:00 UTC for 30 minutes?', proposed_meetings: undefined, reference_date: '2026-10-11', timezone: 'UTC' });
  assert.equal(state(report, 'calendar'), 'ambiguous');
});

for (const separator of [', but ', '; ', ', yet ', ' and ']) {
  test(`positive delivery survives independent negation (${separator.trim()})`, () => {
    const report = inspect({ draft: `We will not ship ATL-141${separator}we will ship ATL-142.`, tickets: [ticket] });
    assert.equal(report.status, 'needs_review');
    assert.equal(report.findings[0].kind, 'delivery_conflict');
    assert.equal(state(report, 'tickets'), 'complete');
    assert.match(report.findings[0].quote, /we will ship ATL-142/);
  });
}

test('a solely negated delivery is not a positive commitment', () => {
  const report = inspect({ draft: 'We will not ship ATL-142.', tickets: [ticket] });
  assert.equal(state(report, 'tickets'), 'not_applicable');
  assert.equal(report.findings.length, 0);
});

test('unknown status is partial and missing positive ticket is missing', () => {
  assert.equal(state(inspect({ draft: 'We will ship ATL-142.', tickets: [{ ...ticket, status: 'unknown' }] }), 'tickets'), 'partial');
  assert.equal(state(inspect({ draft: 'We will ship ATL-142.' }), 'tickets'), 'missing');
});

test('conditional delivery remains ambiguous', () => {
  assert.equal(state(inspect({ draft: 'If approved we will ship ATL-142.', tickets: [ticket] }), 'tickets'), 'ambiguous');
});

test('plan does not match planet.pdf or an empty normalized filename', () => {
  for (const name of ['planet.pdf', 'file.pdf', 'project-plan.pdf']) {
    const report = inspect({ draft: 'Please see the attached plan.', attachments: [{ name }] });
    assert.equal(state(report, 'attachments'), 'ambiguous');
    assert.equal(report.findings[0].kind, 'unresolved_reference');
  }
});

test('exact normalized attachment name matches while duplicate matches remain ambiguous', () => {
  const input = { draft: 'Please see the attached launch brief.', attachments: [{ name: 'launch-brief.pdf' }] };
  assert.equal(inspect(input).status, 'no_conflicts_found');
  assert.equal(state(inspect({ ...input, attachments: [...input.attachments, { name: 'launch brief.docx' }] }), 'attachments'), 'ambiguous');
});

test('omitted attachment list is unknown; explicit empty list is a missing attachment finding', () => {
  const input = { draft: 'Please see the attached plan.' };
  assert.equal(state(inspect(input), 'attachments'), 'missing');
  assert.equal(inspect({ ...input, attachments: [] }).findings[0].kind, 'missing_attachment');
});

test('unrecognized prose is never clean', () => {
  assert.equal(inspect({ draft: 'Hello there.' }).status, 'insufficient_evidence');
});

test('invalid evidence cannot produce a report', () => {
  for (const input of [
    { draft: '' },
    { draft: 'Hello', tickets: 'bad' },
    { draft: 'Hello', attachments: [{ name: 'plan.pdf', source_url: 'javascript:alert(1)' }] },
    { draft: quote, proposed_meetings: [{ ...proposal, start: '2026-10-12T14:00:00' }] },
    { draft: quote, proposed_meetings: [{ ...proposal, quote: 'Unrelated quote' }] },
  ]) assert.throws(() => inspect(input));
});

test('batch uses the corrected missing-calendar semantics', () => {
  const result = checkBatch({ drafts: [{ id: 'synthetic', draft: quote, proposed_meetings: [proposal] }], calendar_coverage: envelope }, { now });
  assert.equal(state(result.results[0].report, 'calendar'), 'missing');
});

test('splitting delivery clauses preserves a condition governing the sentence', () => {
  const report = inspect({ draft: 'If approved, we will ship ATL-141 and we will ship ATL-142.', tickets: [ticket] });
  assert.equal(state(report, 'tickets'), 'ambiguous');
  assert.equal(report.findings.length, 0);
});

test('a single-word meeting quote cannot stand in for a whole request', () => {
  const report = calendar({ proposed_meetings: [{ ...proposal, quote: 'review' }] });
  assert.equal(state(report, 'calendar'), 'ambiguous');
});
