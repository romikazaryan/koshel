import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { hasSupabase, supabase } from '../lib/supabase';
import { withTimeout } from '../lib/asyncUtils';
import { mapAuthErrorMessage } from '../lib/authErrors';
import { invalidateDashboardCache } from '../lib/dashboardCache';
import { withNetworkRetries } from '../lib/asyncUtils';
import { getEmailRedirectUrl } from '../lib/authRedirect';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  sendPhoneOtp: (phoneE164: string) => Promise<void>;
  verifyPhoneOtp: (phoneE164: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    const finishBoot = (nextSession: Session | null) => {
      if (!mounted) return;
      setSession(nextSession);
      setIsLoading(false);
    };

    void withTimeout(supabase.auth.getSession(), 4_000, 'auth boot timeout')
      .then(({ data }) => {
        finishBoot(data.session);
      })
      .catch(() => {
        finishBoot(null);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_IN') {
        void invalidateDashboardCache();
      }
      finishBoot(nextSession);
    });

    const bootTimeout = setTimeout(() => {
      if (mounted) setIsLoading(false);
    }, 2500);

    return () => {
      mounted = false;
      clearTimeout(bootTimeout);
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const client = supabase;
    if (!client) throw new Error('Supabase не настроен.');
    try {
      await withNetworkRetries(async () => {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      });
    } catch (error) {
      throw new Error(mapAuthErrorMessage(error));
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const client = supabase;
    if (!client) throw new Error('Supabase не настроен.');
    try {
      return await withNetworkRetries(async () => {
        const { data, error } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: getEmailRedirectUrl(),
          },
        });
        if (error) throw error;
        return { needsEmailConfirmation: !data.session };
      });
    } catch (error) {
      throw new Error(mapAuthErrorMessage(error));
    }
  }, []);

  const sendPhoneOtp = useCallback(async (phoneE164: string) => {
    const client = supabase;
    if (!client) throw new Error('Supabase не настроен.');
    try {
      await withNetworkRetries(async () => {
        const { error } = await client.auth.signInWithOtp({
          phone: phoneE164,
          options: { channel: 'sms' },
        });
        if (error) throw error;
      });
    } catch (error) {
      throw new Error(mapAuthErrorMessage(error));
    }
  }, []);

  const verifyPhoneOtp = useCallback(async (phoneE164: string, token: string) => {
    const client = supabase;
    if (!client) throw new Error('Supabase не настроен.');
    try {
      await withNetworkRetries(async () => {
        const { error } = await client.auth.verifyOtp({
          phone: phoneE164,
          token: token.trim(),
          type: 'sms',
        });
        if (error) throw error;
      });
    } catch (error) {
      throw new Error(mapAuthErrorMessage(error));
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(mapAuthErrorMessage(error));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      signIn,
      signUp,
      sendPhoneOtp,
      verifyPhoneOtp,
      signOut,
    }),
    [session, isLoading, signIn, signUp, sendPhoneOtp, verifyPhoneOtp, signOut]
  );

  const notConfigured = async () => {
    throw new Error('Supabase не настроен.');
  };

  const fallbackValue = useMemo<AuthContextValue>(
    () => ({
      session: null,
      user: null,
      isLoading: false,
      signIn: notConfigured,
      signUp: async () => {
        throw new Error('Supabase не настроен.');
      },
      sendPhoneOtp: notConfigured,
      verifyPhoneOtp: notConfigured,
      signOut: async () => {},
    }),
    []
  );

  return (
    <AuthContext.Provider value={hasSupabase ? value : fallbackValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

export function useOptionalAuth() {
  return useContext(AuthContext);
}
