// The rider's online / busy state, kept in step with the database.
//
// Plain TypeScript with no React Native imports, so the timing rules can be checked with
// `npm test`. The rider screen wires it to Supabase and expo-location (see use-rider-availability).
//
// Rules:
// - Every database write goes through one queue, so a slow write can never land after a later one.
// - The screen only changes after a write succeeds; a failed write leaves the old state and shows an error.
// - Going online needs a location fix. Without one the rider stays offline.
// - The 30-second update only refreshes a rider who is still online in the database (the save checks
//   is_online), so a late update can never turn an offline rider back on.
// - Going offline makes every update still in flight stale. Stale updates are dropped before they write.

export type Coords = { lat: number; lng: number };

export type AvailabilityError =
  /** No position: location is off, permission was refused, or GPS took too long. */
  | 'noLocation'
  /** A save failed, usually no internet. The previous state is kept. */
  | 'saveFailed'
  /** The database says the rider is offline (for example they went offline on another phone). */
  | 'endedElsewhere';

export type AvailabilityState = {
  online: boolean;
  /** ISO time while on a delivery; null when free. */
  busyUntil: string | null;
  /** A change is being saved; the switch and buttons should wait. */
  pending: 'online' | 'offline' | 'busy' | 'free' | null;
  coords: Coords | null;
  /** The last update got a fresh position. null before the first update. */
  locationFresh: boolean | null;
  /** The last 30-second update reached the database. null before the first update. */
  connected: boolean | null;
  error: AvailabilityError | null;
};

export type AvailabilityStore = {
  /**
   * Returns a position, or null when none is available in time. `ask` is true when going online,
   * where the permission prompt may be shown; the 30-second updates never prompt.
   */
  getPosition(ask: boolean): Promise<Coords | null>;
  /** Marks the rider online at this position. Throws on failure. */
  saveOnline(pos: Coords): Promise<void>;
  /** Marks the rider offline and clears position and busy time. Throws on failure. */
  saveOffline(): Promise<void>;
  /**
   * Refreshes "last seen" (and the position when there is one), but only while the rider is still
   * online in the database. Returns false when they are not. Throws on failure.
   */
  saveHeartbeat(pos: Coords | null): Promise<boolean>;
  /** Sets or clears the busy time while online. Returns false when the rider is not online. Throws on failure. */
  saveBusy(until: string | null): Promise<boolean>;
};

export type AvailabilityOptions = {
  /** How long "I'm on a delivery" hides the rider. */
  busyMinutes?: number;
  now?: () => number;
};

export class RiderAvailability {
  private state: AvailabilityState;
  private listeners = new Set<() => void>();
  private queue: Promise<unknown> = Promise.resolve();
  // Bumped on every online/offline change; updates started under an older value are dropped.
  private epoch = 0;
  private heartbeatRunning = false;
  private readonly busyMs: number;
  private readonly now: () => number;
  private readonly store: AvailabilityStore;

  constructor(
    store: AvailabilityStore,
    initial: { online: boolean; busyUntil: string | null },
    options: AvailabilityOptions = {},
  ) {
    this.store = store;
    this.busyMs = (options.busyMinutes ?? 45) * 60_000;
    this.now = options.now ?? Date.now;
    this.state = {
      online: initial.online,
      busyUntil: initial.online ? initial.busyUntil : null,
      pending: null,
      coords: null,
      locationFresh: null,
      connected: null,
      error: null,
    };
  }

  getState = (): AvailabilityState => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** True while on a delivery that hasn't run out yet. */
  isBusy(at = this.now()) {
    const { online, busyUntil } = this.state;
    return online && busyUntil != null && new Date(busyUntil).getTime() > at;
  }

  async goOnline() {
    if (this.state.online || this.state.pending) return;
    const epoch = ++this.epoch;
    this.set({ pending: 'online', error: null });

    const pos = await this.store.getPosition(true);
    if (epoch !== this.epoch) return;
    if (!pos) {
      this.set({ pending: null, error: 'noLocation', locationFresh: false });
      return;
    }

    await this.enqueue(async () => {
      if (epoch !== this.epoch) return;
      try {
        await this.store.saveOnline(pos);
        if (epoch !== this.epoch) return;
        this.set({ online: true, busyUntil: null, pending: null, coords: pos, locationFresh: true, connected: true, error: null });
      } catch {
        if (epoch !== this.epoch) return;
        this.set({ pending: null, error: 'saveFailed' });
      }
    });
  }

  async goOffline() {
    if (!this.state.online || this.state.pending === 'offline') return;
    const epoch = ++this.epoch;
    this.set({ pending: 'offline', error: null });

    await this.enqueue(async () => {
      try {
        await this.store.saveOffline();
        if (epoch !== this.epoch) return;
        this.set({ online: false, busyUntil: null, pending: null, coords: null, locationFresh: null, connected: null, error: null });
      } catch {
        if (epoch !== this.epoch) return;
        // Still online in the database: say so, and let the 30-second updates carry on.
        this.set({ pending: null, error: 'saveFailed' });
      }
    });
  }

  /** "I'm on a delivery" (true) or "I'm free again" (false). */
  async setBusy(next: boolean) {
    if (!this.state.online || this.state.pending) return;
    const epoch = this.epoch;
    const until = next ? new Date(this.now() + this.busyMs).toISOString() : null;
    this.set({ pending: next ? 'busy' : 'free', error: null });

    await this.enqueue(async () => {
      if (epoch !== this.epoch) return;
      try {
        const stillOnline = await this.store.saveBusy(until);
        if (epoch !== this.epoch) return;
        if (!stillOnline) this.endedElsewhere();
        else this.set({ busyUntil: until, pending: null, error: null });
      } catch {
        if (epoch !== this.epoch) return;
        this.set({ pending: null, error: 'saveFailed' });
      }
    });
  }

  /** The 30-second update. Safe to call at any time; does nothing while offline or already running. */
  async heartbeat() {
    if (!this.state.online || this.heartbeatRunning) return;
    if (this.state.pending === 'offline' || this.state.pending === 'online') return;
    const epoch = this.epoch;
    this.heartbeatRunning = true;
    try {
      const pos = await this.store.getPosition(false);
      if (epoch !== this.epoch || !this.state.online) return;

      await this.enqueue(async () => {
        if (epoch !== this.epoch || !this.state.online) return;
        try {
          const stillOnline = await this.store.saveHeartbeat(pos);
          if (epoch !== this.epoch) return;
          if (!stillOnline) {
            this.endedElsewhere();
            return;
          }
          this.set({
            // Without a fresh fix the last saved position is kept.
            coords: pos ?? this.state.coords,
            locationFresh: pos != null,
            connected: true,
            error: this.state.error === 'saveFailed' ? null : this.state.error,
          });
        } catch {
          if (epoch !== this.epoch) return;
          this.set({ connected: false });
        }
      });
    } finally {
      this.heartbeatRunning = false;
    }
  }

  clearError() {
    if (this.state.error) this.set({ error: null });
  }

  private endedElsewhere() {
    this.epoch++;
    this.set({ online: false, busyUntil: null, pending: null, coords: null, locationFresh: null, connected: null, error: 'endedElsewhere' });
  }

  private enqueue(task: () => Promise<void>) {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => {});
    return run;
  }

  private set(patch: Partial<AvailabilityState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}

/** Resolves with the promise's value, or with `fallback` if it takes longer than `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}
