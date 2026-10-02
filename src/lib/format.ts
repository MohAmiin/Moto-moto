import { LTR, PDI, type TKey } from '@/lib/i18n';

// Hargeisa's eight districts (degmooyin). Customers and drivers pick one; it is stored in profiles.district.
export const AREAS = [
  'Koodbuur',
  '26 June',
  'Gacan Libaax',
  'Macalin Haaruun',
  'Ahmed Dhagax',
  'Maxamed Mooge',
  'Maxamuud Haybe',
  '31 May',
] as const;

export const DEFAULT_AREA: string = AREAS[0];

/** Choice options for area pickers. */
export const AREA_OPTIONS = AREAS.map((a) => ({ id: a as string, label: a }));

/** The saved area if it is one of the districts, otherwise the first district. */
export function toDistrict(area: string | null | undefined) {
  return area && (AREAS as readonly string[]).includes(area) ? area : DEFAULT_AREA;
}

/** "350 m away" under 1 km, otherwise "2.4 km away". */
export function distanceLabel(km: number | null, t: (key: TKey, vars?: Record<string, string | number>) => string) {
  if (km == null) return null;
  return km < 1 ? t('home.mAway', { m: Math.max(50, Math.round((km * 1000) / 50) * 50) }) : t('home.kmAway', { km: km.toFixed(1) });
}

/** Telesom's mobile prefix in Hargeisa; people often give only the 7 digits after it. */
export const DEFAULT_OPERATOR_PREFIX = '63';

/**
 * Keeps digits only, drops a leading 252 or 0, and adds 63 to a bare 7-digit number,
 * so "063 4740002", "+252 63 4740002" and "474 0002" all become "634740002".
 */
export function normalizeLocalPhone(input: string) {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('252')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 7) digits = DEFAULT_OPERATOR_PREFIX + digits;
  return digits;
}

// Any number that can receive the SMS code is allowed. Hargeisa numbers usually start with 3, 4, 6 or 9
// (for example 63 474 0002), but we only check the length; the SMS itself proves the number works.
export function isValidLocalPhone(digits: string) {
  return /^\d{6,10}$/.test(digits);
}

export function toE164(digits: string) {
  return `+252${digits}`;
}

export function formatPhone(phone: string | null | undefined) {
  if (!phone) return '';
  const local = normalizeLocalPhone(phone);
  return `${LTR}+252 ${local.replace(/(\d{2})(\d{3})(\d+)/, '$1 $2 $3')}${PDI}`;
}
