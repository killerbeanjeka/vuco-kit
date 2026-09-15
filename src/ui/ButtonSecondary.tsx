import { Pressable, Text } from 'react-native';

interface ButtonSecondaryProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  variant?: 'default' | 'danger';
}

// button-secondary (DESIGN.md / Story 13.1 doctrine): a medium-emphasis TONAL pill — petrol at its
// palest (primary-tonal) with a petrol-ink label (on-primary-tonal). It reads as "supporting
// action": unmistakably a button, unmistakably quieter than the ONE filled-primary CTA a screen is
// allowed. The tonal ground ties every secondary action to the brand without competing for the eye
// (the one-loud-action doctrine — hierarchy comes from weight, not from more colour). Disabled →
// ink-disabled label on the same tonal ground.
// px-4 + centered 2-line label (founder UX fix): paired half-width buttons ("Take photo" / "From
// gallery") must stay the SAME size — the tighter padding stops narrow-device label wraps. NO
// h-full here: percentage height explodes inside definite-height parents (a giant Add-time pill on
// the real phone).
// variant="danger": the destructive affordance — same quiet pill, but an overdue-red label on a
// red-ringed transparent ground. Destruction warns in red; Workshop Orange stays the FAB's alone
// and petrol stays the money's (one-loud-action doctrine — danger is DISTINCT, never LOUDER).
export function ButtonSecondary({ label, onPress, disabled = false, testID, variant = 'default' }: ButtonSecondaryProps) {
  const danger = variant === 'danger';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-[56px] w-full flex-row items-center justify-center rounded-full px-4 py-3 active:opacity-90 ${
        danger
          ? 'border border-status-overdue/40 bg-transparent dark:border-status-overdue-dark/40'
          : 'bg-primary-tonal dark:bg-primary-tonal-dark'
      }`}
    >
      <Text
        numberOfLines={2}
        className={`text-center font-heading text-heading ${
          disabled
            ? 'text-ink-disabled dark:text-ink-disabled-dark'
            : danger
              ? 'text-status-overdue-text dark:text-status-overdue-text-dark'
              : 'text-on-primary-tonal dark:text-on-primary-tonal-dark'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
