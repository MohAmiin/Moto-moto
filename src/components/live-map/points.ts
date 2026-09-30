import { distanceLabel } from '@/lib/format';
import type { Translate } from '@/lib/i18n';
import { ratingLabel, riderCode } from '@/lib/rider';
import type { NearbyRider } from '@/lib/types';

import type { MapPoint } from './map-html';

/** Riders with a known position, as map markers: name, then number, rating, plate and distance in the popup. */
export function riderPoints(riders: NearbyRider[], t: Translate): MapPoint[] {
  return riders
    .filter((r) => r.lat != null && r.lng != null)
    .map((r) => ({
      id: r.id,
      lat: r.lat!,
      lng: r.lng!,
      title: r.full_name,
      subtitle: [riderCode(r.rider_number), ratingLabel(r.rating) && `★ ${ratingLabel(r.rating)}`, r.plate, distanceLabel(r.distance_km, t)]
        .filter(Boolean)
        .join(' · ')
        .replace(/[⁦⁩]/g, ''),
    }));
}
