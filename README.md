# @vuco/kit

The shared layer of the vuco app family: the design tokens, their generator and checks, and the
fonts.

Consumers depend on a release tag of this public repository — no registry, no credentials, no
install scripts:

```json
"@vuco/kit": "github:killerbeanjeka/vuco-kit#vX.Y.Z"
```

Releases are the repository's `vX.Y.Z` tags; [CHANGELOG.md](CHANGELOG.md) says what each one changed.

## Contents

| Path | What |
|---|---|
| `tokens/base.tokens.yaml` | Shared tokens: colours (light and `-dark`), typography roles, radii, spacing, component tokens. `null` marks a brand-owned slot. |
| `tokens/brands/<brand>.yaml` | One brand: fills every `null` slot of the base and nothing else. |
| `tokens/generate-tokens.mjs` | `--brand <name>` writes `tokens/out/<name>/`; `--check` is the staleness gate. |
| `tokens/out/vuco/` | Committed vuco outputs: NativeWind theme, Hosted Page CSS, QuestPDF C# class. |
| `tokens/fonts/` | Plus Jakarta Sans 2.7.1, five static weights, SIL OFL 1.1 (`OFL.txt`). |
| `tokens/check-tnum.mjs` | Verifies tabular figures for the money role; writes `font-verdict.json`. |
| `tokens/check-dark-pairing.mjs` | CLI for consumers: every dual-mode colour token is used with its `-dark` twin. |
| `AGENTS.md` | Conventions every consumer app follows. |

Details: [tokens/README.md](tokens/README.md).

## Develop

Node 22 or later.

```bash
npm ci
npm run typecheck && npm run lint && npm test
node tokens/generate-tokens.mjs --check --brand vuco
node tokens/check-tnum.mjs
```

Releasing: [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

All rights reserved — see [LICENSE](LICENSE). A public repository is not an open licence. The
fonts in `tokens/fonts/` are the exception: SIL Open Font License 1.1.
