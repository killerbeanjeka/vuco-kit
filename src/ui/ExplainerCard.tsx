import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ButtonPrimary } from './ButtonPrimary';
import { Icon, type IconName } from './icons';

export interface ExplainerRow {
  icon: IconName;
  text: string;
}

interface ExplainerCardProps {
  /** Header icon above the title (optional). */
  icon?: IconName;
  title: string;
  /** Benefit rows: an icon + one short line each (N26 Spaces anatomy). */
  rows: readonly ExplainerRow[];
  ctaLabel: string;
  onCta: () => void;
  /** The primary button's own states (kit 0.10.0), passed to its `ButtonPrimary`: disabled, and pending with its progress text. */
  ctaDisabled?: boolean;
  ctaPending?: boolean;
  ctaPendingLabel?: string;
  /** Optional secondary text link under the CTA (e.g. "What's §19?"). */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** The secondary link's disabled state (kit 0.10.0): not pressable, said so to screen readers, in the disabled ink. */
  secondaryDisabled?: boolean;
  /** Optional disclosure content rendered under the rows (e.g. the §19 paragraph). */
  children?: ReactNode;
  testID?: string;
}

/**
 * The card's benefit rows on their own (kit 0.12.0, for vuco:walk's First run, which lists them outside a card): an
 * icon in the link ink and one short line each. The rows render without a container, so the caller's layout sets the
 * gap between them. The icons are decoration, hidden from screen readers, which read the lines alone. With a `testID`,
 * row `i` is `${testID}-row-${i}`.
 */
export function ExplainerRows({ rows, testID }: { rows: readonly ExplainerRow[]; testID?: string }) {
  return (
    <>
      {/* Keyed by index (review P4): the same icon may legitimately repeat across rows in a
          reused explainer, so the icon name is not a stable key. */}
      {rows.map((row, index) => (
        <View key={index} testID={testID ? `${testID}-row-${index}` : undefined} className="w-full flex-row items-start gap-3">
          <Icon
            name={row.icon}
            size={22}
            className="mt-0.5 text-link dark:text-link-dark"
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Text className="flex-1 font-body text-body text-ink-primary dark:text-ink-primary-dark">{row.text}</Text>
        </View>
      ))}
    </>
  );
}

// Reusable explainer (VAPP-74, N26 Spaces pattern): header icon + title + benefit rows + a
// primary CTA + an optional secondary link. Content-only — the consumer owns the container
// (a Sheet for the tax fork; the same anatomy is wanted later for the chase-ladder intro).
// The button can be disabled or pending (kit 0.10.0, vuco:walk's paywall: Buy waits for the store's price, and
// shows progress text while the purchase runs), and the secondary link can be disabled (Restore, offline); without
// those props both are as they were. The rows are `ExplainerRows` (kit 0.12.0), whose icons screen readers skip.
export function ExplainerCard({
  icon,
  title,
  rows,
  ctaLabel,
  onCta,
  ctaDisabled,
  ctaPending,
  ctaPendingLabel,
  secondaryLabel,
  onSecondary,
  secondaryDisabled = false,
  children,
  testID,
}: ExplainerCardProps) {
  return (
    <View testID={testID} className="gap-5">
      <View className="gap-3">
        {icon ? (
          <View className="h-12 w-12 items-center justify-center rounded-full bg-surface-sunken dark:bg-surface-sunken-dark">
            <Icon name={icon} size={26} className="text-link dark:text-link-dark" />
          </View>
        ) : null}
        <Text className="font-display text-display text-ink-primary dark:text-ink-primary-dark">{title}</Text>
      </View>

      <View className="gap-4">
        <ExplainerRows rows={rows} testID={testID} />
      </View>

      {children}

      <View className="gap-2">
        <ButtonPrimary
          testID={testID ? `${testID}-cta` : undefined}
          label={ctaLabel}
          onPress={onCta}
          disabled={ctaDisabled}
          pending={ctaPending}
          pendingLabel={ctaPendingLabel}
        />
        {secondaryLabel && onSecondary ? (
          <Pressable
            testID={testID ? `${testID}-secondary` : undefined}
            accessibilityRole="button"
            accessibilityState={{ disabled: secondaryDisabled }}
            disabled={secondaryDisabled}
            onPress={onSecondary}
            className="min-h-[48px] items-center justify-center"
          >
            <Text
              className={`font-body text-body ${
                secondaryDisabled ? 'text-ink-disabled dark:text-ink-disabled-dark' : 'text-link dark:text-link-dark'
              }`}
            >
              {secondaryLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
