import { Image, type ImageSource } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Txt } from '@/components/ui';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Building blocks for the feed-style home screens: flat white sections split by a grey band,
// figures with a small label above, and a highlight box with an orange icon.

export const Icons = {
  home: require('@/assets/icons/home.png'),
  user: require('@/assets/icons/user.png'),
  award: require('@/assets/icons/award.png'),
  flame: require('@/assets/icons/flame.png'),
  motorbike: require('@/assets/icons/motorbike.png'),
  star: require('@/assets/icons/star.png'),
  map: require('@/assets/icons/map.png'),
  clock: require('@/assets/icons/clock.png'),
  route: require('@/assets/icons/route.png'),
  phone: require('@/assets/icons/phone.png'),
  locate: require('@/assets/icons/locate.png'),
} as const;

/** A single-colour icon from assets/icons. */
export function Icon({ source, size = 20, color }: { source: ImageSource | number; size?: number; color: string }) {
  return <Image source={source} style={{ width: size, height: size }} tintColor={color} contentFit="contain" />;
}

/** A full-width block of the feed. `band` adds the grey divider below it. */
export function Section({ children, band = true, style }: { children: ReactNode; band?: boolean; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View style={band ? { borderBottomWidth: 8, borderBottomColor: theme.backgroundElement } : null}>
      <View style={[styles.section, style]}>{children}</View>
    </View>
  );
}

export type StatItem = { label: string; value: string };

/** Figures in a row, each with a small grey label above a bold value. */
export function Stats({ items }: { items: StatItem[] }) {
  return (
    <View style={styles.stats}>
      {items.map((s) => (
        <View key={s.label} style={styles.stat}>
          <Txt variant="muted" style={styles.statLabel} numberOfLines={1}>
            {s.label}
          </Txt>
          <Txt style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
            {s.value}
          </Txt>
        </View>
      ))}
    </View>
  );
}

/** A soft grey box with an orange icon, for a badge or a short tip. */
export function Callout({ icon, title, body }: { icon: ImageSource | number; title?: string; body: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.callout, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Icon source={icon} size={26} color={theme.gold} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Txt style={styles.calloutTitle}>{title}</Txt> : null}
        <Txt variant="muted" style={{ fontSize: 13, lineHeight: 18 }}>
          {body}
        </Txt>
      </View>
    </View>
  );
}

/** Small green dot that says "online". */
export function OnlineDot({ size = 8, ring }: { size?: number; ring?: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.success,
        borderWidth: ring ? 2 : 0,
        borderColor: ring,
      }}
    />
  );
}

const styles = StyleSheet.create({
  section: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, gap: Spacing.three },
  stats: { flexDirection: 'row', gap: Spacing.two },
  stat: { flex: 1, gap: 2 },
  statLabel: { fontSize: 13 },
  statValue: { fontSize: 20, lineHeight: 26, fontWeight: '700', fontVariant: ['tabular-nums'] },
  callout: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three - 4 },
  calloutTitle: { fontSize: 14, fontWeight: '700' },
});
