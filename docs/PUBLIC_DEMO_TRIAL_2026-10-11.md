# Public browser demo trial — October 11, 2026

## Decision

The public site is reachable and its synthetic demonstration is usable on desktop. The deployed checker has reproducible misleading coverage and matching behavior that should be corrected before relying on it in the first design-partner trial. This branch fixes the reproduced cases; it does not deploy the public website or modify the private hosted integration.

All test content was fictional. No pilot request, feedback issue, user record, account, or payment was created. These regression cases are not an independently labeled product benchmark or an accuracy estimate.

## Inspected release and method

- Repository: `om1o/synapse-guard-launch`, base commit `c422ecd5fabb6936ad5513db5c3ee8ccd2e2e146`.
- Public site: https://synapse-guard-v1.synapse-guard.workers.dev/check/
- Announcement: https://github.com/om1o/synapse-guard-launch/issues/1
- Desktop: live Chrome cloud browser, synthetic inputs entered through the UI.
- Public `app.mjs` and `v1-engine.mjs` were fetched separately and matched the base revision byte for byte.
- No existing pull requests were returned for the launch repository when work began. The only open issue returned was the launch announcement.
- Local checks use Node's built-in test runner. Application-event tests use a small DOM adapter; they are not browser layout tests.

## Verified public behavior

| Area | Observation |
| --- | --- |
| Checker | Loads without an account. Draft input, sample button, evidence editor, result panel and footer are usable on desktop. |
| Synthetic sample | Shows a blocked-ticket conflict, a busy-event overlap and a missing-attachment finding. All three evidence categories show complete; the overall result is Review. Complete describes supplied evidence, not a conflict-free message. |
| Missing attachment evidence | Omitting `attachments` shows Incomplete and missing attachment coverage. An explicit empty array produces a missing-attachment finding. |
| Malformed JSON | Shows `Evidence JSON is not valid.`, focuses the error, and removes the visible prior result. |
| Reload | Clears draft, evidence and results in the tested browser. |
| Navigation | Checker, home, privacy and community pages loaded in the browser. The community page clearly separates a public request from hosted access. |
| Pilot URL | Redirects logged-out visitors to GitHub sign-in with `template=pilot.yml` retained in the return destination. |
| Feedback URL | Redirects logged-out visitors to GitHub sign-in with `template=feedback.yml` retained in the return destination. |
| Form definitions | Both templates parse as YAML, have required core fields and a required public-submission privacy checkbox. No contact address is requested. Signed-in form rendering and submission validation were not verified. |
| Mobile | Source contains viewport metadata and responsive breakpoints at 820px/420px for the checker. No mobile viewport/device controls are exposed by this browser interface; physical-phone and mobile-emulation behavior remain unverified. |

## Reproduced defects and changes

| Priority | Synthetic reproduction | Deployed result | Corrected behavior |
| --- | --- | --- | --- |
| P1 | Supply one explicit meeting interval and a fresh complete `calendar_coverage`, omit `calendar_events`. | No conflicts found; calendar complete. | Calendar missing; an envelope cannot substitute for the actual event list. |
| P1 | Draft has two meeting questions, supply an interval only for the first and an explicit empty event list with complete coverage. | No conflicts found; calendar complete. | Calendar ambiguous until every recognized request is normalized. Single-word or multi-request quotes also remain ambiguous. |
| P1 | Supply a fresh envelope and an overlapping event retrieved the previous day. | Calendar complete despite old event evidence. | Calendar stale; missing event retrieval times are missing. Stale free/cancelled statuses also cannot establish availability. |
| P1 | `Please see the attached plan.` with attachment `planet.pdf`. | No conflicts found; attachments complete. | Unresolved-reference finding and ambiguous coverage. Matching requires a nonempty normalized name equality. |
| P2 | `We will not ship ATL-141, but we will ship ATL-142.` with fresh blocked ATL-142 evidence. | No delivery finding; tickets not applicable. | The positive independent clause produces a delivery conflict. Negated-only claims remain excluded and conditional context remains ambiguous. |
| P2 | Synthetic findings expose `example.invalid` as clickable citations. | Intentionally fictional addresses look like ordinary working source links. | Render synthetic-source labels without outbound links. Real HTTPS citations retain `noopener noreferrer`. |
| P2 | Evidence states and machine-style reason codes have little explanation; placeholder suggests all empty lists. | Users can confuse complete coverage with factual correctness or empty lists with unknown evidence. | Add plain-language state explanations, limits beside results, an evidence-guide link and an unknown-vs-empty warning; default placeholder is `{}`. |
| P2 | Pilot chooser calls a public issue a "Private pilot conversation". | Public warning exists inside the form but the chooser label can mislead. | Rename to "Design-partner conversation (public request)". Add optional reproduction steps and synthetic evidence guidance to feedback. |

A clear button removes draft, evidence, result markup and error text from the current page. Editing inputs also clears old report markup, rather than only hiding it. This is a convenience for application state, not a promise to erase browser or device recovery history.

## Privacy and product-limit comparison

The observed behavior and inspected code support the narrow published claim that this checker does not upload draft or evidence content:

- Both deployed JavaScript modules matched the inspected baseline. No fetch, XHR, WebSocket, beacon, cookie, localStorage, sessionStorage, IndexedDB or source-provider write calls appear in them.
- The checker document was served with `connect-src 'none'`, `form-action 'none'`, self-hosted script restrictions, `Referrer-Policy: no-referrer`, and camera/microphone/geolocation restrictions.
- Draft spellcheck is disabled. Reload cleared the tested application's values. The patch also disables evidence autocomplete explicitly.
- Cloudflare still receives ordinary hosting requests. Its response includes network-error-reporting metadata. That is distinct from uploading draft content and is consistent with the hosting-metadata disclosure.
- Following real citation links or submitting GitHub issues leaves the local checker; GitHub issues and the submitting profile identity are public. No private contact data is needed by the pilot template.
- The page's absolute claim that a clean result is "never" shown with incomplete evidence was contradicted by the reproduced bugs. The patch uses narrower language about recognized checks and states that unsupported wording may be missed.

Limitations of this inspection: no browser network HAR or storage inspector was available, and no browser-extension/device behavior was audited. The published statements about private staging retention, D1 backups and deletion were not independently verified in this public-demo task. No privacy certification is implied.

## Validation

- `node --test tests/*.test.mjs`: 38 passing tests, covering engine behavior and application events.
- The initial 30-case engine suite run against the unmodified deployed revision had 14 failures; that same suite passed after the fixes. Two additional conservative-interpretation regressions and six application-event tests were then added and passed.
- `node --check app.mjs`, `node --check v1-engine.mjs` and `git diff --check`: passed.
- Issue-template YAML parsed successfully; IDs are unique and public-submission confirmation remains required.
- No independent accuracy, usability conversion, latency or mobile-performance claim follows from these results.

## Before the first design-partner trial

1. Review and merge this change, then deploy it through the site's established Cloudflare workflow. The launch repository contains no deployment workflow/configuration, so this task did not guess credentials or activate a deployment.
2. Repeat the sample and the four misleading complete/matching cases on the deployed version. Confirm the changed UI and clear action in a real browser.
3. Verify narrow-phone layout and interaction on iPhone Safari and Android Chrome, including the JSON editor, error focus, result text and GitHub transition.
4. With a signed-in GitHub session, open both issue forms, verify required-field validation and preview a synthetic draft without submitting a fake participant. Accountless visitors can use the checker but cannot submit these GitHub forms.
5. Arrange actual participation and any private onboarding separately. Requests do not grant hosted access; paid features, billing and validated-accuracy claims remain outside this launch.

The checker remains a limited deterministic review aid. Attachment matching is intentionally conservative and can request clarification for abbreviated names. Clause splitting is not general language understanding. Changes to the public engine must be reconciled separately with the private integration's engine and evaluation work before claiming parity.
