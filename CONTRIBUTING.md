# Contributing — the release ritual

The kit has consumers. A release is finished only when every consumer is pinned to it.

In this order:

1. **Change** — on `master`.
2. **Test** — every kit CI step locally, each exiting 0, and afterwards `git status --porcelain`
   is empty:
   `npm ci` · `npm run typecheck` · `npm run lint` · `npm test` ·
   `node tokens/generate-tokens.mjs --check --brand vuco` · `node tokens/check-tnum.mjs`
3. **Bump** — `npm version --no-git-tag-version <x.y.z>` (semver; keeps `package-lock.json` in
   step).
4. **CHANGELOG** — a `## x.y.z — YYYY-MM-DD` entry saying what a consumer has to know.
5. **Tag** — commit, then `git tag vX.Y.Z` on that commit.
6. **Push** — the founder pushes `master` and the tag. Nobody else pushes.
7. **Consumer bump, the same day** — in vuco first, then every other consumer: set
   `"@vuco/kit": "github:killerbeanjeka/vuco-kit#vX.Y.Z"`, `npm install`, refresh the copied
   outputs (vuco: `npm run sync-kit` in `apps/mobile`), commit. vuco's `kit-pin` check is red
   until this is done.

## Rules

- Tags are immutable. A bug in `v0.1.0` is fixed in `v0.1.1`; never move or delete a tag.
- No `npm publish`. No `prepare`, `postinstall` or other install scripts: npm fetches the public
  tag tarball anonymously and runs nothing.
- Nothing app-specific, secret or customer-derived goes in — no `.env` files, keys or store
  credentials, no real names or customer data in fixtures. `secret-scan` runs on every push.
- Token changes: edit `tokens/base.tokens.yaml` or `tokens/brands/<brand>.yaml`, run
  `node tokens/generate-tokens.mjs --brand <brand>`, re-verify the contrast table in the consuming
  app's design spec, and commit sources and outputs together.
