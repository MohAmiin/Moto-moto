// Timing checks for the rider's online / busy state (src/lib/rider-availability.ts).
// Every GPS fix and database write is held until the test releases it, so races are reproduced exactly.
import assert from 'node:assert/strict';
import test from 'node:test';

import { RiderAvailability, withTimeout } from '../src/lib/rider-availability.ts';

const HARGEISA = { lat: 9.56, lng: 44.07 };
const MOVED = { lat: 9.57, lng: 44.08 };

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Lets queued promise callbacks run. */
const flush = () => new Promise((r) => setImmediate(r));

/**
 * A fake profile row. Each call waits on a deferred the test resolves; writes are applied to the row
 * only when released, and the heartbeat/busy saves apply the same `is_online = true` condition as Supabase.
 */
function fakeStore(row = { is_online: false, lat: null, lng: null, busy_until: null }) {
  const pending = [];
  const log = [];
  const hold = (name, apply) => {
    const d = deferred();
    pending.push({ name, d });
    return d.promise.then((value) => {
      if (value instanceof Error) throw value;
      const result = apply();
      log.push(name);
      return result;
    });
  };
  const store = {
    getPosition: (ask) => {
      const d = deferred();
      pending.push({ name: ask ? 'position:ask' : 'position', d });
      return d.promise;
    },
    saveOnline: (pos) => hold('online', () => Object.assign(row, { is_online: true, ...pos, busy_until: null })),
    saveOffline: () => hold('offline', () => Object.assign(row, { is_online: false, lat: null, lng: null, busy_until: null })),
    saveHeartbeat: (pos) =>
      hold('heartbeat', () => {
        if (!row.is_online) return false;
        if (pos) Object.assign(row, pos);
        return true;
      }),
    saveBusy: (until) =>
      hold('busy', () => {
        if (!row.is_online) return false;
        row.busy_until = until;
        return true;
      }),
  };
  /** Resolves the oldest waiting call with this name. */
  async function release(name, value) {
    await flush();
    const i = pending.findIndex((p) => p.name === name);
    assert.ok(i >= 0, `nothing waiting for ${name}; waiting: ${pending.map((p) => p.name).join(', ') || 'none'}`);
    const [{ d }] = pending.splice(i, 1);
    d.resolve(value);
    await flush();
  }
  const waiting = () => pending.map((p) => p.name);
  return { store, row, log, release, waiting };
}

async function onlineRider() {
  const db = fakeStore();
  const rider = new RiderAvailability(db.store, { online: false, busyUntil: null });
  const going = rider.goOnline();
  await db.release('position:ask', HARGEISA);
  await db.release('online');
  await going;
  assert.equal(rider.getState().online, true);
  return { db, rider };
}

test('going online needs a location fix; without one nothing is written', async () => {
  const db = fakeStore();
  const rider = new RiderAvailability(db.store, { online: false, busyUntil: null });
  const going = rider.goOnline();
  assert.equal(rider.getState().pending, 'online');
  await db.release('position:ask', null);
  await going;
  assert.equal(rider.getState().online, false);
  assert.equal(rider.getState().error, 'noLocation');
  assert.equal(rider.getState().pending, null);
  assert.deepEqual(db.log, []);
  assert.equal(db.row.is_online, false);
});

test('online is shown only after the save succeeds', async () => {
  const db = fakeStore();
  const rider = new RiderAvailability(db.store, { online: false, busyUntil: null });
  const going = rider.goOnline();
  await db.release('position:ask', HARGEISA);
  assert.equal(rider.getState().online, false, 'still saving');
  await db.release('online');
  await going;
  assert.equal(rider.getState().online, true);
  assert.deepEqual(rider.getState().coords, HARGEISA);
  assert.deepEqual(db.row, { is_online: true, ...HARGEISA, busy_until: null });
});

test('a failed online save leaves the rider offline with an error', async () => {
  const db = fakeStore();
  const rider = new RiderAvailability(db.store, { online: false, busyUntil: null });
  const going = rider.goOnline();
  await db.release('position:ask', HARGEISA);
  await db.release('online', new Error('Network request failed'));
  await going;
  assert.equal(rider.getState().online, false);
  assert.equal(rider.getState().error, 'saveFailed');
});

test('a GPS fix that arrives after going offline is dropped (the reported bug)', async () => {
  const { db, rider } = await onlineRider();
  const beat = rider.heartbeat(); // waiting for GPS
  const leaving = rider.goOffline();
  await db.release('offline');
  await leaving;
  assert.equal(rider.getState().online, false);

  await db.release('position', MOVED); // the slow fix finally arrives
  await beat;
  await flush();
  assert.deepEqual(db.waiting(), [], 'no write was started');
  assert.deepEqual(db.log, ['online', 'offline']);
  assert.deepEqual(db.row, { is_online: false, lat: null, lng: null, busy_until: null });
  assert.equal(rider.getState().online, false);
});

test('an update already saving when the rider goes offline cannot turn them back on', async () => {
  const { db, rider } = await onlineRider();
  const beat = rider.heartbeat();
  await db.release('position', MOVED); // heartbeat write is now in flight
  const leaving = rider.goOffline();
  assert.deepEqual(db.waiting(), ['heartbeat'], 'offline waits behind the heartbeat');
  await db.release('heartbeat');
  await db.release('offline');
  await Promise.all([beat, leaving]);
  assert.deepEqual(db.log, ['online', 'heartbeat', 'offline'], 'writes land in order');
  assert.deepEqual(db.row, { is_online: false, lat: null, lng: null, busy_until: null });
  assert.equal(rider.getState().online, false);
});

test('the database condition stops a late update even if it overtakes the app', async () => {
  // Rider went offline on another phone; this phone's update must not revive them.
  const { db, rider } = await onlineRider();
  Object.assign(db.row, { is_online: false, lat: null, lng: null });
  const beat = rider.heartbeat();
  await db.release('position', MOVED);
  await db.release('heartbeat');
  await beat;
  assert.equal(db.row.is_online, false);
  assert.equal(db.row.lat, null);
  assert.equal(rider.getState().online, false);
  assert.equal(rider.getState().error, 'endedElsewhere');
});

test('a failed offline save keeps the rider online and updates carry on', async () => {
  const { db, rider } = await onlineRider();
  const leaving = rider.goOffline();
  assert.equal(rider.getState().pending, 'offline');
  await db.release('offline', new Error('Network request failed'));
  await leaving;
  assert.equal(rider.getState().online, true, 'the database still says online, so the screen does too');
  assert.equal(rider.getState().error, 'saveFailed');

  const beat = rider.heartbeat();
  await db.release('position', MOVED);
  await db.release('heartbeat');
  await beat;
  assert.deepEqual(db.row.lat, MOVED.lat);
  assert.equal(rider.getState().error, null, 'a successful update clears the save error');
});

test('no update runs while going offline is being saved', async () => {
  const { db, rider } = await onlineRider();
  const leaving = rider.goOffline();
  await rider.heartbeat();
  assert.deepEqual(db.waiting(), ['offline']);
  await db.release('offline');
  await leaving;
});

test('a lost GPS fix keeps the last position and warns; no internet warns but stays online', async () => {
  const { db, rider } = await onlineRider();
  let beat = rider.heartbeat();
  await db.release('position', null);
  await db.release('heartbeat');
  await beat;
  assert.deepEqual(db.row.lat, HARGEISA.lat, 'last position kept');
  assert.equal(rider.getState().locationFresh, false);
  assert.equal(rider.getState().online, true);

  beat = rider.heartbeat();
  await db.release('position', MOVED);
  await db.release('heartbeat', new Error('Network request failed'));
  await beat;
  assert.equal(rider.getState().connected, false);
  assert.equal(rider.getState().online, true);
});

test('overlapping updates do not pile up', async () => {
  const { db, rider } = await onlineRider();
  const first = rider.heartbeat();
  await rider.heartbeat(); // a second timer tick while the first is waiting for GPS
  assert.deepEqual(db.waiting(), ['position']);
  await db.release('position', MOVED);
  await db.release('heartbeat');
  await first;
});

test('busy is shown only after it is saved, and a failed save keeps the rider free', async () => {
  let now = Date.parse('2026-10-03T10:00:00Z');
  const db = fakeStore();
  const rider = new RiderAvailability(db.store, { online: false, busyUntil: null }, { busyMinutes: 45, now: () => now });
  const going = rider.goOnline();
  await db.release('position:ask', HARGEISA);
  await db.release('online');
  await going;

  let change = rider.setBusy(true);
  assert.equal(rider.isBusy(), false, 'not busy until saved');
  await db.release('busy', new Error('Network request failed'));
  await change;
  assert.equal(rider.isBusy(), false);
  assert.equal(rider.getState().error, 'saveFailed');

  change = rider.setBusy(true);
  await db.release('busy');
  await change;
  assert.equal(rider.getState().busyUntil, '2026-10-03T10:45:00.000Z');
  assert.equal(rider.isBusy(), true);
  now += 46 * 60_000;
  assert.equal(rider.isBusy(), false, 'busy runs out after 45 minutes');

  change = rider.setBusy(false);
  await db.release('busy');
  await change;
  assert.equal(db.row.busy_until, null);
});

test('going offline clears busy, and a busy save still waiting is dropped', async () => {
  const { db, rider } = await onlineRider();
  const beat = rider.heartbeat();
  const busy = rider.setBusy(true); // queued behind the heartbeat
  const leaving = rider.goOffline(); // allowed even while the busy change waits
  await db.release('position', MOVED);
  await db.release('offline');
  await Promise.all([beat, busy, leaving]);
  assert.deepEqual(db.waiting(), []);
  assert.deepEqual(db.log, ['online', 'offline']);
  assert.equal(db.row.busy_until, null);
  assert.equal(rider.isBusy(), false);
});

test('repeated taps while a change is saving are ignored', async () => {
  const db = fakeStore();
  const rider = new RiderAvailability(db.store, { online: false, busyUntil: null });
  const going = rider.goOnline();
  await rider.goOnline();
  await rider.goOffline();
  assert.deepEqual(db.waiting(), ['position:ask']);
  await db.release('position:ask', HARGEISA);
  await db.release('online');
  await going;
  assert.deepEqual(db.log, ['online']);
});

test('a rider who was online when the app opened resumes updates without a prompt', async () => {
  const db = fakeStore({ is_online: true, lat: 9.5, lng: 44, busy_until: null });
  const rider = new RiderAvailability(db.store, { online: true, busyUntil: null });
  const beat = rider.heartbeat();
  assert.deepEqual(db.waiting(), ['position'], 'updates never show the permission prompt');
  await db.release('position', MOVED);
  await db.release('heartbeat');
  await beat;
  assert.equal(db.row.lat, MOVED.lat);
});

test('withTimeout gives the fallback when the GPS is too slow or fails', async () => {
  assert.equal(await withTimeout(new Promise(() => {}), 5, 'fallback'), 'fallback');
  assert.equal(await withTimeout(Promise.reject(new Error('no gps')), 50, 'fallback'), 'fallback');
  assert.equal(await withTimeout(Promise.resolve('fix'), 50, 'fallback'), 'fix');
});
