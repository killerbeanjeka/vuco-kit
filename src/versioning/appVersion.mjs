// The app version name of every vuco-family app: MAJOR.EPIC.STORY.BUILD (Story 15.3). The policy
// behind it is in README.md next to this file. Plain ESM with JSDoc types, so an app's Node scripts can
// import it straight from node_modules.
//
//   import { bumpAppVersion } from '@vuco/kit/src/versioning/appVersion.mjs';
//   bumpAppVersion('0.1.10.2', 'epic'); // '0.2.0.1'
//
// Every function throws on input it does not recognise and names that input. None of them falls back
// to a default.

/**
 * @typedef {object} AppVersion
 * @property {number} major  raised only by the app's owner, never by this helper
 * @property {number} epic  how many epics are finished since the app adopted the scheme
 * @property {number} story  how many stories are finished since the last epic
 * @property {number} build  starts at 1 with each story or epic bump; one more per fix
 */

/** The kinds bumpAppVersion accepts. MAJOR is not one of them. */
export const BUMP_KINDS = /** @type {const} */ (["fix", "story", "epic"]);

// Four non-negative integers without leading zeros, and nothing else: no `v` prefix, no suffix. BUILD
// starts at 1, so it is never 0; MAJOR, EPIC and STORY may be.
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)\.([1-9]\d*)$/;
const RULE = "MAJOR.EPIC.STORY.BUILD, four non-negative integers without leading zeros and a BUILD of at least 1";

/**
 * @param {unknown} text  e.g. '0.1.10.2'
 * @returns {AppVersion}
 */
export function parseAppVersion(text) {
  const match = typeof text === "string" ? VERSION.exec(text) : null;
  const parts = match ? match.slice(1).map(Number) : [];
  if (!match || !parts.every(Number.isSafeInteger)) {
    throw new Error(
      `invalid app version ${JSON.stringify(text)}: expected ${RULE}`,
    );
  }
  const [major, epic, story, build] = parts;
  return { major, epic, story, build };
}

/**
 * @param {AppVersion} version
 * @returns {string}  e.g. '0.1.10.2'
 */
export function formatAppVersion(version) {
  const parts = [version?.major, version?.epic, version?.story, version?.build];
  const valid =
    parts.every((part) => Number.isSafeInteger(part) && /** @type {number} */ (part) >= 0) &&
    /** @type {number} */ (version.build) >= 1;
  if (!valid) {
    throw new Error(`invalid app version ${JSON.stringify(version)}: expected ${RULE}`);
  }
  return parts.join(".");
}

/**
 * The next version name after a change of the given kind:
 * - `fix` → BUILD + 1
 * - `story` → STORY + 1, BUILD = 1
 * - `epic` → EPIC + 1, STORY = 0, BUILD = 1
 * @param {unknown} text  the current version name
 * @param {unknown} kind  one of BUMP_KINDS
 * @returns {string}
 */
export function bumpAppVersion(text, kind) {
  const { major, epic, story, build } = parseAppVersion(text);
  switch (kind) {
    case "fix":
      return formatAppVersion({ major, epic, story, build: build + 1 });
    case "story":
      return formatAppVersion({ major, epic, story: story + 1, build: 1 });
    case "epic":
      return formatAppVersion({ major, epic: epic + 1, story: 0, build: 1 });
    default:
      throw new Error(
        `unknown bump kind ${JSON.stringify(kind)}: expected ${BUMP_KINDS.join(", ")} (MAJOR moves only by the owner's hand)`,
      );
  }
}
