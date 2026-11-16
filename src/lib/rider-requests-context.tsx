import { createContext, use, type ReactNode } from 'react';

import { useActiveJob, useRiderOffers } from '@/lib/requests';
import type { RequestOffer } from '@/lib/types';

type RiderRequests = {
  offers: RequestOffer[];
  reloadOffers: () => void;
  /** The current job (accepted or picked up); undefined while loading. */
  jobId: string | null | undefined;
  reloadJob: () => void;
};

const Ctx = createContext<RiderRequests | null>(null);

/** One live view of the rider's offers and current job, shared by the request card and the Home screen. */
export function RiderRequestsProvider({ riderId, children }: { riderId: string; children: ReactNode }) {
  const { offers, reload: reloadOffers } = useRiderOffers(riderId);
  const { jobId, reload: reloadJob } = useActiveJob(riderId);
  return <Ctx value={{ offers, reloadOffers, jobId, reloadJob }}>{children}</Ctx>;
}

export function useRiderRequests() {
  const value = use(Ctx);
  if (!value) throw new Error('useRiderRequests must be used inside RiderRequestsProvider');
  return value;
}
