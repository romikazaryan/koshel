import { useCallback } from 'react';
import type { FinancialConnection } from '../types/financialConnections';
import type { SharedStatementFile } from '../lib/sharedBankStatement';
import type { StatementCardKind } from '../lib/bankStatementImport';

export type ImportTarget = {
  providerId: string;
  providerName: string;
  connectionId?: string;
  initialFile?: { uri: string; fileName: string; mimeType?: string | null };
  initialAccountKind?: StatementCardKind;
};

export type SharedFileAwaitingBank = {
  uri: string;
  fileName: string;
  mimeType?: string | null;
  initialAccountKind?: StatementCardKind;
};

type ImportFlowActions = {
  setImportTarget: (target: ImportTarget | null) => void;
  setSharedFileAwaitingBank: (file: SharedFileAwaitingBank | null) => void;
  setShowBankPicker: (visible: boolean) => void;
};

export function useOpenSharedStatementImport(
  bankConnections: FinancialConnection[],
  actions: ImportFlowActions
) {
  return useCallback(
    (shared: SharedStatementFile) => {
      if (shared.providerId && shared.providerName) {
        const existing = bankConnections.find((c) => c.providerId === shared.providerId);
        actions.setImportTarget({
          providerId: shared.providerId,
          providerName: shared.providerName,
          connectionId: existing?.id,
          initialFile: {
            uri: shared.uri,
            fileName: shared.fileName,
            mimeType: shared.mimeType,
          },
          initialAccountKind: shared.initialAccountKind,
        });
        return;
      }

      actions.setSharedFileAwaitingBank({
        uri: shared.uri,
        fileName: shared.fileName,
        mimeType: shared.mimeType,
        initialAccountKind: shared.initialAccountKind,
      });
      actions.setShowBankPicker(true);
    },
    [actions, bankConnections]
  );
}
