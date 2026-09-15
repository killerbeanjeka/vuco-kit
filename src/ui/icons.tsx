import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { cssInterop } from 'nativewind';

// Single icon family (matches the DESIGN.md mockups' stroke style). cssInterop
// lets icons take token classes (`text-link dark:text-link-dark`) so no
// hex value is ever hand-copied out of the theme (UX-DR1).
cssInterop(MaterialCommunityIcons, {
  className: {
    target: 'style',
    nativeStyleToProp: { color: true },
  },
});

export type IconName =
  | 'target'
  | 'briefcase-outline'
  | 'tune-variant'
  | 'plus'
  | 'cloud-check-outline'
  | 'shield-check-outline'
  | 'cellphone'
  // Story 6.1b: delivery failed. Icon + text, never colour alone (UX-DR6).
  | 'email-alert-outline'
  // Story 6.1d: delivery delayed (soft bounce) — caution, not catastrophe.
  | 'clock-outline'
  // Story 7.2: unresolved overpayment on the recently-paid tile. Icon + text (UX-DR6).
  | 'alert-circle-outline'
  // VAPP-71 grouped-activity states (icon + text per row, UX-DR6).
  | 'clock-alert-outline'
  | 'email-open-outline'
  | 'check-circle-outline'
  // VAPP-72 activation-checklist icons (invoice step + the locked/upcoming marker).
  | 'receipt-text-outline'
  | 'lock-outline'
  // VAPP-74 tax-fork explainer: the three benefit rows + the re-open affordance.
  | 'percent-outline'
  | 'swap-horizontal'
  | 'help-circle-outline'
  // VAPP-75 document-identity strip: tap-through affordance.
  | 'chevron-right'
  // VAPP-76 line-card delete affordance (icon-button top-right, not red inline text).
  | 'close'
  // VAPP-79 ScreenHeader: the single back affordance (push variant); 'close' above serves modals.
  | 'arrow-left'
  // VAPP-82 OptionRow selection check — a vector mark that replaces the old ✓ text glyph.
  | 'check'
  // VAPP-77 chase-queue step icons: zahlungserinnerung=bell, mahnung_1=email-open,
  // mahnung_2_frist=email-alert (letter-with-deadline).
  | 'bell-outline'
  // Story 9.1a Documents surface: the Radar entry + empty-state glyph, the search icon, and the
  // per-kind card glyphs (invoice reuses receipt-text-outline; chase reuses email-open-outline).
  | 'file-document-multiple-outline'
  | 'file-document-outline'
  | 'file-document-edit-outline'
  | 'file-check-outline'
  | 'cash-check'
  | 'clipboard-check-outline'
  | 'plus-box-outline'
  | 'magnify'
  // Story 9.1b: the correction-chain badge glyph.
  | 'source-branch'
  // Story 13.1: the Price-list bottom-bar destination (a price tag).
  | 'tag-outline'
  // 2026-07-31 polish: the Job Card's customer-rename affordance.
  | 'pencil-outline';

export const Icon = MaterialCommunityIcons;
