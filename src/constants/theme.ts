// Blue from the Somali flag, gold for the $1 delivery promise.
export const Colors = {
  light: {
    text: '#121826',
    textSecondary: '#5C6678',
    background: '#FFFFFF',
    backgroundElement: '#F2F5F9',
    backgroundSelected: '#E3ECFA',
    border: '#DCE2EA',
    brand: '#2462C4',
    onBrand: '#FFFFFF',
    gold: '#FFC21A',
    onGold: '#1A1400',
    success: '#1F8A5B',
    successSoft: '#DFF3E8',
    warning: '#A96A12',
    warningSoft: '#FBEFD8',
    danger: '#C23B2A',
    dangerSoft: '#F9E1DD',
  },
  dark: {
    text: '#E8EDF5',
    textSecondary: '#9AA5B8',
    background: '#0B0F17',
    backgroundElement: '#1C2432',
    backgroundSelected: '#18284A',
    border: '#283246',
    brand: '#5A95EA',
    onBrand: '#08111F',
    gold: '#FFC933',
    onGold: '#1A1400',
    success: '#4CC38A',
    successSoft: '#163224',
    warning: '#E3A84A',
    warningSoft: '#3A2D16',
    danger: '#EE7A68',
    dangerSoft: '#3B201C',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type Palette = { [K in ThemeColor]: string };

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  small: 10,
  medium: 14,
  large: 20,
  pill: 999,
} as const;

export const MaxContentWidth = 560;
