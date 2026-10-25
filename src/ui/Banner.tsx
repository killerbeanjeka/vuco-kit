import { useEffect, useRef } from 'react';
import { AccessibilityInfo, findNodeHandle, Pressable, Text, View } from 'react-native';

import { Icon, type IconName } from './icons';

// One banner for the draft review (VAPP-76): the single amber caution surface (status-failed family —
// caution, not catastrophe; "no red walls" holds). Leading icon + one line + an optional action, on a
// status-failed tint with a rounded-sm edge, placed directly above the section it concerns. It
// replaces the old ConflictBanner + the ad-hoc gray notices so warnings speak one visual language.
//
// `assertive` is the review-blocking case (Story 5.1 conflict): the banner moves accessibility focus to
// its message on mount and announces as an alert — the screen still owns disabling the primary button.
// Kit 0.12.0: the focus goes to the message Text, an accessible node, where it went to the root View
// before, which TalkBack does not focus; and the action's label shrinks and wraps, so its chevron
// stays inside the banner.
export interface BannerProps {
  message: string;
  icon?: IconName;
  /** Optional action — a labelled control with a chevron affordance. */
  action?: { label: string; onPress: () => void; testID?: string };
  /** Blocking/alert semantics (Story 5.1): move a11y focus to the message on mount + announce assertively. */
  assertive?: boolean;
  testID?: string;
}

export function Banner({
  message,
  icon = 'alert-circle-outline',
  action,
  assertive = false,
  testID,
}: BannerProps) {
  // The message Text: accessible (a Text is by default), so TalkBack can take the focus there. The root
  // View cannot be the target: it is deliberately not accessible (below), and TalkBack ignores a focus
  // request for a view that is not accessible (vuco:walk Story 2.7, B4).
  const messageRef = useRef<Text>(null);
  useEffect(() => {
    if (!assertive) {
      return;
    }
    // Mount IS appearance for a conflict banner — move focus to the message and announce (EXPERIENCE a11y floor).
    const node = findNodeHandle(messageRef.current);
    if (node !== null) {
      AccessibilityInfo.setAccessibilityFocus(node);
    }
  }, [assertive]);

  return (
    <View
      testID={testID}
      // No `accessible` on the root: it would collapse the subtree into one node and hide the action
      // Pressable — a TalkBack user could never reach the acknowledge button on a blocking conflict.
      // `accessibilityLiveRegion` announces the message on mount/appearance WITHOUT grouping, so the
      // message and the action stay independently focusable. Non-assertive banners are `polite` so a
      // late-arriving notice (overlap/unacknowledged, set after an async read) is still announced.
      accessibilityRole={assertive ? 'alert' : undefined}
      accessibilityLiveRegion={assertive ? 'assertive' : 'polite'}
      className="flex-row items-start gap-2 rounded-sm border border-status-failed bg-status-failed/10 px-3 py-2 dark:border-status-failed-dark dark:bg-status-failed-dark/15"
    >
      <Icon
        name={icon}
        size={18}
        className="text-status-failed-text dark:text-status-failed-text-dark"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <View className="flex-1 gap-1">
        <Text ref={messageRef} className="font-body text-meta text-status-failed-text dark:text-status-failed-text-dark">
          {message}
        </Text>
        {action ? (
          <Pressable
            testID={action.testID}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            hitSlop={{ top: 4, bottom: 4 }}
            className="min-h-[44px] flex-row items-center gap-1 self-start"
          >
            {/* shrink: a label too long for the banner wraps, and the chevron stays inside it, as ActionChip's (kit 0.12.0). */}
            <Text className="shrink font-meta text-meta text-link dark:text-link-dark">{action.label}</Text>
            <Icon name="chevron-right" size={14} className="text-link dark:text-link-dark" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
