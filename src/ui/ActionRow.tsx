import { Pressable, Text, View } from 'react-native';

import { Icon, type IconName } from './icons';

// A tappable action row: a leading icon-in-tile, a title + one-line subtitle, and a trailing slot
// that reads its OWN state — a CTA lozenge (todo), a done-check, or a lock glyph (upcoming). The
// N26/Revolut per-row-CTA pattern (Penpot compare Row 2), reusable for the activation checklist
// (VAPP-72) and any future settings/action list. Card anatomy = the Job-Card section tokens.
//
// State precedence: done ⟶ disabled ⟶ actionable. done and disabled are NOT pressable (a done step
// is a quiet confirmation; a disabled step is an upcoming preview). Every state carries a NON-COLOUR
// marker (check / lock / CTA text), never colour alone (UX-DR6).
export function ActionRow({
  icon,
  title,
  subtitle,
  ctaLabel,
  done = false,
  disabled = false,
  doneLabel,
  onPress,
  testID,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  /** Trailing CTA text when the row is actionable (todo). Ignored when done/disabled. */
  ctaLabel?: string;
  done?: boolean;
  disabled?: boolean;
  /** Translated word appended to the a11y label in the done state (locked uses accessibilityState). */
  doneLabel?: string;
  onPress?: () => void;
  testID?: string;
}) {
  const actionable = !done && !disabled && typeof onPress === 'function';
  // done and disabled both go quiet in secondary ink — a done check is a SUBTLE gray progress mark
  // (not success-green), a disabled step is a muted upcoming preview. Only the todo state is azure.
  const leadClass = actionable ? 'text-link dark:text-link-dark' : 'text-ink-secondary dark:text-ink-secondary-dark';
  const titleClass = disabled && !done ? 'text-ink-secondary dark:text-ink-secondary-dark' : 'text-ink-primary dark:text-ink-primary-dark';

  return (
    <Pressable
      testID={testID}
      accessibilityRole={actionable ? 'button' : undefined}
      accessibilityState={{ disabled: !actionable }}
      accessibilityLabel={[title, subtitle, done ? doneLabel : actionable ? ctaLabel : undefined].filter(Boolean).join(', ')}
      disabled={!actionable}
      onPress={actionable ? onPress : undefined}
      className={`min-h-[64px] flex-row items-center gap-3 rounded-lg bg-surface-raised p-3 dark:bg-surface-raised-dark ${
        actionable ? 'active:opacity-90' : ''
      }`}
    >
      <View className="h-10 w-10 items-center justify-center rounded-lg bg-surface-sunken dark:bg-surface-sunken-dark">
        <Icon name={icon} size={20} className={leadClass} />
      </View>
      <View className="shrink grow gap-0.5">
        {/* Labels wrap, never ellipsize German at fontScale 2.0 (DESIGN.md). */}
        <Text numberOfLines={2} className={`font-body text-body ${titleClass}`}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={3} className="font-meta text-meta text-ink-secondary dark:text-ink-secondary-dark">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {done ? (
        // SUBTLE gray progress check (not success-green) — a quiet "handled", not a celebration.
        <Icon name="check-circle-outline" size={22} className="text-ink-secondary dark:text-ink-secondary-dark" />
      ) : disabled ? (
        // Upcoming/locked: a non-colour marker so the row isn't distinguished by dimming alone.
        <Icon name="lock-outline" size={18} className="text-ink-secondary dark:text-ink-secondary-dark" />
      ) : actionable && ctaLabel ? (
        // The per-row CTA lozenge (chip-status token): azure, compact, the row's one action.
        <View className="rounded-full bg-primary/10 px-3 py-1.5 dark:bg-primary-dark/15">
          <Text className="font-meta text-meta text-link dark:text-link-dark">{ctaLabel}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
