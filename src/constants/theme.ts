// Jareeye brand, from the logo: royal blue for structure and primary buttons, orange for main actions.
// The `gold` / `onGold` slots hold the orange accent.
export const Colors = {
  light: {
    text: '#14213D',
    textSecondary: '#5E6472',
    background: '#FFFFFF',
    backgroundElement: '#F5F3F0',
    backgroundSelected: '#E5EDFA',
    border: '#E6E1DA',
    brand: '#0046B5',
    onBrand: '#FFFFFF',
    gold: '#FF6B0A',
    onGold: '#14213D',
    success: '#1F8A5B',
    successSoft: '#DFF3E8',
    warning: '#A95A12',
    warningSoft: '#FBEBD8',
    danger: '#C23B2A',
    dangerSoft: '#F9E1DD',
  },
  dark: {
    text: '#EEF1F7',
    textSecondary: '#9CA3B4',
    background: '#0D1220',
    backgroundElement: '#1A2236',
    backgroundSelected: '#3A2414',
    border: '#283246',
    brand: '#FF8A3D',
    onBrand: '#14213D',
    gold: '#FF6B0A',
    onGold: '#14213D',
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
