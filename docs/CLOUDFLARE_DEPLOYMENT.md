# Public browser demo: reproducible Cloudflare release

This procedure deploys only `om1o/synapse-guard-launch` to the existing Worker `synapse-guard-v1` in the account with workers.dev subdomain `synapse-guard`. Expected URL: https://synapse-guard-v1.synapse-guard.workers.dev/check/ . The private hosted integration, its databases, billing and credentials are separate. Do not deploy from that repository or add its bindings here.

## One-time access dependency

An authorized operator needs the account ID and a Cloudflare API token scoped to that account with **Workers Editor** access for the existing worker (legacy **Account / Workers Scripts / Edit/Write** permission), plus read access for the account Workers subdomain used by the preflight. Supply `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` through the operator's secret manager or protected CI environment. Do not paste tokens into chat, source files, shell history, GitHub issues or this document. No Zone permission is needed for this workers.dev-only target. If preflight cannot read the account's Workers subdomain or existing deployments, stop and review token scope; do not skip the check.

Before using this configuration, inspect the existing public Worker's settings in Cloudflare and confirm it serves this static demo only. Record its currently active deployment/version ID and verify it has no unrelated API service, private-integration binding or custom route. The account ID has intentionally not been guessed or committed.

The configured target is fixed. The deploy script verifies both the account's `synapse-guard` subdomain and the existence of `synapse-guard-v1` before uploading. Missing credentials, a different subdomain, a missing worker or a dirty working tree stop deployment. Keep `WRANGLER_SEND_METRICS=false` in the deployment environment if Wrangler telemetry is unwanted.

## Build and inspect the exact candidate

Use Node.js 24 and a clean checkout of the reviewed commit. Replace `<reviewed-commit-sha>` with the full SHA shown on the approved PR; do not deploy a moving branch name without recording the resolved SHA.

```sh
git clone https://github.com/om1o/synapse-guard-launch.git
cd synapse-guard-launch
git checkout <reviewed-commit-sha>
npm ci
npm run deploy:dry-run
```

Wrangler is pinned to 4.149.0 in `package.json` and the lockfile. `npm run check` runs syntax checks, synthetic regressions and the static build. `scripts/build.mjs` copies an explicit 17-file allowlist into `dist/`, never the repository root. `dist/release.json` records the source revision, whether the tree was dirty, and SHA-256 hashes for all public assets. Tests, documentation, Git files, package metadata and credentials are not public assets. `_headers` retains the browser's `connect-src 'none'` restriction. There is no server-side application entry point or private service binding.

The GitHub `Public demo checks` workflow performs the same credential-free checks and preserves a package artifact. It does **not** deploy on a push or PR event. A successful dry run validates packaging/configuration, not account permissions, Cloudflare routing, browser behavior or mobile usability.

For local Cloudflare preview on a supported workstation:

```sh
npm run dev
# In a second terminal:
npm run verify:release -- http://127.0.0.1:8787
```

On October 12, this task's runtime could run Wrangler's dry run but could not start local emulation (`uv_interface_addresses` system error). Local Cloudflare HTTP serving remains unverified in that environment.

## Deploy

After setting the two credentials securely and checking the existing target, from the clean reviewed checkout:

```sh
npm run deploy
```

The wrapper reruns checks, verifies the existing account/worker through the Cloudflare API, prints the previous deployment metadata for rollback, and runs the pinned Wrangler. No credentials are printed by the wrapper. Save the new version ID from Wrangler's output. It then runs the HTTP release verifier. A verifier failure after upload means the new version may already be live: investigate or roll back; do not report a successful release.

The wrapper launches npm and npx through Node and their JavaScript CLI entrypoints, not Windows command shims or a command shell. It uses npm's `npm_execpath` lifecycle metadata, with the standard Windows Node/npm installation as a fallback. Run the documented `npm run deploy` command so lifecycle metadata is available on other platforms. `tests/npm-runner.test.mjs` covers version-only probes, literal paths/arguments, and failure propagation without credentials or deployment; the Windows CI job runs only these launcher checks. See [Node's Windows subprocess guidance](https://nodejs.org/api/child_process.html#spawning-bat-and-cmd-files-on-windows).

From the same candidate checkout, rerun as needed:

```sh
npm run verify:release
```

The verifier checks the manifest and deployed asset bytes, checker security headers, custom 404, and non-public paths. It requests only public static URLs; it sends no draft/evidence data and imports no remotely served code. It cannot substitute for browser testing. Network denial is a failed/unavailable verification, not evidence of deployment success.

## Browser acceptance after deployment

Use synthetic content only. Record the deployed SHA, browser/device/version and observed result. Start with **Load synthetic sample** each time to get fresh retrieval times, then edit the supplied evidence in the open JSON editor.

| Check | Required result |
| --- | --- |
| Synthetic sample | Review, three findings; fictional citations are text labels, not links. |
| Keep only the meeting sentence/proposal/envelope; omit `calendar_events` | Calendar missing; no clean result. |
| Same meeting with explicit `calendar_events: []` and a fresh covering envelope | Calendar complete; no conflict from that supplied evidence. |
| Add `Can we call again later?` but supply only the first interval | Calendar ambiguous; no clean result. |
| Supply an overlapping event with yesterday's `retrieved_at`, but fresh envelope | Calendar stale; no clean result. |
| `Please see the attached plan.` with `attachments: [{"name":"planet.pdf"}]` | Unresolved attachment reference; ambiguous coverage. |
| `We will not ship ATL-141, but we will ship ATL-142.` with fresh blocked ATL-142 evidence | Delivery conflict for ATL-142. |
| Edit either input after a result | Prior result markup removed; badge returns to Waiting. |
| Malformed JSON, then Clear | Error is focused; Clear removes both inputs, error and results. |
| Navigation | Home, checker, evidence guide, privacy and community load. |

Test desktop first, then actual iPhone Safari and Android Chrome. On phones, open the editor/keyboard, enter and edit JSON, check long error/result text, scroll, clear, and follow feedback links. Viewport metadata or a desktop DOM adapter is not completed mobile testing.

After the issue templates are on the default branch, use an authorized signed-in GitHub session to open both template links from the community page. Verify required controls and preview a synthetic draft, without submitting a fake pilot or feedback issue. A signed-out redirect only verifies the destination.

## Rollback

Record the existing version before deployment. If the new public demo fails acceptance, use Cloudflare's existing-Worker rollback from the dashboard or the pinned CLI:

```sh
npx --no-install wrangler rollback <previous-version-id> --config wrangler.json
```

Check the CLI confirmation names `synapse-guard-v1`. Use the actual saved version ID, never a guessed value. Verify the restored version against its own recorded checkout/manifest if available; the pre-manifest release needs manual source/behavior checks. A rollback may restore known old demo defects, so state that limitation. Do not roll back the private integration.

## Official references

- https://developers.cloudflare.com/workers/static-assets/get-started/
- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://developers.cloudflare.com/workers/static-assets/headers/
- https://developers.cloudflare.com/workers/wrangler/system-environment-variables/
- https://developers.cloudflare.com/workers/wrangler/commands/
- https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
- https://developers.cloudflare.com/workers/authorization/workers/
