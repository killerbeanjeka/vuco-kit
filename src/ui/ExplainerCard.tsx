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
  rows: ExplainerRow[];
  ctaLabel: string;
  onCta: () => void;
  /** Optional secondary text link under the CTA (e.g. "What's §19?"). */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Optional disclosure content rendered under the rows (e.g. the §19 paragraph). */
  children?: ReactNode;
  testID?: string;
}

// Reusable explainer (VAPP-74, N26 Spaces pattern): header icon + title + benefit rows + a
// primary CTA + an optional secondary link. Content-only — the consumer owns the container
// (a Sheet for the tax fork; the same anatomy is wanted later for the chase-ladder intro).
export function ExplainerCard({
  icon,
  title,
  rows,
  ctaLabel,
  onCta,
  secondaryLabel,
  onSecondary,
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
        {/* Keyed by index (review P4): the same icon may legitimately repeat across rows in a
            reused explainer, so the icon name is not a stable key. */}
        {rows.map((row, index) => (
          <View key={index} className="w-full flex-row items-start gap-3">
            <Icon name={row.icon} size={22} className="mt-0.5 text-link dark:text-link-dark" />
            <Text className="flex-1 font-body text-body text-ink-primary dark:text-ink-primary-dark">
              {row.text}
            </Text>
          </View>
        ))}
      </View>

      {children}

      <View className="gap-2">
        <ButtonPrimary testID={testID ? `${testID}-cta` : undefined} label={ctaLabel} onPress={onCta} />
        {secondaryLabel && onSecondary ? (
          <Pressable
            testID={testID ? `${testID}-secondary` : undefined}
            accessibilityRole="button"
            onPress={onSecondary}
            className="min-h-11 items-center justify-center"
          >
            <Text className="font-body text-body text-link dark:text-link-dark">{secondaryLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
