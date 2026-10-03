import { FunctionsHttpError, type User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

// Phone + PIN login through the pin-auth Edge Function, which checks the PIN in the database and limits
// wrong guesses per number (see 20261007000000_pin_security.sql). Each phone number has an internal
// login address <digits>@pin.jareeye.app that users never see.
const PIN_DOMAIN = 'pin.jareeye.app';

/** Signing in accepts the 4-digit PINs of older accounts as well as 6-digit ones. */
export function isValidSignInPin(pin: string) {
  return /^(\d{4}|\d{6})$/.test(pin);
}

/** New accounts and resets use 6 digits. */
export function isValidNewPin(pin: string) {
  return /^\d{6}$/.test(pin);
}

/** The account's phone number with country code, from SMS login or from the PIN login address. */
export function accountPhone(user: User) {
  if (user.phone) return user.phone;
  const [local, domain] = (user.email ?? '').split('@');
  return domain === PIN_DOMAIN ? local : null;
}

export type PinAuthError = 'invalid' | 'wrong' | 'locked' | 'too_many' | 'taken' | 'server' | 'offline';

export type PinAuthResult =
  | { ok: true; code?: string; expiresAt?: string }
  | { ok: false; error: PinAuthError; retryAfterSeconds?: number };

type FunctionReply =
  | { ok: true; session?: { access_token: string; refresh_token: string }; code?: string; expiresAt?: string }
  | { ok: false; error: Exclude<PinAuthError, 'offline'>; retryAfterSeconds?: number };

/**
 * Signs in, creates an account, or asks for a PIN reset. On sign-in and sign-up the session is stored
 * and the app moves on by itself; a reset returns the code to show the requester.
 * `phone` is the full number with 252, digits only.
 */
export async function pinAuth(action: 'sign-in' | 'sign-up' | 'reset', phone: string, pin: string): Promise<PinAuthResult> {
  const { data, error } = await supabase.functions.invoke<FunctionReply>('pin-auth', { body: { action, phone, pin } });
  if (error || !data) {
    // An HTTP error came from the server; anything else means the request never got through.
    return { ok: false, error: error instanceof FunctionsHttpError ? 'server' : 'offline' };
  }
  if (!data.ok) return data;
  if (data.session) {
    const { error: sessionError } = await supabase.auth.setSession(data.session);
    if (sessionError) return { ok: false, error: 'server' };
  }
  return { ok: true, code: data.code, expiresAt: data.expiresAt };
}
