import { Pressable, Text, View } from 'react-native';

// Underline tab bar (VAPP-77): a reusable in-screen segmented control — one selected, a 2 dp azure
// underline carries "active" so it is never colour-alone, with an optional count badge. The chase
// queue (To approve / Decided) is the first consumer; the shape is generic (label + key + badge).
export interface SegmentedTab {
  key: string;
  label: string;
  /** Optional count shown as a small pill after the label; omitted or 0 hides it. */
  badge?: number;
}

export function SegmentedTabs({
  tabs,
  activeKey,
  onChange,
  testID,
}: {
  tabs: readonly SegmentedTab[];
  activeKey: string;
  onChange: (key: string) => void;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      className="flex-row border-b border-border-hairline dark:border-border-hairline-dark"
    >
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            testID={testID ? `${testID}-${tab.key}` : undefined}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            onPress={() => onChange(tab.key)}
            className={`min-h-[48px] flex-1 flex-row items-center justify-center gap-2 border-b-2 px-4 ${
              active ? 'border-primary dark:border-primary-dark' : 'border-transparent'
            }`}
          >
            <Text
              className={`font-body text-body ${
                active ? 'text-link dark:text-link-dark' : 'text-ink-secondary dark:text-ink-secondary-dark'
              }`}
            >
              {tab.label}
            </Text>
            {tab.badge !== undefined && tab.badge > 0 ? (
              <View className="min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-2 dark:bg-primary-dark/15">
                <Text className="font-meta text-meta tabular-nums text-link dark:text-link-dark">
                  {tab.badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
