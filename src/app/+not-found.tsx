import { Redirect } from 'expo-router';

import { useAuth } from '@/lib/auth';

/** Old or mistyped links go to the right start page for whoever is signed in, instead of an error page. */
export default function NotFound() {
  const { session, profile } = useAuth();
  if (!session) return <Redirect href="/sign-in" />;
  if (!profile) return <Redirect href="/onboarding" />;
  if (profile.role === 'rider') return <Redirect href="/rider" />;
  if (profile.role === 'admin') return <Redirect href="/admin" />;
  return <Redirect href="/" />;
}
