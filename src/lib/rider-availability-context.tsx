import { createContext, use, useEffect, type ReactNode } from 'react';

import { useRiderAvailability } from '@/hooks/use-rider-availability';
import { useAuth } from '@/lib/auth';

type Availability = ReturnType<typeof useRiderAvailability>;

const AvailabilityContext = createContext<Availability | null>(null);

/**
 * One availability controller for an approved rider's tabs, so the 30-second location updates keep
 * running whichever tab is open (they still pause when the app leaves the screen).
 */
export function RiderAvailabilityProvider({ riderId, children }: { riderId: string; children: ReactNode }) {
  const { profile, refresh } = useAuth();
  const value = useRiderAvailability(riderId, { online: profile?.is_online ?? false, busyUntil: profile?.busy_until ?? null });

  // Keep the signed-in profile in step once a change is saved, so a reopened screen starts right.
  useEffect(() => {
    refresh();
  }, [value.online, refresh]);

  return <AvailabilityContext value={value}>{children}</AvailabilityContext>;
}

export function useAvailability() {
  const value = use(AvailabilityContext);
  if (!value) throw new Error('useAvailability must be used inside RiderAvailabilityProvider');
  return value;
}
