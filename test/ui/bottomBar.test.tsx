import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Keyboard, Pressable, Text } from 'react-native';

import { BottomBarSpaceProvider, useBottomBarClearance, useReportBottomBarHeight } from '../../src/ui/bottomBarSpace';
import { type IconName } from '../../src/ui/icons';
import { ScreenFooter } from '../../src/ui/ScreenFooter';

// Story 3.1 / VAPP-80: full-width stretched bar — the app's destinations + a floating primary action,
// icons + labels always, active destination marked, hidden under the keyboard. The destinations and
// the action are synthetic: the kit knows no app's tabs; each app tests its own.

const ITEMS: { name: string; icon: IconName; label: string }[] = [
  { name: 'home', icon: 'target', label: 'Home' },
  { name: 'list', icon: 'briefcase-outline', label: 'List' },
  { name: 'account', icon: 'tune-variant', label: 'Account' },
];

function makeProps(activeIndex = 0) {
  return {
    state: {
      index: activeIndex,
      routes: ITEMS.map((item) => ({ key: `${item.name}-1`, name: item.name })),
    },
    navigation: { navigate: jest.fn() },
    items: ITEMS,
    primaryAction: { label: 'Create', onPress: jest.fn() },
  };
}

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('ScreenFooter (VAPP-80: full-width stretched bar)', () => {
  it('shows every label (never icon-only), marks the active destination and labels the floating action', async () => {
    const props = makeProps(1);
    await render(<ScreenFooter {...props} />);
    expect(screen.getByText('Home')).toBeOnTheScreen();
    expect(screen.getByText('List')).toBeOnTheScreen();
    expect(screen.getByText('Account')).toBeOnTheScreen();
    expect(screen.getByTestId('tab-list').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('tab-home').props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.getByTestId('tab-new').props.accessibilityLabel).toBe('Create');
  });

  it('destination taps navigate within the tab navigator, so the bar stays put', async () => {
    const props = makeProps(0);
    await render(<ScreenFooter {...props} />);
    await fireEvent.press(screen.getByTestId('tab-account'));
    expect(props.navigation.navigate).toHaveBeenCalledWith('account');
    await fireEvent.press(screen.getByTestId('tab-list'));
    expect(props.navigation.navigate).toHaveBeenCalledWith('list');
    expect(props.primaryAction.onPress).not.toHaveBeenCalled();
  });

  // VAPP-81: a fast double-tap must not stack two sheets. The only test in this file that presses the
  // floating action. The guard is module-scoped, so its clock is pinned — in the past: the guard this
  // test leaves behind then never swallows a later press in this file, which a future pin would do for
  // as long as that future is ahead of the real clock.
  it('two presses within 600 ms run primaryAction.onPress exactly once (re-entrancy guard)', async () => {
    const props = makeProps(0);
    const start = Date.now() - 60_000;
    const now = jest.spyOn(Date, 'now').mockReturnValue(start);
    await render(<ScreenFooter {...props} />);
    await fireEvent.press(screen.getByTestId('tab-new'));
    expect(props.primaryAction.onPress).toHaveBeenCalledTimes(1);
    now.mockReturnValue(start + 599);
    await fireEvent.press(screen.getByTestId('tab-new'));
    expect(props.primaryAction.onPress).toHaveBeenCalledTimes(1);
    now.mockReturnValue(start + 600);
    await fireEvent.press(screen.getByTestId('tab-new'));
    expect(props.primaryAction.onPress).toHaveBeenCalledTimes(2);
  });

  // VAPP-80: the OLD floating pill needed box-none to pass its empty side-areas' taps through to
  // the content beneath it. The stretched edge-to-edge bar covers the whole bottom strip, so it is
  // a normal docked surface that captures taps across its full width — box-none would now be a bug
  // (a tap on the bar's safe-area padding would fall through to content scrolled under it). Tab
  // content is kept clear of the bar by the measured-clearance contract (pinned below), not by
  // pass-through. Read prop OR style — RN is migrating pointerEvents into `style`.
  it('VAPP-80: the full-width bar is a docked surface, not a box-none pass-through overlay', async () => {
    await render(<ScreenFooter {...makeProps(0)} />);
    const wrapper = screen.getByTestId('bottom-bar');
    const style = Array.isArray(wrapper.props.style)
      ? Object.assign({}, ...wrapper.props.style.filter(Boolean))
      : (wrapper.props.style ?? {});
    expect(wrapper.props.pointerEvents ?? style.pointerEvents).toBeUndefined();
  });

  it('hides under the open keyboard and returns when it closes (UX-DR8)', async () => {
    const listeners: Record<string, () => void> = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, callback: () => void) => {
      listeners[event] = callback;
      return { remove: jest.fn() };
    }) as unknown as typeof Keyboard.addListener);

    await render(<ScreenFooter {...makeProps(0)} />);
    expect(screen.getByTestId('bottom-bar')).toBeOnTheScreen();
    await act(async () => listeners['keyboardDidShow']());
    expect(screen.queryByTestId('bottom-bar')).toBeNull();
    await act(async () => listeners['keyboardDidHide']());
    expect(screen.getByTestId('bottom-bar')).toBeOnTheScreen();
  });
});

// VAPP-78 regression: the floating bar reserves no layout height, so tab screens MUST pad their scroll
// content by the bar's MEASURED occupied zone — a fixed padding under-clears on 3-button-nav / large
// fontScale (the class the occlusion bug lives in). The bar reports its height; screens read the
// clearance; it never drops below the fallback nor shrinks mid-session.
//
// Two tests below, complementary: the ClearanceProbe pins the provider MATH in isolation (fallback,
// +8, never-shrink); the "REAL bar" test pins the WIRING — that ScreenFooter's onLayout actually feeds a
// consumer — a path the synthetic probe deliberately bypasses.
function ClearanceProbe() {
  const clearance = useBottomBarClearance();
  const report = useReportBottomBarHeight();
  return (
    <>
      <Text testID="clearance">{clearance}</Text>
      <Pressable testID="report-160" onPress={() => report(160)}>
        <Text>report 160</Text>
      </Pressable>
      <Pressable testID="report-40" onPress={() => report(40)}>
        <Text>report 40</Text>
      </Pressable>
    </>
  );
}

describe('bottom-bar clearance (VAPP-78: measured, never under-clears)', () => {
  it('starts at the fallback, grows to the measured height + breathing room, and never shrinks', async () => {
    await render(
      <BottomBarSpaceProvider>
        <ClearanceProbe />
      </BottomBarSpaceProvider>,
    );
    // Fallback before any measurement — always a positive clearance, never 0.
    expect(screen.getByTestId('clearance')).toHaveTextContent('112');
    // A measured bar taller than the fallback wins (160 + 8 dp breathing room).
    await fireEvent.press(screen.getByTestId('report-160'));
    expect(screen.getByTestId('clearance')).toHaveTextContent('168');
    // A later smaller measurement never shrinks the reserved space mid-session (the Math.max guard).
    await fireEvent.press(screen.getByTestId('report-40'));
    expect(screen.getByTestId('clearance')).toHaveTextContent('168');
  });

  it('the REAL bar carries its measured height into a consumer on layout (onLayout → clearance)', async () => {
    function Consumer() {
      const clearance = useBottomBarClearance();
      return <Text testID="consumer-clearance">{clearance}</Text>;
    }
    await render(
      <BottomBarSpaceProvider>
        <ScreenFooter {...makeProps(0)} />
        <Consumer />
      </BottomBarSpaceProvider>,
    );
    // Before any layout fires, the consumer sees the fallback (onLayout does not fire in RNTL by itself).
    expect(screen.getByTestId('consumer-clearance')).toHaveTextContent('112');
    // Fire the layout event the native side raises on the bar wrapper — the ONLY path that carries the
    // measured overlay height into the clearance (BottomBar.onLayout → reportHeight → provider).
    await act(async () => {
      fireEvent(screen.getByTestId('bottom-bar'), 'layout', {
        nativeEvent: { layout: { height: 150, width: 320, x: 0, y: 0 } },
      });
    });
    // 150 measured + 8 breathing room reaches the consumer. Reading layout.width instead of .height,
    // or dropping the onLayout binding on the bar, leaves this at 112 → reds.
    expect(screen.getByTestId('consumer-clearance')).toHaveTextContent('158');
  });
});
