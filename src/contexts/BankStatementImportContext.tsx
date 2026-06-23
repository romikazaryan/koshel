import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { BankProviderPickerSheet } from '../components/bank/BankProviderPickerSheet';
import { BankStatementImportSheet } from '../components/bank/BankStatementImportSheet';
import { useSharedStatement } from './SharedStatementContext';
import { invalidateDashboardCache } from '../lib/dashboardCache';
import { fetchFinancialConnections } from '../lib/financialConnections';
import {
  useOpenSharedStatementImport,
  type ImportTarget,
  type SharedFileAwaitingBank,
} from '../hooks/useSharedStatementImportFlow';
import type { FinancialConnection } from '../types/financialConnections';

type BankStatementImportContextValue = {
  openManualImport: () => void;
  setOnImportedListener: (listener: (() => void) | null) => void;
};

const BankStatementImportContext = createContext<BankStatementImportContextValue | null>(null);

export function BankStatementImportProvider({ children }: { children: ReactNode }) {
  const [bankConnections, setBankConnections] = useState<FinancialConnection[]>([]);
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [importTarget, setImportTarget] = useState<ImportTarget | null>(null);
  const [sharedFileAwaitingBank, setSharedFileAwaitingBank] = useState<SharedFileAwaitingBank | null>(
    null
  );
  const { pending, consumePending } = useSharedStatement();
  const onImportedListenerRef = useRef<(() => void) | null>(null);

  const refreshBankConnections = useCallback(() => {
    void fetchFinancialConnections().then((conn) => {
      setBankConnections(conn.filter((c) => c.status !== 'revoked' && c.providerKind === 'bank'));
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshBankConnections();
    }, [refreshBankConnections])
  );

  const openSharedImport = useOpenSharedStatementImport(bankConnections, {
    setImportTarget,
    setSharedFileAwaitingBank,
    setShowBankPicker,
  });

  useLayoutEffect(() => {
    if (!pending) return;
    const shared = consumePending();
    if (shared) openSharedImport(shared);
  }, [pending, consumePending, openSharedImport]);

  const openManualImport = useCallback(() => {
    setSharedFileAwaitingBank(null);
    setShowBankPicker(true);
  }, []);

  const handleBankSelected = useCallback(
    (providerId: string, providerName: string) => {
      setShowBankPicker(false);
      const existing = bankConnections.find((c) => c.providerId === providerId);
      setImportTarget({
        providerId,
        providerName,
        connectionId: existing?.id,
        initialFile: sharedFileAwaitingBank
          ? {
              uri: sharedFileAwaitingBank.uri,
              fileName: sharedFileAwaitingBank.fileName,
              mimeType: sharedFileAwaitingBank.mimeType,
            }
          : undefined,
        initialAccountKind: sharedFileAwaitingBank?.initialAccountKind,
      });
      setSharedFileAwaitingBank(null);
    },
    [bankConnections, sharedFileAwaitingBank]
  );

  const handleImported = useCallback(() => {
    refreshBankConnections();
    void invalidateDashboardCache();
    onImportedListenerRef.current?.();
  }, [refreshBankConnections]);

  const setOnImportedListener = useCallback((listener: (() => void) | null) => {
    onImportedListenerRef.current = listener;
  }, []);

  const value = useMemo(
    () => ({ openManualImport, setOnImportedListener }),
    [openManualImport, setOnImportedListener]
  );

  return (
    <BankStatementImportContext.Provider value={value}>
      {children}

      <BankProviderPickerSheet
        visible={showBankPicker}
        onClose={() => {
          setShowBankPicker(false);
          setSharedFileAwaitingBank(null);
        }}
        onSelect={handleBankSelected}
      />

      {importTarget ? (
        <BankStatementImportSheet
          visible
          providerId={importTarget.providerId}
          providerName={importTarget.providerName}
          connectionId={importTarget.connectionId}
          initialFile={importTarget.initialFile}
          initialAccountKind={importTarget.initialAccountKind}
          onClose={() => setImportTarget(null)}
          onImported={handleImported}
        />
      ) : null}
    </BankStatementImportContext.Provider>
  );
}

export function useBankStatementImport() {
  const ctx = useContext(BankStatementImportContext);
  if (!ctx) {
    throw new Error('useBankStatementImport must be used within BankStatementImportProvider');
  }
  return ctx;
}
