import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View, type ModalProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DARK_TREATMENT, DarkTreatment, useDarkTreatment } from './darkTreatment';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  testID?: string;
  /**
   * The dark treatment (kit 0.7.0): the scrim, the panel and every kit primitive inside the sheet take their
   * `-dark` tokens in both themes, as over a camera. A sheet inside `DarkTreatment` takes it too.
   */
  dark?: boolean;
  /** How the sheet comes and goes: `'slide'` by default, `'none'` on a surface where nothing animates (kit 0.7.0). */
  animationType?: ModalProps['animationType'];
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
// Under the dark treatment (kit 0.7.0) it shows its dark-mode chrome in both themes, and its children render
// inside DarkTreatment.
export function Sheet({ visible, onClose, children, testID, dark = false, animationType = 'slide' }: SheetProps) {
  const insets = useSafeAreaInsets();
  // The backdrop's word comes from the kit namespace, as ScreenHeader's does, so it follows the app language.
  const { t } = useTranslation('kit');
  const treated = useDarkTreatment() || dark;
  return (
    <Modal visible={visible} transparent animationType={animationType} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end"
      >
        {/* Scrim derives from the ink-primary token (no raw palette colors — AR-20);
            deeper opacity in dark mode so the sheet still separates on true-dark. */}
        <Pressable
          testID={testID ? `${testID}-backdrop` : undefined}
          accessibilityRole="button"
          accessibilityLabel={t('close')}
          className={treated ? DARK_TREATMENT.sheet.scrim : SHEET_SCRIM_CLASSES}
          onPress={onClose}
        />
        <View
          testID={testID}
          style={{ paddingBottom: Math.max(insets.bottom, 24) }}
          className={`${treated ? DARK_TREATMENT.sheet.panel : SHEET_PANEL_CLASSES} pt-4`}
        >
          {treated ? <DarkTreatment>{children}</DarkTreatment> : children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
