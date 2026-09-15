import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  testID?: string;
}

// Single source for the DESIGN.md sheet chrome — consumed here AND by
// route-based sheet surfaces (new-job's transparentModal), so the spec can
// never drift between copies (3.1 review fix).
export const SHEET_SCRIM_CLASSES = 'absolute inset-0 bg-ink-primary/40 dark:bg-ink-primary/60';
export const SHEET_PANEL_CLASSES =
  'rounded-t-xl bg-surface-raised px-4 shadow-lg dark:border-t dark:border-border-hairline-dark dark:bg-surface-raised-dark dark:shadow-none';

// sheet (DESIGN.md): bottom sheet on surface-raised, top radius xl (24).
// Light mode floats on a soft shadow; dark mode carries NO shadow — a
// border-hairline-dark top edge separates it tonally instead (dual-mode rule).
// Safe-area bottom inset + keyboard avoidance added at first real consumer
// (Story 2.2 sign-in — closing the 2.1 deferred-work item).
export function Sheet({ visible, onClose, children, testID }: SheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end"
      >
        {/* Scrim derives from the ink-primary token (no raw palette colors — AR-20);
            deeper opacity in dark mode so the sheet still separates on true-dark. */}
        <Pressable
          testID={testID ? `${testID}-backdrop` : undefined}
          accessibilityRole="button"
          accessibilityLabel="Close"
          className={SHEET_SCRIM_CLASSES}
          onPress={onClose}
        />
        <View
          testID={testID}
          style={{ paddingBottom: Math.max(insets.bottom, 24) }}
          className={`${SHEET_PANEL_CLASSES} pt-4`}
        >
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
