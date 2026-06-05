import type { NavigatorScreenParams } from '@react-navigation/native';
import type { MonthRef } from '../lib/month';
import type { Transaction, TransactionKind } from '../types';

export type HomeStackParamList = {
  Dashboard: undefined;
  TransactionHistory: {
    kind: TransactionKind;
    month: MonthRef;
    initialTransactions?: Transaction[];
  };
  Recommendations: { recommendations: string };
  EditTransaction: { transaction: Transaction };
};

export type ExpensesStackParamList = {
  ExpensesHub: undefined;
};

export type IncomeStackParamList = {
  IncomeMain: undefined;
};

export type FinancesStackParamList = {
  Capital: undefined;
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
};

export type MainTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList>;
  Expenses: NavigatorScreenParams<ExpensesStackParamList>;
  Income: NavigatorScreenParams<IncomeStackParamList>;
  Finances: NavigatorScreenParams<FinancesStackParamList>;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

export type RootStackParamList = {
  MainTabs: undefined;
};
