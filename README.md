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

## Validation and public-demo trial

Use Node.js 24. Run `npm ci` and `npm test`. Tests use synthetic evidence and require no service credentials. Application-event tests use a DOM adapter; they do not replace live-browser or physical-phone checks. These regressions are not an independent accuracy benchmark.

The engine remains byte-for-byte identical to `main` commit `30ef46f19a883df68e686e85ab3f71b5f0be85df` (version 0.1.1). Its 40-case regression suite includes the original PR engine cases plus eight follow-up cases. PR #2 adds six application-event tests. The duplicate 32-case file was consolidated into the 40-case suite; its coverage was retained.

See the [October 11 trial](docs/PUBLIC_DEMO_TRIAL_2026-10-11.md), [release verification](docs/RELEASE_READINESS_2026-10-12.md), and [Cloudflare deployment procedure](docs/CLOUDFLARE_DEPLOYMENT.md).
