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
import { DARK_TREATMENT, DarkTreatment, useDarkTreatment } from '../../src/ui/darkTreatment';
import { ExplainerCard } from '../../src/ui/ExplainerCard';
import { ICON_NAMES, Icon } from '../../src/ui/icons';
import { Input } from '../../src/ui/Input';
import { OptionRow } from '../../src/ui/OptionRow';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { SegmentedTabs } from '../../src/ui/SegmentedTabs';
import { SHEET_PANEL_CLASSES, SHEET_SCRIM_CLASSES, Sheet } from '../../src/ui/Sheet';

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

  it('gives the secondary link a touch target of at least 48 dp', async () => {
    await render(
      <ExplainerCard
        testID="ex3"
        title="T"
        rows={[{ icon: 'percent-outline', text: 'R' }]}
        ctaLabel="Go"
        onCta={jest.fn()}
        secondaryLabel="Later"
        onSecondary={jest.fn()}
      />,
    );
    // NativeWind does not compile classes under Jest: the rendered class is what the device lays out.
    const minHeight = /(?:^|\s)min-h-\[(\d+)px\](?:\s|$)/.exec(screen.getByTestId('ex3-secondary').props.className);
    expect(Number(minHeight?.[1])).toBeGreaterThanOrEqual(48);
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

  it('ActionChip reads its accessibilityLabel when given, and its label when left out (kit 0.6.0)', async () => {
    await render(
      <>
        <ActionChip
          label="New location here"
          accessibilityLabel="New location in Flat 4"
          leadingIcon="plus"
          onPress={jest.fn()}
          testID="ac-labelled"
        />
        <ActionChip label="Due in 14 days" onPress={jest.fn()} testID="ac-plain" />
      </>,
    );
    expect(screen.getByText('New location here')).toBeOnTheScreen();
    expect(screen.getByTestId('ac-labelled').props.accessibilityLabel).toBe('New location in Flat 4');
    expect(screen.getByTestId('ac-plain').props.accessibilityLabel).toBe('Due in 14 days');
  });
});

describe('OptionRow (a radio row of a picker)', () => {
  it('reads its label, its checked state, and fires onPress', async () => {
    const onPress = jest.fn();
    await render(<OptionRow label="Kitchen" selected onPress={onPress} testID="or" />);
    expect(screen.getByText('Kitchen')).toBeOnTheScreen();
    const row = screen.getByTestId('or');
    expect(row.props.accessibilityRole).toBe('radio');
    expect(row.props.accessibilityLabel).toBe('Kitchen');
    expect(row.props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('reads its accessibilityLabel when given, and still shows the label (kit 0.6.0)', async () => {
    await render(
      <OptionRow label="Kitchen" accessibilityLabel="Kitchen, in Flat 4" selected={false} onPress={jest.fn()} testID="or" />,
    );
    expect(screen.getByText('Kitchen')).toBeOnTheScreen();
    expect(screen.getByTestId('or').props.accessibilityLabel).toBe('Kitchen, in Flat 4');
    expect(screen.getByTestId('or').props.accessibilityState).toMatchObject({ checked: false });
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

describe('The kit namespace words (ScreenHeader back / close, Sheet backdrop)', () => {
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

  it('labels the Sheet backdrop with the same word: "Schließen" in German', async () => {
    await i18n.changeLanguage('de');
    await render(
      <Sheet visible onClose={jest.fn()} testID="sheet-de">
        <Text>Inhalt</Text>
      </Sheet>,
    );
    expect(screen.getByTestId('sheet-de-backdrop').props.accessibilityLabel).toBe('Schließen');
  });

  it('labels the Sheet backdrop "Close" in English', async () => {
    await i18n.changeLanguage('en');
    await render(
      <Sheet visible onClose={jest.fn()} testID="sheet-en">
        <Text>Content</Text>
      </Sheet>,
    );
    expect(screen.getByTestId('sheet-en-backdrop').props.accessibilityLabel).toBe('Close');
  });
});

describe('Icon names (kit 0.4.0 adds camera, map marker, share, image, undo and draw; 0.5.0 the menu and reorder glyphs; 0.6.0 move and copy; 0.7.0 the calendar; 0.8.0 the bookmarks)', () => {
  it('lists every name once, and each is a MaterialCommunityIcons glyph', () => {
    const { glyphMap } = Icon as unknown as { glyphMap: Record<string, number> };
    expect(ICON_NAMES.filter((name) => !(name in glyphMap))).toEqual([]);
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
    expect(ICON_NAMES).toEqual(
      expect.arrayContaining(['camera-outline', 'map-marker-outline', 'share-variant-outline', 'image-outline', 'undo', 'draw']),
    );
    expect(ICON_NAMES).toEqual(
      expect.arrayContaining(['dots-vertical', 'drag-horizontal-variant', 'arrow-up', 'arrow-down', 'delete-outline']),
    );
    expect(ICON_NAMES).toEqual(expect.arrayContaining(['arrow-right', 'content-copy']));
    expect(ICON_NAMES).toEqual(expect.arrayContaining(['calendar-outline']));
    expect(ICON_NAMES).toEqual(
      expect.arrayContaining(['bookmark-outline', 'bookmark-plus-outline', 'bookmark-remove-outline']),
    );
  });
});

describe('ActionChip without its trailing icon (kit 0.7.0)', () => {
  const { glyphMap } = Icon as unknown as { glyphMap: Record<string, number> };
  const glyph = (name: string) => String.fromCodePoint(glyphMap[name]);
  /** The glyphs and words the chip shows, in order. */
  const shown = (testID: string) =>
    screen
      .getByTestId(testID)
      .children.map((child) => (typeof child === 'string' ? child : child.children.join('')));

  it('shows the chevron when left out, the given icon when named, and none for null', async () => {
    await render(
      <>
        <ActionChip label="Terms" onPress={jest.fn()} testID="default" />
        <ActionChip label="Language" trailingIcon="swap-horizontal" onPress={jest.fn()} testID="swap" />
        <ActionChip label="Tiler" leadingIcon="tag-outline" trailingIcon={null} onPress={jest.fn()} testID="none" />
      </>,
    );
    expect(shown('default')).toEqual(['Terms', glyph('chevron-right')]);
    expect(shown('swap')).toEqual(['Language', glyph('swap-horizontal')]);
    expect(shown('none')).toEqual([glyph('tag-outline'), 'Tiler']);
  });

  it('lets a long label shrink and wrap inside the pill, so the trailing icon stays in it', async () => {
    await render(<ActionChip label="Block A › Floor 1 › Kitchen › Splashback" leadingIcon="map-marker-outline" onPress={jest.fn()} />);
    expect(screen.getByText('Block A › Floor 1 › Kitchen › Splashback').props.className).toMatch(/(^|\s)shrink(\s|$)/);
  });
});

describe('Sheet animationType (kit 0.7.0)', () => {
  /** The Modal the sheet renders. */
  const modal = () => {
    const [found] = screen.container.queryAll((node) => node.type === 'Modal');
    return found;
  };

  it('slides by default, and takes "none" for a surface where nothing animates', async () => {
    const view = await render(
      <Sheet visible onClose={jest.fn()} testID="sheet">
        <Text>Content</Text>
      </Sheet>,
    );
    expect(modal().props.animationType).toBe('slide');
    await view.rerender(
      <Sheet visible onClose={jest.fn()} testID="sheet" animationType="none">
        <Text>Content</Text>
      </Sheet>,
    );
    expect(modal().props.animationType).toBe('none');
  });
});

describe('The dark treatment (kit 0.7.0)', () => {
  const { colors } = jest.requireActual<{ theme: { colors: Record<string, unknown> } }>(
    '../../tokens/out/vuco/nativewind-theme.cjs',
  ).theme;
  // The colour tokens with a -dark twin: outside the treatment each is paired with it, inside it only the twin shows.
  const dualMode = new Set(Object.keys(colors).filter((name) => `${name}-dark` in colors));

  /** Every primitive the treatment covers, in each state that has its own colours. */
  function primitives() {
    return (
      <>
        <Input label="Title" value="Cracked tile" onChangeText={jest.fn()} testID="input" />
        <Input label="Due date" error="Enter the date as DD/MM/YYYY" errorTestID="input-error" testID="input-invalid" />
        <ChoiceChip label="High" selected onPress={jest.fn()} testID="chip-selected" />
        <ChoiceChip label="Low" selected={false} onPress={jest.fn()} testID="chip" />
        <ActionChip label="Trade" leadingIcon="tag-outline" onPress={jest.fn()} testID="action" />
        <OptionRow label="Kitchen" selected onPress={jest.fn()} testID="row-selected" />
        <OptionRow label="Bathroom" selected={false} onPress={jest.fn()} grouped divider testID="row-grouped" />
        <OptionRow label="Hall" selected={false} onPress={jest.fn()} testID="row" />
        <ButtonPrimary label="Save and next" onPress={jest.fn()} chevron testID="primary" />
        <ButtonPrimary label="Save" disabled onPress={jest.fn()} testID="primary-disabled" />
        <ButtonSecondary label="Done with item" onPress={jest.fn()} testID="secondary" />
        <ButtonSecondary label="Delete" variant="danger" onPress={jest.fn()} testID="secondary-danger" />
        <ButtonSecondary label="Copy" disabled onPress={jest.fn()} testID="secondary-disabled" />
      </>
    );
  }

  /** The class strings of the rendered tree, the sheet's scrim left out (checked on its own). */
  function classNames(): string[] {
    return screen.container
      .queryAll((node) => typeof node.props.className === 'string' && node.props.testID !== 'sheet-backdrop')
      .map((node) => node.props.className as string);
  }

  /** The colour token a class names (`dark:placeholder:text-ink-secondary-dark` gives `ink-secondary-dark`), or null. */
  function tokenOf(cls: string): string | null {
    const utility = cls.split(':').at(-1) ?? '';
    return /^(?:text|bg|border)-(.+?)(?:\/\d+)?$/.exec(utility)?.[1] ?? null;
  }

  /** Classes that follow the app theme or show a light token: none may be left inside the treatment. */
  function themeBound(className: string): string[] {
    return className
      .split(/\s+/)
      .filter((cls) => cls.split(':').includes('dark') || dualMode.has(tokenOf(cls) ?? ''));
  }

  /** Light tokens without their dark: twin in the same string: none may be left outside the treatment. */
  function unpaired(className: string): string[] {
    const classes = className.split(/\s+/).filter(Boolean);
    return classes.filter((cls) => {
      const variants = cls.split(':').slice(0, -1);
      const kind = /^(text|bg|border)-/.exec(cls.split(':').at(-1) ?? '')?.[1];
      const token = tokenOf(cls);
      if (variants.includes('dark') || kind === undefined || token === null || !dualMode.has(token)) {
        return false;
      }
      // The twin is the -dark token under the same variants, at any opacity (`bg-primary/10 dark:bg-primary-dark/15`).
      const chain = variants.map((variant) => `${variant}:`).join('');
      const twin = new RegExp(`^(?:dark:${chain}|${chain}dark:)${kind}-${token}-dark(?:/\\d+)?$`);
      return !classes.some((other) => twin.test(other));
    });
  }

  it('leaves every primitive in its paired classes outside the treatment', async () => {
    await render(primitives());

    const names = classNames();
    expect(names.flatMap(unpaired)).toEqual([]);
    // Every coloured class string carries its dark: twins, so the app theme still picks the mode.
    expect(names.filter((name) => /\b(text|bg|border)-/.test(name) && !name.includes('dark:'))).toEqual([]);
    expect(screen.getByTestId('input').props.className).toContain(
      'text-ink-primary placeholder:text-ink-secondary dark:text-ink-primary-dark dark:placeholder:text-ink-secondary-dark',
    );
  });

  it('renders every primitive inside DarkTreatment in its -dark tokens alone, whatever the app theme', async () => {
    await render(<DarkTreatment>{primitives()}</DarkTreatment>);

    expect(classNames().flatMap(themeBound)).toEqual([]);
    // Each state shows its dark-mode look.
    const field = screen.getByTestId('input').parent?.props.className as string;
    expect(screen.getByTestId('input').props.className).toContain(DARK_TREATMENT.input.text);
    expect(field).toContain(DARK_TREATMENT.input.fill);
    expect(field).toContain(DARK_TREATMENT.input.border);
    expect(screen.getByTestId('input-invalid').parent?.props.className).toContain(DARK_TREATMENT.input.borderError);
    expect(screen.getByTestId('input-error').props.className).toContain(DARK_TREATMENT.input.error);
    expect(screen.getByText('Due date').props.className).toContain(DARK_TREATMENT.input.labelError);
    expect(screen.getByText('Title').props.className).toContain(DARK_TREATMENT.input.label);
    expect(screen.getByTestId('chip-selected').props.className).toContain(DARK_TREATMENT.choiceChip.selected);
    expect(screen.getByText('High').props.className).toContain(DARK_TREATMENT.choiceChip.labelSelected);
    expect(screen.getByTestId('chip').props.className).toContain(DARK_TREATMENT.choiceChip.unselected);
    expect(screen.getByText('Low').props.className).toContain(DARK_TREATMENT.choiceChip.label);
    expect(screen.getByTestId('action').props.className).toContain(DARK_TREATMENT.actionChip.border);
    expect(screen.getByText('Trade').props.className).toContain(DARK_TREATMENT.actionChip.label);
    expect(screen.getByTestId('row-selected').props.className).toContain(DARK_TREATMENT.optionRow.selected);
    expect(screen.getByText('Kitchen').props.className).toContain(DARK_TREATMENT.optionRow.labelSelected);
    expect(screen.getByTestId('row-grouped').props.className).toContain(DARK_TREATMENT.optionRow.divider);
    expect(screen.getByTestId('row').props.className).toContain(DARK_TREATMENT.optionRow.unselected);
    expect(screen.getByText('Hall').props.className).toContain(DARK_TREATMENT.optionRow.label);
    expect(screen.getByTestId('primary').props.className).toContain(DARK_TREATMENT.buttonPrimary.fill);
    expect(screen.getByText('Save and next').props.className).toContain(DARK_TREATMENT.buttonPrimary.label);
    expect(screen.getByText('›').props.className).toContain(DARK_TREATMENT.buttonPrimary.label);
    expect(screen.getByTestId('primary-disabled').props.className).toContain(DARK_TREATMENT.buttonPrimary.fillDisabled);
    expect(screen.getByText('Save').props.className).toContain(DARK_TREATMENT.buttonPrimary.labelDisabled);
    expect(screen.getByTestId('secondary').props.className).toContain(DARK_TREATMENT.buttonSecondary.fill);
    expect(screen.getByText('Done with item').props.className).toContain(DARK_TREATMENT.buttonSecondary.label);
    expect(screen.getByTestId('secondary-danger').props.className).toContain(DARK_TREATMENT.buttonSecondary.fillDanger);
    expect(screen.getByText('Delete').props.className).toContain(DARK_TREATMENT.buttonSecondary.labelDanger);
    expect(screen.getByText('Copy').props.className).toContain(DARK_TREATMENT.buttonSecondary.labelDisabled);
  });

  it("rings a focused field in the focus ring's -dark twin under the treatment", async () => {
    await render(
      <DarkTreatment>
        <Input label="Title" testID="input" />
      </DarkTreatment>,
    );
    await fireEvent(screen.getByTestId('input'), 'focus');
    const field = screen.getByTestId('input').parent?.props.className as string;
    expect(field).toContain(DARK_TREATMENT.input.borderFocused);
    expect(themeBound(field)).toEqual([]);
  });

  it('puts a Sheet with `dark` in the treatment: its scrim, its panel and the primitives inside it', async () => {
    await render(
      <Sheet visible dark onClose={jest.fn()} testID="sheet">
        {primitives()}
      </Sheet>,
    );

    expect(screen.getByTestId('sheet-backdrop').props.className).toBe(DARK_TREATMENT.sheet.scrim);
    expect(screen.getByTestId('sheet').props.className).toBe(`${DARK_TREATMENT.sheet.panel} pt-4`);
    expect(classNames().flatMap(themeBound)).toEqual([]);
    expect(screen.getByTestId('chip-selected').props.className).toContain(DARK_TREATMENT.choiceChip.selected);
  });

  it('treats a Sheet inside DarkTreatment too, and leaves a plain Sheet in the app theme', async () => {
    const view = await render(
      <DarkTreatment>
        <Sheet visible onClose={jest.fn()} testID="sheet">
          <Input label="Title" testID="input" />
        </Sheet>
      </DarkTreatment>,
    );
    expect(screen.getByTestId('sheet').props.className).toBe(`${DARK_TREATMENT.sheet.panel} pt-4`);
    expect(classNames().flatMap(themeBound)).toEqual([]);

    await view.rerender(
      <Sheet visible onClose={jest.fn()} testID="sheet">
        <Input label="Title" testID="input" />
      </Sheet>,
    );
    expect(screen.getByTestId('sheet-backdrop').props.className).toBe(SHEET_SCRIM_CLASSES);
    expect(screen.getByTestId('sheet').props.className).toBe(`${SHEET_PANEL_CLASSES} pt-4`);
    expect(classNames().flatMap(unpaired)).toEqual([]);
  });

  it('is off outside the provider and on inside it', async () => {
    function Probe({ testID }: { testID: string }) {
      return <Text testID={testID}>{String(useDarkTreatment())}</Text>;
    }
    await render(
      <>
        <Probe testID="outside" />
        <DarkTreatment>
          <Probe testID="inside" />
        </DarkTreatment>
      </>,
    );
    expect(screen.getByTestId('outside')).toHaveTextContent('false');
    expect(screen.getByTestId('inside')).toHaveTextContent('true');
  });
});
