/**
 * The faces behind the text roles, as the CSS variables the generated NativeWind theme reads
 * (`fontFamily.body: ['var(--font-body, PlusJakartaSans-Regular)']`, kit 0.9.0). An app switches the
 * text roles to another script by setting these variables on a View above its screens with
 * NativeWind's `vars()`:
 *
 *   const LATIN = vars(FONT_ROLE_VARS.latin);
 *   const CYRILLIC = vars(FONT_ROLE_VARS.cyrillic);
 *   <View style={cyrillicLanguage ? CYRILLIC : LATIN}>…</View>   (a full-size View around the app)
 *
 * Give that View one of the two styles from its first render (adding a variable later remounts what
 * is under it), and keep both as module-level constants (styles are compared by identity).
 *
 * `latin` repeats the theme's fallbacks, so setting it changes nothing. `cyrillic` is Fixel Text
 * (`tokens/fonts/FixelText-<Weight>.ttf`, which the app's `expo-font` plugin must embed) at the same
 * weights. The money roles have no variable: money is Plus Jakarta Sans in every language, and so is
 * any figure that needs tabular digits (pin it with an inline `fontFamily`).
 */
export const FONT_ROLE_VARS = {
  latin: {
    '--font-display': 'PlusJakartaSans-ExtraBold',
    '--font-title': 'PlusJakartaSans-Bold',
    '--font-heading': 'PlusJakartaSans-SemiBold',
    '--font-body': 'PlusJakartaSans-Regular',
    '--font-field': 'PlusJakartaSans-Regular',
    '--font-meta': 'PlusJakartaSans-Medium',
  },
  cyrillic: {
    '--font-display': 'FixelText-ExtraBold',
    '--font-title': 'FixelText-Bold',
    '--font-heading': 'FixelText-SemiBold',
    '--font-body': 'FixelText-Regular',
    '--font-field': 'FixelText-Regular',
    '--font-meta': 'FixelText-Medium',
  },
} as const;
