import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

// The floating bar reserves no layout height (absolute overlay), so tab
// screens need bottom clearance to scroll their last control clear of it.
// A fixed padding fails whenever insets.bottom or fontScale grow the bar
// (3.1 review fix — founder hit the overlap on a 3-button-nav device), so the
// bar MEASURES its occupied zone (pill + margins + safe-area) via onLayout and
// publishes it here; screens pad by the measured value.
const FALLBACK_CLEARANCE = 112;

const ClearanceContext = createContext(FALLBACK_CLEARANCE);
const SetClearanceContext = createContext<(height: number) => void>(() => {});

export function BottomBarSpaceProvider({ children }: { children: ReactNode }) {
  const [clearance, setClearance] = useState(FALLBACK_CLEARANCE);
  const set = useMemo(
    () => (height: number) => {
      // 8px breathing room; never shrink below the fallback mid-session
      setClearance((current) => Math.max(FALLBACK_CLEARANCE, Math.round(height) + 8, current));
    },
    [],
  );
  return (
    <SetClearanceContext.Provider value={set}>
      <ClearanceContext.Provider value={clearance}>{children}</ClearanceContext.Provider>
    </SetClearanceContext.Provider>
  );
}

/** Bottom padding that clears the floating bar on tab screens. */
export function useBottomBarClearance(): number {
  return useContext(ClearanceContext);
}

/** Bar-internal: report the measured overlay height. */
export function useReportBottomBarHeight(): (height: number) => void {
  return useContext(SetClearanceContext);
}
