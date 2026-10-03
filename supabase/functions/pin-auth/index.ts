// Supabase Edge Function (Deno). Deploy with JWT checks off, because callers are signed out:
//   npx supabase functions deploy pin-auth --no-verify-jwt
// See docs/pin-security-rollout.md.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { clientIp, handlePinAuth, type PinAuthDeps, type Session } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL')!;
/** The first key of a JSON key dictionary (SUPABASE_SECRET_KEYS / SUPABASE_PUBLISHABLE_KEYS), or a legacy key. */
function key(dictionary: string, legacy: string) {
  const json = Deno.env.get(dictionary);
  if (json) {
    const first = Object.values(JSON.parse(json) as Record<string, string>)[0];
    if (first) return first;
  }
  return Deno.env.get(legacy)!;
}
const secretKey = key('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
const publishableKey = key('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');

const noSession = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, secretKey, noSession);

const deps: PinAuthDeps = {
  async rpc(fn, args) {
    const { data, error } = await admin.rpc(fn, args);
    return { data, error: error ? { message: error.message } : null };
  },
  async createUser(email) {
    const password = crypto.randomUUID() + crypto.randomUUID();
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) {
      if (error.code === 'email_exists' || /already been registered|already registered/i.test(error.message)) return 'taken';
      throw error;
    }
    return { id: data.user.id };
  },
  async deleteUser(id) {
    await admin.auth.admin.deleteUser(id);
  },
  async createSession(email): Promise<Session> {
    const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    if (error) throw error;
    // A fresh client per request, so sessions never mix between callers.
    const client = createClient(url, publishableKey, noSession);
    const { data, error: verifyError } = await client.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: 'magiclink',
    });
    if (verifyError || !data.session) throw verifyError ?? new Error('no session');
    return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
  },
};

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ ok: false, error: 'invalid' }), { status: 405, headers });
  try {
    const body = await req.json().catch(() => null);
    const result = await handlePinAuth(body, clientIp(req.headers.get('cf-connecting-ip'), req.headers.get('x-forwarded-for')), deps);
    return new Response(JSON.stringify(result), { status: 200, headers });
  } catch (error) {
    console.error('pin-auth failed', error);
    return new Response(JSON.stringify({ ok: false, error: 'server' }), { status: 500, headers });
  }
});
