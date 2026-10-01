// Jareeye brand, from the logo: royal blue for structure and primary buttons, orange for main actions.
// The `gold` / `onGold` slots hold the orange accent.
export const Colors = {
  light: {
    text: '#0D1220',
    textSecondary: '#6B7385',
    background: '#FFFFFF',
    backgroundElement: '#F4F6FA',
    backgroundSelected: '#E8EFFC',
    border: '#E4E8F0',
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
    backgroundSelected: '#1C2A4A',
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
  small: 12,
  medium: 16,
  large: 24,
  pill: 999,
} as const;

/** Rubik, the rounded font of the logo. Loaded in the root layout; each weight is its own font file. */
export const Fonts = {
  regular: 'Rubik_400Regular',
  medium: 'Rubik_500Medium',
  bold: 'Rubik_700Bold',
  heavy: 'Rubik_800ExtraBold',
} as const;

/** The Rubik file for a font weight; custom fonts can't be made bold with fontWeight on Android. */
export function fontFor(weight: string | number | undefined) {
  const w = Number(weight === 'bold' ? 700 : weight === 'normal' || weight == null ? 400 : weight);
  return w >= 800 ? Fonts.heavy : w >= 700 ? Fonts.bold : w >= 500 ? Fonts.medium : Fonts.regular;
}

export const MaxContentWidth = 560;
