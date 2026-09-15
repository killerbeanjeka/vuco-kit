# @vuco/kit — conventions for every consumer

These rules hold in every app built on `@vuco/kit`. An app adds its own product rules in its own
files; it does not relax these.

## Read the versioned Expo docs first

Expo changes between SDK releases. Before writing app code, read the documentation for the exact
SDK the app pins (`https://docs.expo.dev/versions/v<SDK>.0.0/`) instead of relying on what an
older SDK did.

## Style only from tokens

- Colours, radii, spacing and type roles come from the generated kit tokens
  (`tokens/out/<brand>/`), used through their semantic names. A hand-copied value is rejected in
  review; changing a value is a kit release.
- A colour token that has a `-dark` twin is always used together with it, under the same variant
  chain (`bg-surface-base dark:bg-surface-base-dark`). Run `tokens/check-dark-pairing.mjs` over the
  app's source in CI; a surface that is single-mode on purpose goes in the app's allowlist with its
  reason.
- Money amounts use a money type role with tabular figures and stay fully visible — never
  truncated, ellipsized or greyed out.

## Money and legal paths fail closed

Where code produces a money amount or a legal document, input it does not recognise raises an
error. It never falls back to a default value.

## Test against the real shape

A test double that builds its own well-formed input proves nothing about real input. Assert
against the exact shape the real client or caller sends.

## A value ships with its consumer

A new constant, token or derived value lands in the same change as the code that uses it, with a
test that covers that use.

## Done means evidence and review

A story is done only when its record holds a device or emulator pass and a code review. A change
with no runtime surface records why, and is still reviewed.

## Versions

- Kit: semver tags `vX.Y.Z`. Tags are immutable; a fix is a new tag. The release order is in
  `CONTRIBUTING.md`, and every consumer moves to a new kit tag the same day.
- Apps: the version name is `MAJOR.EPIC.STORY.BUILD`, bumped in the commit that makes the change —
  a fix bumps BUILD; a finished story bumps STORY and resets BUILD to 1; a finished epic bumps
  EPIC and resets STORY to 0 and BUILD to 1. Only the owner raises MAJOR. iOS accepts at most three
  segments, so an iOS store build uses the first three.
