import { Pressable, Text } from 'react-native';

import { DARK_TREATMENT, useDarkTreatment } from './darkTreatment';
import { Icon, type IconName } from './icons';

// Action chip (VAPP-76 chip system, role 3 of 3): an OUTLINE pill that navigates or acts — visually
// distinct from the filled ChoiceChip and the non-tappable StatusChip. An optional leading icon and
// a trailing affordance icon (chevron = opens a screen, swap = toggles in place) keep the affordance
// honest. Compact 40dp lozenge with a 4dp vertical hitSlop so the touch target clears the 48dp control
// floor (DESIGN.md chip contract). Used for the document-identity strip (terms / IBAN / language). A chip that
// opens a field in place leaves the trailing icon out (`trailingIcon={null}`, kit 0.7.0), and under the dark
// treatment (kit 0.7.0) the chip shows its dark-mode look in both themes.
export function ActionChip({
  label,
  onPress,
  leadingIcon,
  trailingIcon = 'chevron-right',
  accessibilityLabel,
  testID,
}: {
  label: string;
  onPress: () => void;
  leadingIcon?: IconName;
  /** The affordance at the end: `chevron-right` (opens a screen) when left out, none when `null` (kit 0.7.0). */
  trailingIcon?: IconName | null;
  /** What a screen reader reads, when it needs more than the visible label (kit 0.6.0). Falls back to `label`. */
  accessibilityLabel?: string;
  testID?: string;
}) {
  const dark = useDarkTreatment();
  const look = DARK_TREATMENT.actionChip;
  const iconColor = dark ? look.icon : 'text-ink-secondary dark:text-ink-secondary-dark';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      className={`min-h-[40px] flex-row items-center gap-2 rounded-full border-[1.5px] px-3 py-2 ${
        dark ? look.border : 'border-border-input dark:border-border-input-dark'
      }`}
    >
      {leadingIcon ? <Icon name={leadingIcon} size={14} className={iconColor} /> : null}
      {/* shrink: a label too long for the row wraps inside the pill, and the trailing icon stays in it (kit 0.7.0). */}
      <Text className={`shrink font-meta text-meta ${dark ? look.label : 'text-ink-primary dark:text-ink-primary-dark'}`}>
        {label}
      </Text>
      {trailingIcon ? <Icon name={trailingIcon} size={14} className={iconColor} /> : null}
    </Pressable>
  );
}
