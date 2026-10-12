# PR #2 release-candidate verification — October 12, 2026

## Scope and outcome

The public-demo candidate is prepared for review with merge-conflict resolution, retained engine fixes, interface regressions, and a reproducible Cloudflare deployment procedure. Deployment and post-deployment acceptance are **not complete**. No independent accuracy claim, paid release, private-integration change or completed phone-testing claim is made.

## Current work reconciled

Initial PR head: `8a92bb8310a5329f6e52e11f9366f0e8b3ca7564`, draft, with no review submissions, inline review threads or check runs. GitHub reported `mergeable=false`, `mergeable_state=dirty`. The repository's current default branch had advanced to `30ef46f19a883df68e686e85ab3f71b5f0be85df`, an engine-only release; the PR metadata initially showed an older base SHA.

Main's engine included the original PR fixes plus extra cases for repeated meeting text, comma/em-dash negation boundaries, independent conditional contexts and simultaneous stale/missing evidence reasons. The candidate merges this main commit into the PR branch. `v1-engine.mjs` remains byte-for-byte identical to that main revision. README conflicts are reconciled, and all separate PR interface/privacy/feedback changes are retained.

The original 32 engine tests duplicated cases in main's expanded 40-case suite. They are consolidated into `tests/public-demo-regressions.test.mjs`; all original cases are retained, with main's additional assertions. Six original DOM-adapter application tests remain, and five end-to-end application-event regressions now assert rendered output for the reproduced failures. Two packaging tests check the published file allowlist/hashes and isolated Cloudflare configuration. Five controlled HTTP-fixture tests verify that the release verifier accepts the expected package and rejects an old manifest, changed bytes, permissive connection policy and accidental source-file exposure; these are not Cloudflare runtime tests.

## Evidence and validation

| Check | Result |
| --- | --- |
| Original PR regression command | 38/38 passed before changes. |
| Reconciled main engine + original PR application tests | 46/46 passed. |
| Candidate engine/application/package suite | 58/58 passed: 40 engine, 11 application-event, two packaging and five HTTP-verifier cases. |
| JavaScript syntax and whitespace | Passed. |
| Reproducible package | 17 allowlisted source files plus `release.json`; no private service bindings, application backend or credentials. |
| Pinned Wrangler deployment dry run | Passed with Wrangler 4.149.0; no upload/deployment performed. |
| Local Wrangler HTTP emulation | Unavailable: `uv_interface_addresses` system error before server startup. |
| Direct production HTTP verifier | Not completed; direct requests from the task runtime returned HTTP 403. Browser navigation itself works. No production asset-hash match claimed. |
| Physical phones / mobile emulation | Not performed. |
| Signed-in GitHub form rendering and validation | Not performed. The changed templates still require default-branch publication and a signed-in session. |

Tests are synthetic regression evidence, not a held-out benchmark or an accuracy estimate. DOM-adapter tests exercise application behavior without a real browser layout engine.

## Live public-browser observations

A desktop cloud Chrome session opened the public checker. The sample rendered three findings, but the site still showed the old blanket coverage promise, clickable `example.invalid` sources and no Clear control.

At approximately 15:44 UTC, the live browser still reproduced:

1. A fresh complete calendar envelope and an explicit proposal with **no `calendar_events` field** produced **No conflicts found / calendar COMPLETE**.
2. `Please see the attached plan.` with `planet.pdf` produced **No conflicts found / attachments COMPLETE**.

These are current production observations, not candidate or post-deployment verification. No real user content was used and no issue/pilot submission was created. No claim is made that the current public engine bytes match a particular commit.

## Exact deployment dependency

No Cloudflare credential environment variables or local Wrangler login configuration were present. Plugin discovery returned no Cloudflare connection. The Cloudflare dashboard ultimately opened `/login`; there is no authenticated deployment session available in this task.

To deploy, an authorized operator must provide a secure execution environment with the owning Cloudflare account ID and an account-scoped Workers deployment token, or establish an authorized Cloudflare dashboard session. Do not send credentials in chat. Confirm the existing target is the public static Worker `synapse-guard-v1` in `synapse-guard.workers.dev`, record its current deployment, then follow [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md).

The PR remains a reviewable candidate; no default-branch merge or production deployment is implied by passing local tests. Remaining release evidence: hosted CI result, review disposition, deployment/version and asset verification, desktop acceptance, physical-phone checks, and signed-in form validation. No repository rulesets or main-branch protection were reported during inspection; absence of required gates is not proof of readiness.
