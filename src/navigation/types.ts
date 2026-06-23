import type { NavigatorScreenParams } from '@react-navigation/native';
import type { MonthRef } from '../lib/month';
import type { MonthAnalysisResult } from '../types/monthAnalysis';
import type { Transaction, TransactionKind } from '../types';

export type HomeStackParamList = {
  Dashboard: undefined;
  OperationsHub: {
    month: MonthRef;
    initialTransactions?: Transaction[];
  };
  IncomeMain: {
    month: MonthRef;
    initialTransactions?: Transaction[];
  };
  TransactionHistory: {
    kind: TransactionKind;
    month: MonthRef;
    initialTransactions?: Transaction[];
  };
  Recommendations: {
    analysis?: MonthAnalysisResult;
    recommendations?: string;
    monthLabel?: string;
  };
  EditTransaction: { transaction: Transaction };
  StatementImports: undefined;
};

export type FinancesStackParamList = {
  Capital: undefined;
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  BankConnections: undefined;
  TinvestConnect: undefined;
};

export type MainTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList>;
  Finances: NavigatorScreenParams<FinancesStackParamList>;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

export type RootStackParamList = {
  MainTabs: undefined;
};
