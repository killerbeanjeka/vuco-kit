import { fireEvent, render, screen } from '@testing-library/react-native';
import { createRef } from 'react';
import { Text, type TextInput } from 'react-native';

import { createI18n } from '../../src/i18n';
import { ActionChip } from '../../src/ui/ActionChip';
import { ActionRow } from '../../src/ui/ActionRow';
import { Banner } from '../../src/ui/Banner';
import { ButtonPrimary } from '../../src/ui/ButtonPrimary';
import { ButtonSecondary } from '../../src/ui/ButtonSecondary';
import { ChoiceChip } from '../../src/ui/ChoiceChip';
import { ExplainerCard } from '../../src/ui/ExplainerCard';
import { Input } from '../../src/ui/Input';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { SegmentedTabs } from '../../src/ui/SegmentedTabs';
import { Sheet } from '../../src/ui/Sheet';

jest.mock('expo-router', () => ({
  router: { canGoBack: jest.fn(() => true), back: jest.fn(), replace: jest.fn() },
}));

describe('ActionRow (VAPP-72 activation row: done ⟶ disabled ⟶ actionable)', () => {
  it('actionable: a button whose label reads title, subtitle and CTA, and that fires onPress', async () => {
    const onPress = jest.fn();
    await render(
      <ActionRow
        testID="row"
        icon="receipt-text-outline"
        title="Send your first invoice"
        subtitle="Straight from a finished job"
        ctaLabel="Start"
        onPress={onPress}
      />,
    );
    const row = screen.getByTestId('row');
    expect(row.props.accessibilityRole).toBe('button');
    expect(row.props.accessibilityState).toMatchObject({ disabled: false });
    expect(row.props.accessibilityLabel).toBe('Send your first invoice, Straight from a finished job, Start');
    expect(screen.getByText('Start')).toBeOnTheScreen();
    await fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('done: not pressable, the done word in its label, no CTA', async () => {
    const onPress = jest.fn();
    await render(
      <ActionRow
        testID="row"
        icon="briefcase-outline"
        title="First job created"
        ctaLabel="Start"
        done
        doneLabel="done"
        onPress={onPress}
      />,
    );
    const row = screen.getByTestId('row');
    expect(row.props.accessibilityRole).toBeUndefined();
    expect(row.props.accessibilityState).toMatchObject({ disabled: true });
    expect(row.props.accessibilityLabel).toBe('First job created, done');
    expect(screen.queryByText('Start')).toBeNull();
    await fireEvent.press(row);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('disabled (upcoming): not pressable and shows no CTA', async () => {
    const onPress = jest.fn();
    await render(
      <ActionRow
        testID="row"
        icon="receipt-text-outline"
        title="Send your first invoice"
        ctaLabel="Start"
        disabled
        onPress={onPress}
      />,
    );
    const row = screen.getByTestId('row');
    expect(row.props.accessibilityState).toMatchObject({ disabled: true });
    expect(row.props.accessibilityLabel).toBe('Send your first invoice');
    expect(screen.queryByText('Start')).toBeNull();
    await fireEvent.press(row);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('ButtonPrimary (UX-DR3: pill, pending progress-text, never icon-only)', () => {
  it('renders its label and fires onPress', async () => {
    const onPress = jest.fn();
    await render(<ButtonPrimary label="Continue" onPress={onPress} testID="btn" />);
    await fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Continue')).toBeOnTheScreen();
  });

  it('pending state swaps label to progress text and blocks presses', async () => {
    const onPress = jest.fn();
    await render(
      <ButtonPrimary label="Continue" pendingLabel="Saving…" pending onPress={onPress} testID="btn" />,
    );
    expect(screen.getByText('Saving…')).toBeOnTheScreen();
    expect(screen.queryByText('Continue')).toBeNull();
    await fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('btn').props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });

  it('disabled state blocks presses and exposes the state to TalkBack', async () => {
    const onPress = jest.fn();
    await render(<ButtonPrimary label="Continue" disabled onPress={onPress} testID="btn" />);
    await fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('btn').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('btn').props.accessibilityRole).toBe('button');
  });
});

describe('ButtonSecondary', () => {
  it('renders and fires onPress', async () => {
    const onPress = jest.fn();
    await render(<ButtonSecondary label="Not now" onPress={onPress} testID="btn2" />);
    await fireEvent.press(screen.getByTestId('btn2'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('btn2').props.accessibilityRole).toBe('button');
  });
});

describe('Input (always-visible label, never placeholder-as-label)', () => {
  it('shows its label unconditionally and forwards text changes', async () => {
    const onChangeText = jest.fn();
    await render(<Input label="Company name" placeholder="e.g. Muster GmbH" onChangeText={onChangeText} testID="inp" />);
    expect(screen.getByText('Company name')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('inp'), 'Vuco');
    expect(onChangeText).toHaveBeenCalledWith('Vuco');
  });

  it('renders a trailing affordance when provided', async () => {
    await render(<Input label="Notes" trailing={<Text testID="mic">m</Text>} />);
    expect(screen.getByTestId('mic')).toBeOnTheScreen();
  });
});

describe('Input — field states (Story 13.1: static caption above, petrol focus ring, inline error)', () => {
  it('shows the placeholder as the in-field prompt at all times (label lives above the field)', async () => {
    await render(<Input label="IBAN" placeholder="DE89 3704 …" testID="iban" />);
    // Story 13.1 (Add-time mock): the label is a small static caption ABOVE the field, so the
    // placeholder is a free in-field prompt — shown resting, focused, and blurred alike (never
    // gated on focus, the way the old floating-label field did).
    expect(screen.getByTestId('iban').props.placeholder).toBe('DE89 3704 …');
    await fireEvent(screen.getByTestId('iban'), 'focus');
    expect(screen.getByTestId('iban').props.placeholder).toBe('DE89 3704 …');
    await fireEvent(screen.getByTestId('iban'), 'blur');
    expect(screen.getByTestId('iban').props.placeholder).toBe('DE89 3704 …');
  });

  it('keeps the placeholder alongside a value (value wins visually, prompt prop stays set)', async () => {
    await render(<Input label="City" placeholder="e.g. Berlin" value="Berlin" onChangeText={jest.fn()} testID="city" />);
    expect(screen.getByTestId('city').props.placeholder).toBe('e.g. Berlin');
  });

  it('renders an inline error under the field with a caller-stable testID', async () => {
    await render(<Input label="IBAN" error="That IBAN looks off." errorTestID="iban-error" testID="iban" />);
    expect(screen.getByTestId('iban-error')).toHaveTextContent('That IBAN looks off.');
    // No error → no error node.
    await render(<Input label="Clean" errorTestID="clean-error" testID="clean" />);
    expect(screen.queryByTestId('clean-error')).toBeNull();
  });

  it('forwards its ref to the underlying TextInput (keyboard Next-chaining)', async () => {
    const ref = createRef<TextInput>();
    await render(<Input label="Postal" ref={ref} testID="postal" />);
    expect(ref.current).not.toBeNull();
    expect(typeof ref.current?.focus).toBe('function');
  });
});

describe('ExplainerCard (VAPP-74 reusable explainer)', () => {
  it('renders title + rows and fires the CTA and secondary', async () => {
    const onCta = jest.fn();
    const onSecondary = jest.fn();
    await render(
      <ExplainerCard
        testID="ex"
        icon="receipt-text-outline"
        title="One tax question"
        rows={[
          { icon: 'percent-outline', text: 'Row A' },
          { icon: 'shield-check-outline', text: 'Row B' },
        ]}
        ctaLabel="Choose now"
        onCta={onCta}
        secondaryLabel="What's §19?"
        onSecondary={onSecondary}
      >
        <Text testID="ex-note">disclosure</Text>
      </ExplainerCard>,
    );
    expect(screen.getByText('One tax question')).toBeOnTheScreen();
    expect(screen.getByText('Row A')).toBeOnTheScreen();
    expect(screen.getByText('Row B')).toBeOnTheScreen();
    expect(screen.getByTestId('ex-note')).toBeOnTheScreen(); // children (disclosure) rendered
    await fireEvent.press(screen.getByTestId('ex-cta'));
    expect(onCta).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('ex-secondary'));
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it('omits the secondary link when no handler is given', async () => {
    await render(
      <ExplainerCard
        testID="ex2"
        title="T"
        rows={[{ icon: 'percent-outline', text: 'R' }]}
        ctaLabel="Go"
        onCta={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('ex2-secondary')).toBeNull();
  });
});

describe('the VAPP-76 chip system (3 roles)', () => {
  it('ChoiceChip reflects selection, exposes it to a11y, and fires onPress', async () => {
    const onPress = jest.fn();
    await render(<ChoiceChip label="Labor" selected onPress={onPress} testID="cc" />);
    expect(screen.getByText('Labor')).toBeOnTheScreen();
    expect(screen.getByTestId('cc').props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByTestId('cc'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ActionChip renders its label + affordance and fires onPress', async () => {
    const onPress = jest.fn();
    await render(<ActionChip label="Due in 14 days" trailingIcon="swap-horizontal" onPress={onPress} testID="ac" />);
    expect(screen.getByText('Due in 14 days')).toBeOnTheScreen();
    expect(screen.getByTestId('ac').props.accessibilityRole).toBe('button');
    await fireEvent.press(screen.getByTestId('ac'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('Banner (VAPP-76 one caution surface)', () => {
  it('renders the message and an optional action', async () => {
    const onPress = jest.fn();
    await render(
      <Banner testID="bn" message="Two entries overlap." action={{ label: 'Fix', onPress, testID: 'bn-fix' }} />,
    );
    expect(screen.getByText('Two entries overlap.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('bn-fix'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('the assertive variant announces as an alert', async () => {
    await render(<Banner testID="bn" message="Conflict" assertive />);
    expect(screen.getByTestId('bn').props.accessibilityLiveRegion).toBe('assertive');
    expect(screen.getByTestId('bn').props.accessibilityRole).toBe('alert');
  });
});

describe('SegmentedTabs (VAPP-77 underline tabs)', () => {
  it('reflects the active tab, exposes selection to a11y, fires onChange, and shows a badge', async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedTabs
        testID="tabs"
        activeKey="pending"
        onChange={onChange}
        tabs={[
          { key: 'pending', label: 'To approve', badge: 3 },
          { key: 'decided', label: 'Decided' },
        ]}
      />,
    );
    expect(screen.getByText('To approve')).toBeOnTheScreen();
    expect(screen.getByText('3')).toBeOnTheScreen(); // badge
    expect(screen.getByTestId('tabs-pending').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('tabs-decided').props.accessibilityState).toMatchObject({ selected: false });
    await fireEvent.press(screen.getByTestId('tabs-decided'));
    expect(onChange).toHaveBeenCalledWith('decided');
  });
});

describe('Sheet', () => {
  it('renders children when visible and closes on backdrop press', async () => {
    const onClose = jest.fn();
    await render(
      <Sheet visible onClose={onClose} testID="sheet">
        <Text>Sheet content</Text>
      </Sheet>,
    );
    expect(screen.getByText('Sheet content')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when not visible', async () => {
    await render(
      <Sheet visible={false} onClose={jest.fn()}>
        <Text>Hidden content</Text>
      </Sheet>,
    );
    expect(screen.queryByText('Hidden content')).toBeNull();
  });
});

describe('ScreenHeader (the back / close words come from the kit namespace)', () => {
  // An app that ships none of these words itself: the kit supplies them.
  const i18n = createI18n({ resources: { en: {}, de: {} }, fallbackLng: 'en' });

  beforeAll(
    () =>
      new Promise<void>((resolve) => {
        if (i18n.isInitialized) {
          resolve();
        } else {
          i18n.on('initialized', () => resolve());
        }
      }),
  );

  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  it('labels the push control "Zurück" and the modal control "Schließen" in German', async () => {
    await i18n.changeLanguage('de');
    await render(<ScreenHeader testID="push" />);
    expect(screen.getByTestId('push').props.accessibilityLabel).toBe('Zurück');
    await render(<ScreenHeader variant="modal" testID="modal" />);
    expect(screen.getByTestId('modal').props.accessibilityLabel).toBe('Schließen');
  });

  it('labels them "Back" and "Close" in English', async () => {
    await i18n.changeLanguage('en');
    await render(<ScreenHeader testID="push" />);
    expect(screen.getByTestId('push').props.accessibilityLabel).toBe('Back');
    await render(<ScreenHeader variant="modal" testID="modal" />);
    expect(screen.getByTestId('modal').props.accessibilityLabel).toBe('Close');
  });
});
