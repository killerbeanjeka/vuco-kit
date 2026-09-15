import { router } from 'expo-router';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { Icon } from './icons';

// screen-header (VAPP-79): the ONE back/close affordance for every full-screen surface.
// Replaces the per-screen hand-rolled headers, which had drifted into three incompatible
// treatments (a raw `‹` glyph, a `‹ Back` text link, and a full-width ButtonSecondary pill).
//
// 2026 back-nav contract, enforced structurally so no screen can diverge again:
//  - Icon-only (a real vector `arrow-left` / `close`, never a text glyph). The word lives
//    ONLY in the a11y label, so nothing to translate in-line and nothing to overflow in DE.
//  - push → pops the stack; modal → dismisses. Same control, honest affordance.
//  - Guarded: a deep-link / notification entry can never land on a dead back control
//    (canGoBack ? back : replace(fallback)) — folded in here, not re-implemented per screen.
//  - Backed by the platform back gesture (the root Stack leaves gestures on by default).
//
// Rendered as the FIRST row inside a screen's scroll container; the screen keeps its own
// top inset and its large display title below. Pass `title` for the compact inline-title
// screens (Settings, Price list, Feedback); omit it where a big title follows.
interface ScreenHeaderProps {
  /** 'push' → back arrow that pops the stack; 'modal' → close (✕) that dismisses. */
  variant?: 'push' | 'modal';
  /** Optional inline title shown next to the control. */
  title?: string;
  /** Override the default guarded navigation. */
  onBack?: () => void;
  /** Route to fall back to when there is nothing to pop (deep-link entry). Default '/'. */
  fallback?: string;
  /** Optional top-right slot (e.g. a SyncIndicator). */
  trailing?: ReactNode;
  testID?: string;
}

export function ScreenHeader({
  variant = 'push',
  title,
  onBack,
  fallback = '/',
  trailing,
  testID,
}: ScreenHeaderProps) {
  // The a11y words live in the kit's own `kit` namespace (src/i18n), so no app has to supply them.
  const { t } = useTranslation('kit');
  const modal = variant === 'modal';
  const handlePress =
    onBack ??
    (() =>
      router.canGoBack()
        ? router.back()
        : router.replace(fallback as Parameters<typeof router.replace>[0]));
  return (
    <View className="min-h-[48px] flex-row items-center gap-2">
      <Pressable
        testID={testID ?? 'screen-back'}
        accessibilityRole="button"
        accessibilityLabel={t(modal ? 'close' : 'back')}
        onPress={handlePress}
        hitSlop={8}
        // -ml-2 optically aligns the icon glyph to the screen's content edge while the
        // 48dp touch target keeps its padding.
        className="-ml-2 min-h-[48px] min-w-[48px] items-center justify-center rounded-full active:opacity-60"
      >
        <Icon
          name={modal ? 'close' : 'arrow-left'}
          size={26}
          className="text-ink-primary dark:text-ink-primary-dark"
        />
      </Pressable>
      {title ? (
        <Text
          numberOfLines={1}
          className="flex-1 font-title text-title text-ink-primary dark:text-ink-primary-dark"
        >
          {title}
        </Text>
      ) : (
        <View className="flex-1" />
      )}
      {trailing ?? null}
    </View>
  );
}
