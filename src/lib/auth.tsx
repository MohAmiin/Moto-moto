import type { Session } from '@supabase/supabase-js';
import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';
import type { Profile, RiderApplication } from '@/lib/types';

type AuthState = {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  application: RiderApplication | null;
  /** Re-reads the profile and rider application, e.g. after onboarding. */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [application, setApplication] = useState<RiderApplication | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAccount = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      setApplication(null);
      return;
    }
    const [{ data: p }, { data: a }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle<Profile>(),
      supabase.from('rider_applications').select('*').eq('user_id', userId).maybeSingle<RiderApplication>(),
    ]);
    setProfile(p ?? null);
    setApplication(a ?? null);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadAccount(data.session?.user.id);
      if (active) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      // Avoid awaiting Supabase calls inside the callback; defer the profile load.
      setTimeout(() => loadAccount(next?.user.id), 0);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadAccount]);

  // Riders waiting for approval see the decision as soon as an admin makes it.
  const userId = session?.user.id;
  const isRider = profile?.role === 'rider';
  useEffect(() => {
    if (!userId || !isRider) return;
    const channel = supabase
      .channel(`application-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rider_applications', filter: `user_id=eq.${userId}` },
        (payload) => setApplication((payload.new as RiderApplication) ?? null),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, isRider]);

  const refresh = useCallback(() => loadAccount(session?.user.id), [loadAccount, session?.user.id]);
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext value={{ loading, session, profile, application, refresh, signOut }}>{children}</AuthContext>
  );
}

export function useAuth() {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
