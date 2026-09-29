import { LTR, PDI, type TKey } from '@/lib/i18n';
import type { OrderStatus, PaymentMethod, StoreCategory } from '@/lib/types';

// Hargeisa delivery areas: each xaafad (neighbourhood) with the degmo (district) it belongs to.
// Customers and riders pick the xaafad; the degmo is shown underneath. Add more as the service grows.
export const AREAS = [
  { id: 'Haleeya', district: 'Macalin Haaruun' },
  { id: 'Shiraaqle', district: 'Macalin Haaruun' },
  { id: 'Hodan Hills', district: 'Macalin Haaruun' },
  { id: 'Dooxa Weyn', district: '26 June' },
  { id: 'Suuqa', district: '26 June' },
  { id: 'Goljano', district: '26 June' },
  { id: 'New Hargeysa', district: 'Gacan Libaax' },
  { id: 'Bada Cas', district: 'Gacmo Dheere' },
] as const;

export const DEFAULT_AREA = AREAS[0].id;

/** Choice options for area pickers: the neighbourhood with its district underneath. */
export const AREA_OPTIONS = AREAS.map((a) => ({ id: a.id as string, label: a.id, hint: a.district as string }));

export const PAYMENT_METHODS: PaymentMethod[] = ['evc', 'zaad', 'sahal', 'cash'];
export const CATEGORIES: (StoreCategory | 'all')[] = ['all', 'food', 'cafe', 'shop', 'pharma'];
export const PACKAGE_TYPES = ['xirmo', 'warqad', 'cunto', 'kale'] as const;
export type PackageType = (typeof PACKAGE_TYPES)[number];

export const paymentKey = (id: PaymentMethod) => `pay.${id}` as TKey;
export const statusKey = (s: OrderStatus) => `status.${s}` as TKey;
export const statusLongKey = (s: OrderStatus) => `statusLong.${s}` as TKey;
export const packageKey = (id: string | null) =>
  (PACKAGE_TYPES.includes(id as PackageType) ? `pkg.${id}` : 'pkg.xirmo') as TKey;

/** Isolated as left-to-right text so it reads correctly inside Arabic sentences too. */
export function money(value: number) {
  return `${LTR}$${Number(value).toFixed(2)}${PDI}`;
}

/** Keeps digits only and drops a leading 252 or 0, so "063 4740002" becomes "634740002". */
export function normalizeLocalPhone(input: string) {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('252')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

// Launch market is Hargeisa, Somaliland: local numbers start with 3, 4, 6 or 9 (for example 63 474 0002).
export function isValidLocalPhone(digits: string) {
  return /^[3469]\d{6,8}$/.test(digits);
}

export function toE164(digits: string) {
  return `+252${digits}`;
}

export function formatPhone(phone: string | null | undefined) {
  if (!phone) return '';
  const local = normalizeLocalPhone(phone);
  return `${LTR}+252 ${local.replace(/(\d{2})(\d{3})(\d+)/, '$1 $2 $3')}${PDI}`;
}
