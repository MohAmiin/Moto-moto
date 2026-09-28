import type { OrderStatus, PaymentMethod, StoreCategory } from '@/lib/types';

// Mogadishu districts for launch. Add more as the service grows.
export const DISTRICTS = [
  'Hodan',
  'Waaberi',
  'Hawl-Wadaag',
  'Wadajir',
  'Dharkenley',
  'Yaaqshiid',
  'Kaaraan',
  'Shibis',
  'Boondheere',
  'Xamar Weyne',
  'Xamar Jajab',
  'Shangaani',
  'Wardhiigleey',
  'Heliwaa',
] as const;

export const PAYMENT_METHODS: { id: PaymentMethod; label: string; hint: string }[] = [
  { id: 'evc', label: 'EVC Plus', hint: 'Mobile money' },
  { id: 'zaad', label: 'Zaad', hint: 'Mobile money' },
  { id: 'sahal', label: 'Sahal', hint: 'Mobile money' },
  { id: 'cash', label: 'Lacag caddaan', hint: 'Gacanta darawalka' },
];

export const CATEGORIES: { id: StoreCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'Dhammaan' },
  { id: 'food', label: 'Maqaayado' },
  { id: 'cafe', label: 'Qaxwo' },
  { id: 'shop', label: 'Raashin' },
  { id: 'pharma', label: 'Farmashiye' },
];

export const PACKAGE_TYPES = [
  { id: 'xirmo', label: 'Xirmo' },
  { id: 'warqad', label: 'Warqado' },
  { id: 'cunto', label: 'Cunto' },
  { id: 'kale', label: 'Kale' },
] as const;

export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: 'Darawal ayaa la raadinayaa',
  accepted: 'Darawalku wuu soo socdaa',
  picked_up: 'Dalabkaagu jidka ayuu ku jiraa',
  delivered: 'Waa la keenay',
  cancelled: 'Waa la joojiyay',
};

export const STATUS_SHORT: Record<OrderStatus, string> = {
  placed: 'Sugaya',
  accepted: 'Socda',
  picked_up: 'Jidka',
  delivered: 'La keenay',
  cancelled: 'La joojiyay',
};

export function paymentLabel(id: PaymentMethod) {
  return PAYMENT_METHODS.find((p) => p.id === id)?.label ?? id;
}

export function packageLabel(id: string | null) {
  return PACKAGE_TYPES.find((p) => p.id === id)?.label ?? 'Xirmo';
}

export function money(value: number) {
  return `$${Number(value).toFixed(2)}`;
}

/** Keeps digits only and drops a leading 252 or 0, so "0615 551234" becomes "615551234". */
export function normalizeLocalPhone(input: string) {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('252')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

export function isValidLocalPhone(digits: string) {
  return /^[6-9]\d{7,8}$/.test(digits);
}

export function toE164(digits: string) {
  return `+252${digits}`;
}

export function formatPhone(phone: string | null | undefined) {
  if (!phone) return '';
  const local = normalizeLocalPhone(phone);
  return `+252 ${local.replace(/(\d{2})(\d{3})(\d+)/, '$1 $2 $3')}`;
}
