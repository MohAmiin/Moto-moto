// Phone + PIN sign-in, sign-up and reset requests. The PIN is checked in the database (pin_login), where
// wrong PINs are counted per number and per internet address, so PINs can't be guessed against Supabase
// Auth directly. This file has no Deno or network code so it can be tested with `npm test`; index.ts
// connects it to Supabase.

export type PinAuthRequest =
  | { action: 'sign-in'; phone: string; pin: string }
  | { action: 'sign-up'; phone: string; pin: string }
  | { action: 'reset'; phone: string; pin: string };

export type Session = { access_token: string; refresh_token: string };

export type PinAuthError = 'invalid' | 'wrong' | 'locked' | 'too_many' | 'taken' | 'server';

export type PinAuthResponse =
  | { ok: true; session: Session }
  | { ok: true; code: string; expiresAt: string }
  | { ok: false; error: PinAuthError; retryAfterSeconds?: number };

type RpcResult<T> = { data: T | null; error: { message: string } | null };

export type PinAuthDeps = {
  rpc<T>(fn: string, args: Record<string, unknown>): Promise<RpcResult<T>>;
  /** Creates a confirmed login with a random password. Returns 'taken' when the address exists. */
  createUser(email: string): Promise<{ id: string } | 'taken'>;
  deleteUser(id: string): Promise<void>;
  /** A session for an existing login, without a password. */
  createSession(email: string): Promise<Session>;
};

const PIN_DOMAIN = 'pin.jareeye.app';
// Somali numbers: 252 and 6 to 10 more digits (the app adds the 63 prefix to 7-digit numbers). Signing in
// and resets accept that range so older accounts keep working; new accounts need a full 9-digit mobile number.
const PHONE = /^252\d{6,10}$/;
const PHONE_NEW = /^252\d{9}$/;
const PIN_SIGN_IN = /^(\d{4}|\d{6})$/;
const PIN_NEW = /^\d{6}$/;

export const pinEmail = (phone: string) => `${phone}@${PIN_DOMAIN}`;

export function parseRequest(body: unknown): PinAuthRequest | null {
  if (!body || typeof body !== 'object') return null;
  const { action, phone, pin } = body as Record<string, unknown>;
  if (typeof phone !== 'string' || typeof pin !== 'string' || !PHONE.test(phone)) return null;
  if (action === 'sign-in' && PIN_SIGN_IN.test(pin)) return { action, phone, pin };
  if (action === 'sign-up' && PIN_NEW.test(pin) && PHONE_NEW.test(phone)) return { action, phone, pin };
  if (action === 'reset' && PIN_NEW.test(pin)) return { action, phone, pin };
  return null;
}

export async function handlePinAuth(body: unknown, ip: string | null, deps: PinAuthDeps): Promise<PinAuthResponse> {
  const req = parseRequest(body);
  if (!req) return { ok: false, error: 'invalid' };
  switch (req.action) {
    case 'sign-in':
      return signIn(req.phone, req.pin, ip, deps);
    case 'sign-up':
      return signUp(req.phone, req.pin, ip, deps);
    case 'reset':
      return requestReset(req.phone, req.pin, ip, deps);
  }
}

type LoginRow = { outcome: string; user_id: string | null; retry_after_seconds: number | null };

async function signIn(phone: string, pin: string, ip: string | null, deps: PinAuthDeps): Promise<PinAuthResponse> {
  const { data, error } = await deps.rpc<LoginRow[]>('pin_login', { p_phone: phone, p_pin: pin, p_ip: ip });
  const row = data?.[0];
  if (error || !row) return { ok: false, error: 'server' };
  switch (row.outcome) {
    case 'ok':
      return { ok: true, session: await deps.createSession(pinEmail(phone)) };
    case 'wrong':
      return { ok: false, error: 'wrong' };
    case 'locked':
      return { ok: false, error: 'locked', retryAfterSeconds: row.retry_after_seconds ?? undefined };
    case 'ip_limited':
      return { ok: false, error: 'too_many', retryAfterSeconds: row.retry_after_seconds ?? undefined };
    case 'invalid':
      return { ok: false, error: 'invalid' };
    default:
      return { ok: false, error: 'server' };
  }
}

async function signUp(phone: string, pin: string, ip: string | null, deps: PinAuthDeps): Promise<PinAuthResponse> {
  const allowed = await deps.rpc<boolean>('pin_signup_allowed', { p_ip: ip });
  if (allowed.error) return { ok: false, error: 'server' };
  if (allowed.data !== true) return { ok: false, error: 'too_many' };

  const created = await deps.createUser(pinEmail(phone));
  if (created === 'taken') return { ok: false, error: 'taken' };

  const saved = await deps.rpc<null>('pin_set_credential', { p_user_id: created.id, p_phone: phone, p_pin: pin });
  if (saved.error) {
    // Don't leave a login behind that nobody can sign in to.
    await deps.deleteUser(created.id);
    return { ok: false, error: 'server' };
  }
  return { ok: true, session: await deps.createSession(pinEmail(phone)) };
}

type ResetRow = { code: string; expires_at: string };

async function requestReset(phone: string, pin: string, ip: string | null, deps: PinAuthDeps): Promise<PinAuthResponse> {
  const { data, error } = await deps.rpc<ResetRow[]>('pin_reset_request', { p_phone: phone, p_pin: pin, p_ip: ip });
  if (error) return { ok: false, error: error.message.includes('Too many') ? 'too_many' : 'server' };
  const row = data?.[0];
  if (!row) return { ok: false, error: 'server' };
  return { ok: true, code: row.code, expiresAt: row.expires_at };
}

/**
 * The caller's internet address, for the per-address limits. Cloudflare's header can't be set by the
 * caller; X-Forwarded-For can, so it is only a fallback. Either way the per-number lock is the real
 * protection: a faked address only escapes the per-address limit.
 */
export function clientIp(cfConnectingIp: string | null, forwardedFor: string | null) {
  const cf = cfConnectingIp?.trim();
  if (cf) return cf;
  const first = forwardedFor?.split(',')[0]?.trim();
  return first || null;
}
