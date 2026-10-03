// The pin-auth Edge Function's logic (supabase/functions/pin-auth/handler.ts), with Supabase faked.
import assert from 'node:assert/strict';
import test from 'node:test';

import { clientIp, handlePinAuth, parseRequest } from '../supabase/functions/pin-auth/handler.ts';

const SESSION = { access_token: 'a', refresh_token: 'r' };

function fakeDeps(rpcResults = {}) {
  const calls = [];
  const deps = {
    users: new Map([['252634000001@pin.jareeye.app', 'existing-id']]),
    deleted: [],
    async rpc(fn, args) {
      calls.push([fn, args]);
      const r = rpcResults[fn];
      return typeof r === 'function' ? r(args) : r ?? { data: null, error: { message: 'unexpected rpc ' + fn } };
    },
    async createUser(email) {
      calls.push(['createUser', email]);
      if (deps.users.has(email)) return 'taken';
      deps.users.set(email, 'new-id');
      return { id: 'new-id' };
    },
    async deleteUser(id) {
      deps.deleted.push(id);
    },
    async createSession(email) {
      calls.push(['createSession', email]);
      return SESSION;
    },
  };
  return { deps, calls };
}

const login = (outcome, extra = {}) => ({
  pin_login: { data: [{ outcome, user_id: outcome === 'ok' ? 'u1' : null, retry_after_seconds: null, ...extra }], error: null },
});

test('requests are validated: sign-in takes 4 or 6 digits, new PINs need 6', () => {
  assert.deepEqual(parseRequest({ action: 'sign-in', phone: '252634740002', pin: '1234' })?.pin, '1234');
  assert.deepEqual(parseRequest({ action: 'sign-in', phone: '252634740002', pin: '123456' })?.pin, '123456');
  assert.equal(parseRequest({ action: 'sign-in', phone: '252634740002', pin: '12345' }), null);
  assert.equal(parseRequest({ action: 'sign-up', phone: '252634740002', pin: '1234' }), null, 'new accounts need 6 digits');
  assert.equal(parseRequest({ action: 'reset', phone: '252634740002', pin: '1234' }), null, 'resets need 6 digits');
  assert.equal(parseRequest({ action: 'sign-in', phone: '+252634740002', pin: '1234' }), null, 'digits only');
  assert.equal(parseRequest({ action: 'sign-in', phone: '254712345678', pin: '1234' }), null, '+252 numbers only');
  assert.equal(parseRequest({ action: 'delete', phone: '252634740002', pin: '123456' }), null);
  assert.equal(parseRequest(null), null);
});

test('sign-in: a session only for a correct PIN; the address is passed for limits', async () => {
  const { deps, calls } = fakeDeps(login('ok'));
  const res = await handlePinAuth({ action: 'sign-in', phone: '252634000001', pin: '1234' }, '196.1.1.1', deps);
  assert.deepEqual(res, { ok: true, session: SESSION });
  assert.deepEqual(calls[0], ['pin_login', { p_phone: '252634000001', p_pin: '1234', p_ip: '196.1.1.1' }]);
  assert.deepEqual(calls[1], ['createSession', '252634000001@pin.jareeye.app']);
});

test('sign-in: wrong, locked and busy-address answers never create a session', async () => {
  for (const [outcome, expected] of [
    ['wrong', { ok: false, error: 'wrong' }],
    ['locked', { ok: false, error: 'locked', retryAfterSeconds: 900 }],
    ['ip_limited', { ok: false, error: 'too_many', retryAfterSeconds: 900 }],
  ]) {
    const { deps, calls } = fakeDeps(login(outcome, { retry_after_seconds: outcome === 'wrong' ? null : 900 }));
    assert.deepEqual(await handlePinAuth({ action: 'sign-in', phone: '252634000001', pin: '0000' }, null, deps), expected);
    assert.ok(!calls.some(([fn]) => fn === 'createSession'), `${outcome} must not create a session`);
  }
});

test('sign-in: database errors fail closed', async () => {
  const { deps, calls } = fakeDeps({ pin_login: { data: null, error: { message: 'timeout' } } });
  assert.deepEqual(await handlePinAuth({ action: 'sign-in', phone: '252634000001', pin: '1234' }, null, deps), { ok: false, error: 'server' });
  assert.ok(!calls.some(([fn]) => fn === 'createSession'));
});

test('sign-up: creates the login, saves the 6-digit PIN, then signs in', async () => {
  const { deps, calls } = fakeDeps({
    pin_signup_allowed: { data: true, error: null },
    pin_set_credential: { data: null, error: null },
  });
  const res = await handlePinAuth({ action: 'sign-up', phone: '252634000002', pin: '135790' }, '196.1.1.2', deps);
  assert.deepEqual(res, { ok: true, session: SESSION });
  assert.deepEqual(
    calls.map(([fn]) => fn),
    ['pin_signup_allowed', 'createUser', 'pin_set_credential', 'createSession'],
  );
  assert.deepEqual(calls[2][1], { p_user_id: 'new-id', p_phone: '252634000002', p_pin: '135790' });
});

test('sign-up: taken numbers, busy addresses and failed saves', async () => {
  let { deps } = fakeDeps({ pin_signup_allowed: { data: true, error: null } });
  assert.deepEqual(await handlePinAuth({ action: 'sign-up', phone: '252634000001', pin: '135790' }, null, deps), { ok: false, error: 'taken' });

  ({ deps } = fakeDeps({ pin_signup_allowed: { data: false, error: null } }));
  assert.deepEqual(await handlePinAuth({ action: 'sign-up', phone: '252634000003', pin: '135790' }, null, deps), { ok: false, error: 'too_many' });
  assert.equal(deps.users.has('252634000003@pin.jareeye.app'), false, 'no login made when limited');

  ({ deps } = fakeDeps({
    pin_signup_allowed: { data: true, error: null },
    pin_set_credential: { data: null, error: { message: 'credential already set' } },
  }));
  assert.deepEqual(await handlePinAuth({ action: 'sign-up', phone: '252634000004', pin: '135790' }, null, deps), { ok: false, error: 'server' });
  assert.deepEqual(deps.deleted, ['new-id'], 'the half-made login is removed');
});

test('reset: returns the code for the requester; limits are reported', async () => {
  let { deps } = fakeDeps({ pin_reset_request: { data: [{ code: '482913', expires_at: '2026-10-03T12:00:00Z' }], error: null } });
  assert.deepEqual(await handlePinAuth({ action: 'reset', phone: '252634000001', pin: '246810' }, null, deps), {
    ok: true,
    code: '482913',
    expiresAt: '2026-10-03T12:00:00Z',
  });
  ({ deps } = fakeDeps({ pin_reset_request: { data: null, error: { message: 'Too many reset requests' } } }));
  assert.deepEqual(await handlePinAuth({ action: 'reset', phone: '252634000001', pin: '246810' }, null, deps), { ok: false, error: 'too_many' });
});

test('client address prefers the header callers cannot set', () => {
  assert.equal(clientIp('196.1.1.1', '1.2.3.4, 10.0.0.1'), '196.1.1.1');
  assert.equal(clientIp(null, ' 1.2.3.4 , 10.0.0.1'), '1.2.3.4');
  assert.equal(clientIp(null, null), null);
});
