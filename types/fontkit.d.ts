// The slice of fontkit 2.0.4 that tokens/check-tnum.mjs uses; fontkit ships no type declarations.
declare module "fontkit" {
  export interface GlyphPosition {
    xAdvance: number;
  }
  export interface GlyphRun {
    positions: GlyphPosition[];
  }
  export interface Font {
    familyName: string;
    postscriptName: string;
    unitsPerEm: number;
    availableFeatures: string[];
    layout(text: string, features?: string[]): GlyphRun;
  }
  export function openSync(path: string): Font;
}
