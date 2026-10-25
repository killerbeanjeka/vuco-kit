import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';

import { Icon, type IconName } from './icons';

// One banner for the draft review (VAPP-76): the single amber caution surface (status-failed family —
// caution, not catastrophe; "no red walls" holds). Leading icon + one line + an optional action, on a
// status-failed tint with a rounded-sm edge, placed directly above the section it concerns. It
// replaces the old ConflictBanner + the ad-hoc gray notices so warnings speak one visual language.
//
// `assertive` is the review-blocking case (Story 5.1 conflict): the banner asks for accessibility focus on its
// message and announces as an alert — the screen still owns disabling the primary button. Kit 0.12.0: the focus goes to
// the message Text, made accessible, where it went to the root View before, which TalkBack does not focus; and the
// action's label shrinks and wraps, so its chevron stays inside the banner.

/**
 * How long after an assertive banner appears it asks TalkBack to focus its message (kit 0.12.0). On the Android
 * emulator (vuco:walk K12), a request on mount took the focus for a banner that appears with its screen (Export all with
 * no project) but lost it for one that appears on a settled screen (Capture's low-storage warning after a shot), where the
 * focus stayed on the screen's first control; 500 ms after the banner appears, the request took the focus in both.
 */
const FOCUS_DELAY_MS = 500;

export interface BannerProps {
  message: string;
  icon?: IconName;
  /** Optional action — a labelled control with a chevron affordance. */
  action?: { label: string; onPress: () => void; testID?: string };
  /** Blocking/alert semantics (Story 5.1): focus the message FOCUS_DELAY_MS after the banner appears + announce assertively. */
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
  // The message Text, made accessible: on Android a Text without onPress is not, and TalkBack does not take the focus to
  // a node that is not accessible. The root View cannot be the target either: it is deliberately not accessible (below),
  // so the action stays reachable (vuco:walk Story 2.7, B4).
  const messageRef = useRef<Text>(null);
  useEffect(() => {
    if (!assertive) {
      return;
    }
    // Mount IS appearance for a conflict banner — ask TalkBack to focus the message (EXPERIENCE a11y floor), once,
    // FOCUS_DELAY_MS after it appears; a banner gone by then asks nothing.
    const timer = setTimeout(() => {
      const message = messageRef.current;
      if (message !== null) {
        AccessibilityInfo.sendAccessibilityEvent(message, 'focus');
      }
    }, FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
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
        <Text ref={messageRef} accessible className="font-body text-meta text-status-failed-text dark:text-status-failed-text-dark">
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
