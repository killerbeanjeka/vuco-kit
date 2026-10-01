import { createContext, useContext, type ReactNode } from 'react';

// The dark treatment (kit 0.7.0, for vuco:walk's sheets over the camera): a surface that is dark in both
// themes. NativeWind's `dark:` variant follows one app-wide colour scheme, so it cannot darken one surface
// while the rest of the app stays light. Inside `DarkTreatment`, or a `Sheet` with `dark`, the primitives
// `Sheet`, `Input`, `ChoiceChip`, `ActionChip`, `OptionRow`, `ButtonPrimary` and `ButtonSecondary` take the
// class strings below: their dark-mode look, in the `-dark` tokens alone. Outside it they keep their paired
// classes, unchanged.
//
// These strings are the kit's only single-mode classes, so this is the one file the kit's
// dark-pairing-allowlist.json names, with its reason. The primitives keep their paired classes in their own
// files, where the check still reads them.

const DarkTreatmentContext = createContext(false);

/** Renders the kit primitives inside it in their `-dark` tokens, whatever the app's theme. */
export function DarkTreatment({ children }: { children: ReactNode }) {
  return <DarkTreatmentContext value>{children}</DarkTreatmentContext>;
}

/** True inside `DarkTreatment` (or a `Sheet` with `dark`): a primitive then takes its dark-only classes. */
export function useDarkTreatment(): boolean {
  return useContext(DarkTreatmentContext);
}

/** What each primitive takes under the treatment: the classes its dark mode shows, without the light ones. */
export const DARK_TREATMENT = {
  sheet: {
    // The dark mode's deeper scrim, and the panel with its hairline top edge and no shadow.
    scrim: 'absolute inset-0 bg-ink-primary/60',
    panel: 'rounded-t-xl border-t border-border-hairline-dark bg-surface-raised-dark px-4 shadow-none',
  },
  input: {
    label: 'text-ink-secondary-dark',
    labelError: 'text-status-overdue-text-dark',
    fill: 'bg-surface-raised-dark',
    border: 'border-border-input-dark',
    borderFocused: 'border-focus-ring-dark',
    borderError: 'border-status-overdue-dark',
    text: 'text-ink-primary-dark placeholder:text-ink-secondary-dark',
    error: 'text-status-overdue-text-dark',
  },
  choiceChip: {
    selected: 'bg-primary-dark/15',
    unselected: 'bg-surface-sunken-dark',
    labelSelected: 'text-link-dark',
    label: 'text-ink-secondary-dark',
  },
  actionChip: {
    border: 'border-border-input-dark',
    label: 'text-ink-primary-dark',
    icon: 'text-ink-secondary-dark',
  },
  optionRow: {
    divider: 'border-t border-border-hairline-dark',
    selected: 'bg-primary-dark/15',
    unselected: 'bg-surface-raised-dark',
    labelSelected: 'text-link-dark',
    label: 'text-ink-primary-dark',
    check: 'text-link-dark',
  },
  buttonPrimary: {
    fill: 'bg-primary-dark active:opacity-90',
    fillDisabled: 'bg-surface-sunken-dark',
    label: 'text-on-primary-dark',
    labelDisabled: 'text-ink-disabled-dark',
  },
  buttonSecondary: {
    fill: 'bg-primary-tonal-dark',
    fillDanger: 'border border-status-overdue-dark/40 bg-transparent',
    label: 'text-on-primary-tonal-dark',
    labelDanger: 'text-status-overdue-text-dark',
    labelDisabled: 'text-ink-disabled-dark',
  },
} as const;
