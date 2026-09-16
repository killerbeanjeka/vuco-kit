# Contributing — the release ritual

The kit has consumers. A release is finished only when every consumer is pinned to it.

In this order:

1. **Change** — on `master`; record each change under `## Unreleased` in `CHANGELOG.md`.
2. **Test** — every kit CI step locally, each exiting 0, and afterwards `git status --porcelain`
   is empty:
   `npm ci` · `npm run typecheck` · `npm run lint` · `npm test` ·
   `node tokens/generate-tokens.mjs --check --brand vuco` · `node tokens/check-tnum.mjs` ·
   `node tokens/check-dark-pairing.mjs --src src --allowlist dark-pairing-allowlist.json` ·
   the `className` guard in `kit-ci.yml` (no `className` under `src/` outside `src/ui/`) ·
   `npm pack --dry-run --json` through the pack guard in `kit-ci.yml` (every required file is
   listed, nothing outside the published layout, no test file)
3. **Bump** — `npm version --no-git-tag-version <x.y.z>` (semver; keeps `package-lock.json` in
   step), and rename `## Unreleased` to `## x.y.z — YYYY-MM-DD`.
4. **Commit, push `master`, wait for green** — the founder pushes `master`; wait until `kit-ci` is
   green on that exact commit.
5. **Tag, push the tag** — `git tag vX.Y.Z` on that commit, and the founder pushes the tag. `kit-ci`
   runs again on the tag and fails when the tag is not `v` + the `package.json` version. vuco's
   `kit-pin` check refuses a tag whose commit has no green `kit-ci` run.
6. **Consumer bump, the same day** — in vuco first, then every other consumer:
   - install the new tag explicitly in every folder that pins the kit. In vuco that is `apps/mobile`
     (`npm install "@vuco/kit@github:killerbeanjeka/vuco-kit#vX.Y.Z"`) and `packs`
     (`npm install -D "@vuco/kit@github:killerbeanjeka/vuco-kit#vX.Y.Z"`). Do not just edit the
     `#vX.Y.Z` in `package.json` and run a plain `npm install`: npm keeps the commit the lockfile
     already resolved, exits 0, and the folder silently stays on the old kit;
   - check both results in each folder: `node -p "require('@vuco/kit/package.json').version"` prints
     `X.Y.Z`, and the `resolved` URL of `node_modules/@vuco/kit` in `package-lock.json` ends with the
     commit of the tag (`git ls-remote https://github.com/killerbeanjeka/vuco-kit refs/tags/vX.Y.Z`);
   - set the same pin on the `kit:` line of DESIGN.md's frontmatter. vuco's `kit-pin` check compares
     it and the `packs` pin with `apps/mobile/package.json`, and `pack-lint` compares the `packs` pin
     and the installed kit version;
   - run `npm run sync-kit` in `apps/mobile`; when it changes a landing copy, bump the landing `?v=`
     tokens (`apps/landing/README.md`, "Kit bumps");
   - run `npx tsc --noEmit`, `npx expo lint` and `npx jest --ci` in `apps/mobile`, and
     `node lint/pack-lint.test.mjs`, `node lint/pack-lint.mjs` and `node validate-pack.mjs` in
     `packs` — kit source compiles and runs inside the app and its tooling;
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
- A new file under `src/` joins the `required` list and the `layout` patterns of the pack guard in
  `kit-ci.yml`. Styled components go under `src/ui/` only: apps scan that folder, and nothing else in
  the kit, for Tailwind classes, and `kit-ci` fails on `className` anywhere else under `src/`. Modules that Node runs from `node_modules` are `.mjs` with JSDoc
  types. The kit takes no runtime `dependencies`.
- Token changes: edit `tokens/base.tokens.yaml` or `tokens/brands/<brand>.yaml`, run
  `node tokens/generate-tokens.mjs --brand <brand>`, re-verify the contrast table in the consuming
  app's design spec, and commit sources and outputs together.
