// The slice of fontkit 2.0.4 that tokens/check-tnum.mjs uses; fontkit ships no type declarations.
declare module "fontkit" {
  export interface GlyphPosition {
    xAdvance: number;
  }
  export interface Glyph {
    name: string;
    advanceWidth: number;
  }
  export interface GlyphRun {
    glyphs: Glyph[];
    positions: GlyphPosition[];
  }
  export interface OS2Table {
    usWeightClass: number;
    usWidthClass: number;
  }
  export interface Font {
    familyName: string;
    postscriptName: string;
    unitsPerEm: number;
    availableFeatures: string[];
    "OS/2": OS2Table;
    hasGlyphForCodePoint(codePoint: number): boolean;
    layout(text: string, features?: string[]): GlyphRun;
  }
  export function openSync(path: string): Font;
}
