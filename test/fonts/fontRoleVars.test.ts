/// <reference types="node" />
// Kit 0.9.0: the text roles' font variables. `latin` must repeat the generated theme's fallbacks (so an
// app that sets it, or sets nothing, renders as before kit 0.9.0), `cyrillic` must name the same
// variables at the same weights, and every face must have a font file in the kit.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { FONT_ROLE_VARS } from '../../src/fonts/fontRoleVars';

const kitRoot = join(__dirname, '..', '..');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const theme = require('../../tokens/out/vuco/nativewind-theme.cjs') as { theme: { fontFamily: Record<string, string[]> } };

/** The theme's variable-backed roles: `--font-<role>` → its fallback face. */
function themeFallbacks(): Record<string, string> {
  return Object.fromEntries(
    Object.values(theme.theme.fontFamily).flatMap((families) => {
      const match = /^var\((--font-[a-z-]+), ([A-Za-z-]+)\)$/.exec(families[0] ?? '');
      return match ? [[match[1], match[2]]] : [];
    }),
  );
}

const weightOf = (face: string) => face.slice(face.indexOf('-') + 1);

describe('FONT_ROLE_VARS (the text roles per script)', () => {
  it('the theme backs the six text roles with a variable and keeps the money roles static', () => {
    const { fontFamily } = theme.theme;
    expect(Object.keys(themeFallbacks()).sort()).toEqual(
      ['--font-body', '--font-display', '--font-field', '--font-heading', '--font-meta', '--font-title'],
    );
    expect(fontFamily.money).toEqual(['PlusJakartaSans-Bold']);
    expect(fontFamily['money-hero']).toEqual(['PlusJakartaSans-Bold']);
  });

  it('latin equals the theme fallbacks, so setting it changes nothing', () => {
    expect(FONT_ROLE_VARS.latin).toEqual(themeFallbacks());
  });

  it('cyrillic sets the same variables, each at the latin face’s weight', () => {
    expect(Object.keys(FONT_ROLE_VARS.cyrillic).sort()).toEqual(Object.keys(FONT_ROLE_VARS.latin).sort());
    for (const [variable, face] of Object.entries(FONT_ROLE_VARS.cyrillic)) {
      expect(face).toMatch(/^FixelText-/);
      expect(weightOf(face)).toBe(weightOf(FONT_ROLE_VARS.latin[variable as keyof typeof FONT_ROLE_VARS.latin]));
    }
  });

  it('every face either script names is a font file in tokens/fonts', () => {
    const faces = [...Object.values(FONT_ROLE_VARS.latin), ...Object.values(FONT_ROLE_VARS.cyrillic)];
    expect(faces.filter((face) => !existsSync(join(kitRoot, 'tokens', 'fonts', `${face}.ttf`)))).toEqual([]);
  });
});
