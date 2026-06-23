import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Category, TransactionKind } from '../types';

export type PendingQuickCapture = {
  amount: number;
  kind: TransactionKind;
  title: string;
  category: Category;
  source: 'manual' | 'share';
};

type PendingQuickCaptureContextValue = {
  pending: PendingQuickCapture | null;
  setPending: (item: PendingQuickCapture | null) => void;
  consumePending: () => PendingQuickCapture | null;
};

const PendingQuickCaptureContext = createContext<PendingQuickCaptureContextValue | null>(null);

export function PendingQuickCaptureProvider({ children }: { children: ReactNode }) {
  const [pending, setPendingState] = useState<PendingQuickCapture | null>(null);
  const pendingRef = useRef<PendingQuickCapture | null>(null);

  const setPending = useCallback((item: PendingQuickCapture | null) => {
    pendingRef.current = item;
    setPendingState(item);
  }, []);

  const consumePending = useCallback(() => {
    const next = pendingRef.current;
    pendingRef.current = null;
    setPendingState(null);
    return next;
  }, []);

  const value = useMemo(
    () => ({ pending, setPending, consumePending }),
    [pending, setPending, consumePending]
  );

  return (
    <PendingQuickCaptureContext.Provider value={value}>
      {children}
    </PendingQuickCaptureContext.Provider>
  );
}

export function usePendingQuickCapture() {
  const ctx = useContext(PendingQuickCaptureContext);
  if (!ctx) {
    throw new Error('usePendingQuickCapture must be used within PendingQuickCaptureProvider');
  }
  return ctx;
}
