# Synapse Guard

Try the [free browser demo](https://synapse-guard-v1.synapse-guard.workers.dev/check/) or read the [launch note](https://synapse-guard-v1.synapse-guard.workers.dev/launch/).

Synapse Guard compares a draft with the ticket, calendar, and attachment evidence you deliberately supply. It shows supported possible conflicts, source citations, and incomplete evidence coverage before you send. The public demo runs locally in browser memory and requires no account.

It does not retrieve workspace records automatically, send messages, change source systems, inspect attachment contents, or certify a draft as true. The hosted integration is still in private staging. There is no paid offer or accuracy claim.

## Join the conversation

- [Request a design-partner conversation](https://github.com/om1o/synapse-guard-launch/issues/new?template=pilot.yml).
- [Report a confusing demo result](https://github.com/om1o/synapse-guard-launch/issues/new?template=feedback.yml).
- [Read privacy and product limits](https://synapse-guard-v1.synapse-guard.workers.dev/privacy/).

Issues are public. Use synthetic or redacted examples. Never include private drafts, ticket descriptions, calendar titles, personal contact information, or credentials. A request does not grant hosted access; private-beta onboarding follows the release checks.

This repository contains the public website and browser demo, including its shared deterministic checker. It contains no hosted service credentials or saved workspace records.

## Run locally

Serve this directory with any local static HTTP server. Open the server's URL, then choose **Try the demo**. Use HTTP rather than opening the HTML files directly because JavaScript modules require it.

## License

MIT. See [LICENSE](LICENSE).

## Engine validation

The shared checker is version 0.1.1. Run `node --test tests/*.test.mjs` on Node.js 24 or later. Forty synthetic regressions cover calendar presence, freshness, per-request normalization, independent delivery clauses, conditional ambiguity, and exact normalized attachment names. They are not a held-out accuracy benchmark or proof of commercial readiness.

The initial fixes and 32 cases came from this project's MIT-licensed draft PR #2, commit `8a92bb8310a5329f6e52e11f9366f0e8b3ca7564`. Eight further cases were added during independent review. The canonical engine was then exported here unchanged. The draft PR's separate UI changes have not been merged by this engine-only update.
