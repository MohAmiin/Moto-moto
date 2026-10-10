import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';

import { Fonts, fontFor, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Text and a few small pieces shared by every screen. Layout, panels, buttons and fields are in
// components/kit.tsx.

/** Turns fontWeight into the matching Rubik font file (custom fonts can't be bolded on Android). */
export function withFont(style: StyleProp<TextStyle>): TextStyle {
  const { fontWeight, ...rest } = StyleSheet.flatten(style) ?? {};
  return { ...rest, fontFamily: rest.fontFamily ?? fontFor(fontWeight) };
}

export function Row({ children, style, gap = 8 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

type Variant = 'body' | 'muted';

export function Txt({ variant = 'body', color, style, ...rest }: TextProps & { variant?: Variant; color?: ThemeColor }) {
  const theme = useTheme();
  const defaultColor: ThemeColor = variant === 'muted' ? 'textSecondary' : 'text';
  return <Text style={withFont([{ color: theme[color ?? defaultColor] }, text[variant], style])} {...rest} />;
}

/** A text link with a comfortable touch area. */
export function LinkButton({ title, onPress }: { title: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={styles.link}>
      <Text style={withFont([styles.linkText, { color: theme.primaryText }])}>{title}</Text>
    </Pressable>
  );
}

/** Coloured circle or square with initials, for people without a photo. */
export function Monogram({ name, size = 56, radius }: { name: string; size?: number; radius?: number }) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: radius ?? size * 0.28, backgroundColor: `hsl(${hash}, 55%, 42%)`, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontFamily: Fonts.medium, fontSize: size * 0.34 }}>{initials}</Text>
    </View>
  );
}

const text = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 22 },
  muted: { fontSize: 14, lineHeight: 20 },
});

const styles = StyleSheet.create({
  link: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center' },
  linkText: { fontSize: 14, fontWeight: '500' },
});
