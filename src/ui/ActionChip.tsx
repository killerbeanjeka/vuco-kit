import { Pressable, Text } from 'react-native';

import { Icon, type IconName } from './icons';

// Action chip (VAPP-76 chip system, role 3 of 3): an OUTLINE pill that navigates or acts — visually
// distinct from the filled ChoiceChip and the non-tappable StatusChip. An optional leading icon and
// a trailing affordance icon (chevron = opens a screen, swap = toggles in place) keep the affordance
// honest. Compact 40dp lozenge with a 4dp vertical hitSlop so the touch target clears the 48dp control
// floor (DESIGN.md chip contract). Used for the document-identity strip (terms / IBAN / language).
export function ActionChip({
  label,
  onPress,
  leadingIcon,
  trailingIcon = 'chevron-right',
  testID,
}: {
  label: string;
  onPress: () => void;
  leadingIcon?: IconName;
  trailingIcon?: IconName;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      className="min-h-[40px] flex-row items-center gap-2 rounded-full border-[1.5px] border-border-input px-3 py-2 dark:border-border-input-dark"
    >
      {leadingIcon ? (
        <Icon name={leadingIcon} size={14} className="text-ink-secondary dark:text-ink-secondary-dark" />
      ) : null}
      <Text className="font-meta text-meta text-ink-primary dark:text-ink-primary-dark">{label}</Text>
      {trailingIcon ? (
        <Icon name={trailingIcon} size={14} className="text-ink-secondary dark:text-ink-secondary-dark" />
      ) : null}
    </Pressable>
  );
}
