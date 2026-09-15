import { Pressable, Text } from 'react-native';

// Choice chip (VAPP-76 chip system, role 2 of 3): a segmented-control option — one selected, azure
// fill; unselected sits on surface-sunken. Compact 32dp lozenge that grows with font scale, with an
// 8dp vertical hitSlop so the *touch* target clears the 48dp control floor (DESIGN.md chip contract).
// Interactive by design, unlike the non-tappable StatusChip. The single source for every "pick one"
// pill in the app — the line-kind selector (Labor/Material), the document language (DE/EN), the VAT rate.
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
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8 }}
      className={`min-h-[32px] items-center justify-center rounded-full px-3 py-1 ${
        selected ? 'bg-primary/10 dark:bg-primary-dark/15' : 'bg-surface-sunken dark:bg-surface-sunken-dark'
      }`}
    >
      <Text
        className={`font-meta text-meta ${
          selected ? 'text-link dark:text-link-dark' : 'text-ink-secondary dark:text-ink-secondary-dark'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
