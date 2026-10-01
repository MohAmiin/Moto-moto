import type { User } from '@supabase/supabase-js';

// Phone + PIN login. Supabase signs in with an email and password, so each phone number gets an internal
// address (never shown to users) and the PIN is turned into the password. See 20261004…_pin_login.sql.
const PIN_DOMAIN = 'pin.jareeye.app';

/** "634740002" (local digits) → "252634740002@pin.jareeye.app". */
export function pinEmail(localDigits: string) {
  return `252${localDigits}@${PIN_DOMAIN}`;
}

/** Supabase needs at least 6 characters, so the 4 digits get a fixed prefix. */
export function pinPassword(pin: string) {
  return `jareeye-pin-${pin}`;
}

export function isValidPin(pin: string) {
  return /^\d{4}$/.test(pin);
}

/** The account's phone number with country code, from SMS login or from the PIN login address. */
export function accountPhone(user: User) {
  if (user.phone) return user.phone;
  const [local, domain] = (user.email ?? '').split('@');
  return domain === PIN_DOMAIN ? local : null;
}
