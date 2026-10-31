import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { checkDraft } from '../v1-engine.mjs';

// Test application events without a browser or network. This is a DOM adapter,
// not a layout, accessibility-tree, or mobile-browser test.
function app() {
  const elements = new Map();
  const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  function element() {
    return {
      value: '', hidden: false, textContent: '', className: '', attributes: {}, html: '', events: {},
      set innerHTML(value) { this.html = value; },
      get innerHTML() { return this.html || escape(this.textContent); },
      addEventListener(name, fn) { this.events[name] = fn; },
      setAttribute(name, value) { this.attributes[name] = value; },
      replaceChildren() { this.html = ''; this.textContent = ''; },
      focus() { this.focused = true; },
    };
  }
  const document = {
    querySelector(selector) { if (!elements.has(selector)) elements.set(selector, element()); return elements.get(selector); },
    createElement: element,
  };
  const source = readFileSync(new URL('../app.mjs', import.meta.url), 'utf8');
  assert.ok(source.startsWith('import { checkDraft } from "/v1-engine.mjs";'));
  // No fetch, storage, navigator, or other network/persistence APIs exist here.
  vm.runInNewContext(source.replace(/^import[^\n]+\n/, ''), { document, checkDraft, URL });
  return {
    get: selector => elements.get(selector),
    click: selector => elements.get(selector).events.click(),
    input(selector, value) { elements.get(selector).value = value; elements.get(selector).events.input(); },
  };
}

test('sample renders three findings and explains coverage without dead synthetic links', () => {
  const ui = app(); ui.click('#load-sample'); ui.click('#check');
  assert.equal(ui.get('#result-badge').textContent, 'Review');
  assert.equal((ui.get('#result').innerHTML.match(/class="finding"/g) || []).length, 3);
  assert.match(ui.get('#result').innerHTML, /this does not mean the draft is correct/);
  assert.match(ui.get('#result').innerHTML, /synthetic source \(not a live link\)/);
  assert.doesNotMatch(ui.get('#result').innerHTML, /href="https:\/\/example\.invalid/);
  assert.equal(ui.get('.result-panel').attributes['aria-busy'], 'false');
});

test('editing a checked draft removes the previous report and badge', () => {
  const ui = app(); ui.click('#load-sample'); ui.click('#check');
  ui.input('#draft', 'A different draft');
  assert.equal(ui.get('#result').hidden, true);
  assert.equal(ui.get('#result').innerHTML, '');
  assert.equal(ui.get('#result-badge').textContent, 'Waiting');
});

test('clear removes draft, evidence, report, error, and sample marker', () => {
  const ui = app(); ui.click('#load-sample'); ui.click('#check'); ui.click('#clear');
  for (const id of ['#draft', '#evidence']) assert.equal(ui.get(id).value, '');
  assert.equal(ui.get('#result').innerHTML, '');
  assert.equal(ui.get('#form-error').textContent, '');
  assert.equal(ui.get('#count').textContent, '0');
  assert.equal(ui.get('#sample-label').hidden, true);
});

test('bad JSON shows an accessible error and no stale report', () => {
  const ui = app(); ui.click('#load-sample'); ui.click('#check');
  ui.input('#evidence', '{bad'); ui.click('#check');
  assert.equal(ui.get('#form-error').textContent, 'Evidence JSON is not valid.');
  assert.equal(ui.get('#form-error').focused, true);
  assert.equal(ui.get('#result').hidden, true);
  ui.input('#evidence', '{}');
  assert.equal(ui.get('#form-error').hidden, true);
});

test('findings escape supplied text and keep real HTTPS citations protected', () => {
  const ui = app();
  ui.input('#draft', 'We will ship ATL-142.');
  ui.input('#evidence', JSON.stringify({ tickets: [{ id: 'ATL-142', title: 'Synthetic', status: 'blocked', blocker: '<img src=x onerror=alert(1)>', retrieved_at: new Date().toISOString(), source_url: 'https://example.com/synthetic' }] }));
  ui.click('#check');
  assert.doesNotMatch(ui.get('#result').innerHTML, /<img/);
  assert.match(ui.get('#result').innerHTML, /&lt;img/);
  assert.match(ui.get('#result').innerHTML, /rel="noopener noreferrer"/);
});

// RFC 6761 section 6.4 reserves invalid. and every name beneath it.
for (const host of ['invalid', 'invalid.', 'jira.invalid', 'EXAMPLE.INVALID.', 'nested.jira.invalid.']) {
  test(`reserved ${host} citations remain labels, not live links`, () => {
    const ui = app();
    ui.input('#draft', 'We will ship ATL-142.');
    ui.input('#evidence', JSON.stringify({ tickets: [{ id: 'ATL-142', title: 'Synthetic release', status: 'blocked', retrieved_at: new Date().toISOString(), source_url: `https://${host}/browse/ATL-142` }] }));
    ui.click('#check');
    assert.equal(ui.get('#form-error').hidden, true);
    assert.equal(ui.get('#result-badge').textContent, 'Review');
    assert.match(ui.get('#result').innerHTML, /ATL-142 · synthetic source \(not a live link\)/);
    assert.doesNotMatch(ui.get('#result').innerHTML, /<a\b/);
  });
}

for (const host of ['notinvalid.com', 'invalid.example.com', 'jira.invalid.com']) {
  test(`non-reserved ${host} citation keeps its protected HTTPS link`, () => {
    const ui = app();
    ui.input('#draft', 'We will ship ATL-142.');
    const url = `https://${host}/browse/ATL-142`;
    ui.input('#evidence', JSON.stringify({ tickets: [{ id: 'ATL-142', title: 'Synthetic release', status: 'blocked', source_url: url }] }));
    ui.click('#check');
    assert.equal(ui.get('#form-error').hidden, true);
    assert.ok(ui.get('#result').innerHTML.includes(`href="${url}" target="_blank" rel="noopener noreferrer"`));
    assert.doesNotMatch(ui.get('#result').innerHTML, /synthetic source/);
  });
}

test('public checker rejects a draft field in Evidence JSON', () => {
  const ui = app(); ui.input('#draft', 'Hello'); ui.input('#evidence', '{"draft":"override"}'); ui.click('#check');
  assert.equal(ui.get('#form-error').hidden, false);
  assert.match(ui.get('#form-error').textContent, /without a draft field/);
  assert.equal(ui.get('#result').hidden, true);
});

for (const scenario of ['missing events', 'second meeting', 'stale event', 'attachment mismatch', 'mixed negation']) {
  test(`release reproduction reaches the rendered UI: ${scenario}`, () => {
    const ui = app(); ui.click('#load-sample');
    const evidence = JSON.parse(ui.get('#evidence').value);
    const quote = evidence.proposed_meetings[0].quote;
    let expected;
    if (scenario === 'attachment mismatch') {
      ui.input('#draft', 'Please see the attached plan.');
      ui.input('#evidence', JSON.stringify({ attachments: [{ name: 'planet.pdf' }] }));
      expected = /Referenced attachment could not be matched/;
    } else if (scenario === 'mixed negation') {
      ui.input('#draft', 'We will not ship ATL-141, but we will ship ATL-142.');
      ui.input('#evidence', JSON.stringify({ tickets: evidence.tickets }));
      expected = /Delivery commitment conflicts with ATL-142/;
    } else {
      ui.input('#draft', quote + (scenario === 'second meeting' ? ' Can we call again later?' : ''));
      if (scenario === 'missing events') {
        delete evidence.calendar_events;
        expected = /calendar events not supplied/;
      } else if (scenario === 'second meeting') {
        evidence.calendar_events = [];
        expected = /meeting claim not fully normalized/;
      } else {
        evidence.calendar_events[0].retrieved_at = new Date(Date.now() - 86400000).toISOString();
        expected = /calendar event evidence is stale or future dated/;
      }
      ui.input('#evidence', JSON.stringify(evidence));
    }
    ui.click('#check');
    assert.equal(ui.get('#form-error').hidden, true);
    assert.equal(ui.get('#result').hidden, false);
    assert.notEqual(ui.get('#result-badge').textContent, 'No conflicts found');
    assert.match(ui.get('#result').innerHTML, expected);
  });
}
