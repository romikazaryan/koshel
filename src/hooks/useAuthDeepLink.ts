import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { parseAuthTokensFromUrl } from '../lib/authRedirect';

async function handleAuthUrl(url: string) {
  if (!supabase || !url.includes('auth/callback')) return;

  const tokens = parseAuthTokensFromUrl(url);
  if (!tokens) return;

  const { error } = await supabase.auth.setSession(tokens);
  if (error) console.warn('Auth deep link error', error.message);
}

export function useAuthDeepLink() {
  useEffect(() => {
    if (!supabase) return;

    const onUrl = ({ url }: { url: string }) => {
      void handleAuthUrl(url).catch((e) => console.warn('Auth URL parse failed', e));
    };

    const subscription = Linking.addEventListener('url', onUrl);

    void Linking.getInitialURL().then((url) => {
      if (url) void handleAuthUrl(url).catch((e) => console.warn('Auth URL parse failed', e));
    });

    return () => subscription.remove();
  }, []);
}
