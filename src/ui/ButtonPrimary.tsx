import { Pressable, Text } from 'react-native';

import { DARK_TREATMENT, useDarkTreatment } from './darkTreatment';

interface ButtonPrimaryProps {
  label: string;
  onPress: () => void;
  /** Progress text shown while pending — the button stays full-size, never spinner-only (UX-DR3). */
  pendingLabel?: string;
  pending?: boolean;
  disabled?: boolean;
  /** Optional trailing chevron; the button is never icon-only. */
  chevron?: boolean;
  testID?: string;
}

// button-primary (DESIGN.md): full-width pill, one per screen, min-height 56
// (a MINIMUM — grows with fontScale, so no fixed height anywhere). Under the dark treatment (kit 0.7.0) it shows
// its dark-mode look in both themes.
export function ButtonPrimary({
  label,
  onPress,
  pendingLabel,
  pending = false,
  disabled = false,
  chevron = false,
  testID,
}: ButtonPrimaryProps) {
  const inactive = disabled || pending;
  const dark = useDarkTreatment();
  const look = DARK_TREATMENT.buttonPrimary;
  const labelColor = dark ? look.label : 'text-on-primary dark:text-on-primary-dark';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: pending }}
      disabled={inactive}
      onPress={onPress}
      className={`min-h-[56px] w-full flex-row items-center justify-center gap-2 rounded-full px-6 py-3 ${
        disabled && !pending
          ? dark
            ? look.fillDisabled
            : 'bg-surface-sunken dark:bg-surface-sunken-dark'
          : dark
            ? look.fill
            : 'bg-primary active:opacity-90 dark:bg-primary-dark'
      }`}
    >
      <Text
        className={`font-heading text-heading ${
          disabled && !pending
            ? dark
              ? look.labelDisabled
              : 'text-ink-disabled dark:text-ink-disabled-dark'
            : labelColor
        }`}
      >
        {/* pending ALWAYS shows progress text — a press-blocked button must never
            look idle (contract fallback when no pendingLabel is provided) */}
        {pending ? (pendingLabel ?? `${label}…`) : label}
      </Text>
      {chevron && !pending ? (
        <Text className={`font-heading text-heading ${labelColor}`}>›</Text>
      ) : null}
    </Pressable>
  );
}
