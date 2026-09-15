import { Pressable, Text } from 'react-native';

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
// (a MINIMUM — grows with fontScale, so no fixed height anywhere).
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
          ? 'bg-surface-sunken dark:bg-surface-sunken-dark'
          : 'bg-primary active:opacity-90 dark:bg-primary-dark'
      }`}
    >
      <Text
        className={`font-heading text-heading ${
          disabled && !pending
            ? 'text-ink-disabled dark:text-ink-disabled-dark'
            : 'text-on-primary dark:text-on-primary-dark'
        }`}
      >
        {/* pending ALWAYS shows progress text — a press-blocked button must never
            look idle (contract fallback when no pendingLabel is provided) */}
        {pending ? (pendingLabel ?? `${label}…`) : label}
      </Text>
      {chevron && !pending ? (
        <Text className="font-heading text-heading text-on-primary dark:text-on-primary-dark">›</Text>
      ) : null}
    </Pressable>
  );
}
