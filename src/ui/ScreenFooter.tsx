import { useEffect, useState } from 'react';
import { Keyboard, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReportBottomBarHeight } from './bottomBarSpace';
import { Icon, type IconName } from './icons';

// screen-footer (VAPP-80 / Story 13.1 brand mock): the app's ONE bottom navigation — a full-width,
// edge-to-edge bar (Telegram-style stretch) whose destinations (`items`) divide the width evenly;
// the active one carries a pill highlight (tint + primary) so the selected tab reads by SHAPE and
// colour, never colour alone (UX-DR6). "New job" is NO LONGER a bar slot — the brand mock makes it
// the floating ORANGE capture FAB (orange = money/capture; the only other orange control is the
// Extra-Work FAB, which lives on the full-screen Job Card that covers the tabs, so the two are never
// on screen together). Labels are ALWAYS shown; they grow the bar at fontScale 2.0 (UX-DR2).
//
// Still an absolute overlay that MEASURES its height (onLayout → bottomBarSpace) so tab screens pad
// their content clear of it; the measured height also positions the FAB just above the bar. Hidden
// under the open keyboard (UX-DR8). Structurally typed against the react-navigation tabBar contract.
//
// The consuming app supplies its destinations (`items`, labels already translated) and the floating
// action (`primaryAction`); the bar, the FAB and the re-entrancy guard live here.
interface ScreenFooterProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
  /** The destinations in bar order: the tab route name, its icon and its translated label. */
  items: FooterItem[];
  /** The floating action above the bar: its translated a11y label and what a press does. */
  primaryAction: { label: string; onPress: () => void };
}

interface FooterItem {
  name: string;
  icon: IconName;
  label: string;
}

// Re-entrancy guard so a fast double-tap can't stack two New sheets. Module-scoped: it must
// survive the footer re-mounting when the keyboard hides.
let primaryActionTapAt = 0;

function DestinationTab({
  name,
  icon,
  label,
  active,
  onPress,
}: { name: string; icon: IconName; label: string; active: boolean; onPress: () => void }) {
  const tint = active
    ? 'text-link dark:text-link-dark'
    : 'text-ink-secondary dark:text-ink-secondary-dark';
  return (
    <Pressable
      testID={`tab-${name}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className="min-h-[56px] flex-1 items-center justify-center gap-1 px-0.5 py-1.5"
    >
      {/* M3-style active indicator: a tinted pill BEHIND THE ICON (a shape, not colour alone — UX-DR6)
          while the label below keeps the full slot width. The highlight is a SEPARATE layer with a
          CONSTANT className that simply mounts when active — NOT a conditional `bg` toggled on the
          icon container. That matters: toggling any class on an element that also carries a rounded
          background makes NativeWind re-render its corners SQUARE on a tab switch; a highlight whose
          className never churns keeps its radius. */}
      <View className="h-9 items-center justify-center px-4">
        {active ? (
          <View className="absolute inset-0 rounded-full bg-primary/10 dark:bg-primary-dark/15" />
        ) : null}
        <Icon name={icon} size={22} className={tint} />
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        className={`w-full text-center font-meta text-meta ${tint}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ScreenFooter({ state, navigation, items, primaryAction }: ScreenFooterProps) {
  const insets = useSafeAreaInsets();
  const reportHeight = useReportBottomBarHeight();
  // Measured bar height (its own paddingBottom already carries the safe area) positions the FAB
  // just above it. Default ~72 so the FAB lands right on the first frame, before onLayout fires.
  const [barHeight, setBarHeight] = useState(72);
  // Hidden under the open keyboard (UX-DR8). Full-screen flows are root-Stack pushes that cover the
  // tabs — no per-route logic needed here.
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  if (keyboardOpen) {
    return null;
  }

  const activeName = state.routes[state.index]?.name;

  // The guard stops a fast double-tap stacking two sheets (VAPP-81).
  const pressPrimaryAction = () => {
    const now = Date.now();
    if (now - primaryActionTapAt < 600) {
      return;
    }
    primaryActionTapAt = now;
    primaryAction.onPress();
  };

  return (
    <>
      {/* Floating New-job FAB (brand mock): orange = capture, bottom-right, floating just above the
          bar. Same silhouette as the Extra-Work FAB (a 64 px orange circle, dark glyph both modes). */}
      <Pressable
        testID="tab-new"
        accessibilityRole="button"
        accessibilityLabel={primaryAction.label}
        onPress={pressPrimaryAction}
        style={{ position: 'absolute', right: 16, bottom: barHeight + 12, zIndex: 10, elevation: 8 }}
        className="h-16 w-16 items-center justify-center rounded-full border border-on-accent/10 bg-accent active:opacity-90 dark:border-on-accent-dark/10 dark:bg-accent-dark"
      >
        <Icon name="plus" size={30} className="text-on-accent dark:text-on-accent-dark" />
      </Pressable>
      <View
        testID="bottom-bar"
        className="absolute inset-x-0 bottom-0 border-t border-border-hairline bg-surface-raised dark:border-border-hairline-dark dark:bg-surface-raised-dark"
        style={{ paddingBottom: insets.bottom }}
        // Measured occupied zone (bar height + safe-area) feeds the screens' clearance AND the FAB's
        // offset — fixed paddings under-clear on tall-nav / fontScale-2.0 devices (VAPP-78).
        onLayout={(event) => {
          const height = event.nativeEvent.layout.height;
          setBarHeight(height);
          reportHeight(height);
        }}
      >
        <View className="flex-row items-stretch">
          {items.map((item) => (
            <DestinationTab
              key={item.name}
              name={item.name}
              icon={item.icon}
              label={item.label}
              active={activeName === item.name}
              onPress={() => navigation.navigate(item.name)}
            />
          ))}
        </View>
      </View>
    </>
  );
}
