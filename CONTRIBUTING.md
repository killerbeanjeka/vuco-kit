# Contributing — the release ritual

The kit has consumers. A release is finished only when every consumer is pinned to it.

In this order:

1. **Change** — on `master`; record each change under `## Unreleased` in `CHANGELOG.md`.
2. **Test** — every kit CI step locally, each exiting 0, and afterwards `git status --porcelain`
   is empty:
   `npm ci` · `npm run typecheck` · `npm run lint` · `npm test` ·
   `node tokens/generate-tokens.mjs --check --brand vuco` · `node tokens/check-tnum.mjs` ·
   `node tokens/check-dark-pairing.mjs --src src --allowlist dark-pairing-allowlist.json` ·
   `npm pack --dry-run` (it lists `src`, `config`, `tokens` and `AGENTS.md`, and no test file)
3. **Bump** — `npm version --no-git-tag-version <x.y.z>` (semver; keeps `package-lock.json` in
   step), and rename `## Unreleased` to `## x.y.z — YYYY-MM-DD`.
4. **Commit, push `master`, wait for green** — the founder pushes `master`; wait until `kit-ci` is
   green on that exact commit.
5. **Tag, push the tag** — `git tag vX.Y.Z` on that commit, and the founder pushes the tag. `kit-ci`
   runs again on the tag and fails when the tag is not `v` + the `package.json` version. vuco's
   `kit-pin` check refuses a tag whose commit has no green `kit-ci` run.
6. **Consumer bump, the same day** — in vuco first, then every other consumer:
   - set `"@vuco/kit": "github:killerbeanjeka/vuco-kit#vX.Y.Z"` in `apps/mobile/package.json` and
     run `npm install`;
   - set the same pin on the `kit:` line of DESIGN.md's frontmatter (`kit-pin` compares the two);
   - run `npm run sync-kit` in `apps/mobile`; when it changes a landing copy, bump the landing `?v=`
     tokens (`apps/landing/README.md`, "Kit bumps");
   - run `npx tsc --noEmit`, `npx expo lint` and `npx jest --ci` in `apps/mobile` — kit source
     compiles and runs inside the app;
   - commit. vuco's `kit-pin` check is red until this is done.

## Rules

- Tags are immutable. A bug in `v0.1.0` is fixed in `v0.1.1`; never move or delete a tag.
- Try a change in a consumer before its tag exists with `npm pack` here and
  `npm install --no-save <tgz>` in the consumer, then restart Metro with `-c`. Never `npm link` or a
  folder install: a symlinked kit resolves its own `node_modules`, and the consumer runs a second React
  and a second i18next.
- No `npm publish`. No `preinstall`, `install`, `postinstall`, `prepare` or `prepack` scripts: npm
  fetches the public tag tarball anonymously and runs nothing (`kit-ci` checks this).
- Nothing app-specific, secret or customer-derived goes in — no `.env` files, keys or store
  credentials, no real names or customer data in fixtures. `secret-scan` runs on every push.
- Token changes: edit `tokens/base.tokens.yaml` or `tokens/brands/<brand>.yaml`, run
  `node tokens/generate-tokens.mjs --brand <brand>`, re-verify the contrast table in the consuming
  app's design spec, and commit sources and outputs together.
