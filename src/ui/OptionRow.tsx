import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

import { Icon } from './icons';

interface OptionRowProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Optional slot rendered before the label (e.g. the theme preview swatch). */
  leading?: ReactNode;
  /**
   * Story 13.1 (settings): render as a FLAT row inside a grouped card (one radiogroup = one card,
   * matching the Job Card's grouped list) — the row drops its own rounding and, when unselected, its
   * fill, so the parent card's surface shows through. The parent supplies `overflow-hidden rounded-lg
   * bg-surface-raised` and passes `divider` on every row but the first.
   */
  grouped?: boolean;
  /** In grouped mode, draw the top hairline divider (i.e. every row except the first). */
  divider?: boolean;
  testID?: string;
}

// The selection row of the picker primitive (language, theme, tax). Selected = petrol tint + a
// `link`-petrol label + a vector check (never colour alone, NFR-1 — the check is the shape signal).
// Standalone it is a filled raised pill; `grouped` folds it into one hairline-divided card. The row
// is a ≥48dp target (min-height 56, grows with fontScale).
export function OptionRow({ label, selected, onPress, leading, grouped = false, divider = false, testID }: OptionRowProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      className={`min-h-[56px] w-full flex-row items-center gap-3 px-4 py-3 active:opacity-90 ${
        grouped ? '' : 'rounded-xl'
      } ${
        grouped && divider ? 'border-t border-border-hairline dark:border-border-hairline-dark' : ''
      } ${
        selected
          ? 'bg-primary/10 dark:bg-primary-dark/15'
          : grouped
            ? 'bg-transparent'
            : 'bg-surface-raised dark:bg-surface-raised-dark'
      }`}
    >
      {leading}
      <Text
        className={`flex-1 font-body text-body ${
          selected
            ? 'text-link dark:text-link-dark'
            : 'text-ink-primary dark:text-ink-primary-dark'
        }`}
      >
        {label}
      </Text>
      {selected ? (
        <Icon
          testID={testID ? `${testID}-check` : undefined}
          name="check"
          size={20}
          className="text-link dark:text-link-dark"
        />
      ) : null}
    </Pressable>
  );
}
