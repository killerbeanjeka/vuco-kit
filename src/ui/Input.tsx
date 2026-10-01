import { forwardRef, useState, type ReactNode } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { DARK_TREATMENT, useDarkTreatment } from './darkTreatment';

interface InputProps extends Omit<TextInputProps, 'className'> {
  /** Field label — a small uppercase caption ABOVE the field, and the field's a11y name. */
  label: string;
  /** Trailing affordance slot (e.g. the dictation control when a consumer needs it). */
  trailing?: ReactNode;
  /**
   * Inline validation error. Renders under the field and switches the border to
   * `status-overdue` — text + colour, never colour alone (DESIGN.md).
   */
  error?: string;
  /** testID for the inline error Text, so a screen can keep a stable selector for it. */
  errorTestID?: string;
  testID?: string;
}

// input (Story 13.1 Add-time mock): a small UPPERCASE label above a NEUTRAL field. The fill is the
// clean `surface-raised` neutral (white in light, a subtle raised dark in dark) — it NEVER changes
// on focus; the focused field wears only the petrol focus RING (border → focus-ring). "Fields stay
// neutral, the focused field wears the petrol focus ring." The 1.5dp boundary is always present
// (sunlight visibility). The placeholder is the in-field prompt; an error switches the border and
// adds a message below (text + colour, never colour alone). Under the dark treatment (kit 0.7.0) the field
// shows its dark-mode look in both themes.
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, trailing, error, errorTestID, testID, onFocus, onBlur, value, placeholder, ...textInputProps },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const dark = useDarkTreatment();
  const look = DARK_TREATMENT.input;
  const hasError = Boolean(error);
  const borderClass = hasError
    ? dark
      ? look.borderError
      : 'border-status-overdue dark:border-status-overdue-dark'
    : focused
      ? dark
        ? look.borderFocused
        : 'border-focus-ring dark:border-focus-ring-dark'
      : dark
        ? look.border
        : 'border-border-input dark:border-border-input-dark';
  const labelColor = hasError
    ? dark
      ? look.labelError
      : 'text-status-overdue-text dark:text-status-overdue-text-dark'
    : dark
      ? look.label
      : 'text-ink-secondary dark:text-ink-secondary-dark';
  const fill = dark ? look.fill : 'bg-surface-raised dark:bg-surface-raised-dark';
  const textColor = dark
    ? look.text
    : 'text-ink-primary placeholder:text-ink-secondary dark:text-ink-primary-dark dark:placeholder:text-ink-secondary-dark';

  return (
    <View className="w-full gap-1.5">
      {/* Small static uppercase caption — no line clamp: at large fontScale a long label wraps,
          never ellipsizes (it is the field's only name besides the a11y label). */}
      <Text className={`font-meta text-meta uppercase ${labelColor}`}>{label}</Text>
      <View
        className={`min-h-[56px] w-full flex-row items-center rounded-md border-[1.5px] px-4 ${fill} ${borderClass}`}
      >
        <TextInput
          ref={ref}
          testID={testID}
          accessibilityLabel={label}
          value={value}
          // The label lives above, so the placeholder is a free in-field prompt (always shown).
          placeholder={placeholder}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          className={`flex-1 font-field text-field ${textColor}`}
          {...textInputProps}
        />
        {trailing}
      </View>
      {hasError ? (
        // Announce to TalkBack the moment it appears: the field owns its error, so a screen-reader
        // user focused on the input hears the message without leaving the field.
        <Text
          testID={errorTestID}
          accessibilityLiveRegion="polite"
          className={`font-body text-meta ${dark ? look.error : 'text-status-overdue-text dark:text-status-overdue-text-dark'}`}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
});
