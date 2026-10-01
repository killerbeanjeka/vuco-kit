import { Pressable, Text } from 'react-native';

import { DARK_TREATMENT, useDarkTreatment } from './darkTreatment';

// Choice chip (VAPP-76 chip system, role 2 of 3): a segmented-control option — one selected, azure
// fill; unselected sits on surface-sunken. Compact 32dp lozenge that grows with font scale, with an
// 8dp vertical hitSlop so the *touch* target clears the 48dp control floor (DESIGN.md chip contract).
// Interactive by design, unlike the non-tappable StatusChip. The single source for every "pick one"
// pill in the app — the line-kind selector (Labor/Material), the document language (DE/EN), the VAT rate.
// Under the dark treatment (kit 0.7.0) it shows its dark-mode look in both themes.
export function ChoiceChip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const dark = useDarkTreatment();
  const look = DARK_TREATMENT.choiceChip;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8 }}
      className={`min-h-[32px] items-center justify-center rounded-full px-3 py-1 ${
        selected
          ? dark
            ? look.selected
            : 'bg-primary/10 dark:bg-primary-dark/15'
          : dark
            ? look.unselected
            : 'bg-surface-sunken dark:bg-surface-sunken-dark'
      }`}
    >
      <Text
        className={`font-meta text-meta ${
          selected
            ? dark
              ? look.labelSelected
              : 'text-link dark:text-link-dark'
            : dark
              ? look.label
              : 'text-ink-secondary dark:text-ink-secondary-dark'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
