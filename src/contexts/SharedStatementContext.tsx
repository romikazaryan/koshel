import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SharedStatementFile } from '../lib/sharedBankStatement';

type SharedStatementContextValue = {
  pending: SharedStatementFile | null;
  setPending: (file: SharedStatementFile | null) => void;
  consumePending: () => SharedStatementFile | null;
};

const SharedStatementContext = createContext<SharedStatementContextValue | null>(null);

export function SharedStatementProvider({ children }: { children: ReactNode }) {
  const [pending, setPendingState] = useState<SharedStatementFile | null>(null);
  const pendingRef = useRef<SharedStatementFile | null>(null);

  const setPending = useCallback((file: SharedStatementFile | null) => {
    pendingRef.current = file;
    setPendingState(file);
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
    <SharedStatementContext.Provider value={value}>{children}</SharedStatementContext.Provider>
  );
}

export function useSharedStatement() {
  const ctx = useContext(SharedStatementContext);
  if (!ctx) {
    throw new Error('useSharedStatement must be used within SharedStatementProvider');
  }
  return ctx;
}
