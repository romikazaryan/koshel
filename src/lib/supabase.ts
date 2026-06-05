import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

function pickFirstNonEmpty(...values: Array<unknown>) {
  for (const value of values) {
    const str = String(value ?? '').trim();
    if (str) return str;
  }
  return '';
}

const appConstants = (Constants.expoConfig || Constants.manifest || {}) as any;
const extra = (appConstants as any).extra || {};
const processEnv = (globalThis as any)?.process?.env ?? {};

const SUPABASE_URL = pickFirstNonEmpty(
  extra.SUPABASE_URL,
  processEnv.EXPO_PUBLIC_SUPABASE_URL,
  processEnv.SUPABASE_URL
);
const SUPABASE_ANON_KEY = pickFirstNonEmpty(
  extra.SUPABASE_ANON_KEY,
  processEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  processEnv.SUPABASE_ANON_KEY
);
const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!hasSupabase) {
  console.warn('Supabase environment variables are not set. Add SUPABASE_URL and SUPABASE_ANON_KEY to your .env file.');
}

export const supabase: SupabaseClient | null = hasSupabase
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export { hasSupabase };
