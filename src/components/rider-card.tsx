import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Icons, OnlineDot } from '@/components/feed';
import { RiderAvatar } from '@/components/rider-avatar';
import { Pill, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { callRider } from '@/lib/call';
import { minutesAway } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { ratingLabel, riderCode } from '@/lib/rider';
import type { NearbyRider } from '@/lib/types';

/** One online driver as a list row: photo, name, Jareeye number, rating, time away and area, and a call button. */
export function RiderCard({ rider, last = false }: { rider: NearbyRider; last?: boolean }) {
  const theme = useTheme();
  const { t } = useI18n();
  const code = riderCode(rider.rider_number);
  const rating = ratingLabel(rider.rating);
  const minutes = minutesAway(rider.distance_km);
  const meta = [
    rating ? `★ ${rating}${rider.rating_count ? ` (${rider.rating_count})` : ''}` : t('rating.new'),
    rider.area,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
      <View>
        <RiderAvatar name={rider.full_name} photoPath={rider.photo_path} size={48} round />
        <View style={styles.dot}>
          <OnlineDot size={12} ring={theme.background} />
        </View>
      </View>
      <View style={styles.info}>
        <Txt style={styles.name} numberOfLines={1}>{rider.full_name}</Txt>
        <View style={styles.codeRow}>
          <Txt style={[styles.code, { color: theme.brand }]} numberOfLines={1}>{[code, rider.plate].filter(Boolean).join(' · ')}</Txt>
          {rider.is_busy ? <Pill label={t('rider.busy')} tone="warning" /> : null}
        </View>
        <Txt variant="muted" style={styles.meta} numberOfLines={1}>{meta}</Txt>
      </View>
      {minutes != null ? (
        <View style={styles.time}>
          <Txt style={styles.timeValue}>{minutes}</Txt>
          <Txt variant="muted" style={styles.timeUnit}>{t('home.min')}</Txt>
        </View>
      ) : null}
      {rider.phone ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.callName', { name: rider.full_name })}
          onPress={() => callRider(rider.id, rider.phone!)}
          hitSlop={6}
          style={({ pressed }) => [styles.call, { backgroundColor: theme.gold, opacity: pressed ? 0.8 : 1 }]}>
          <Icon source={Icons.phone} size={22} color="#FFFFFF" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three - 4 },
  dot: { position: 'absolute', right: -1, bottom: -1 },
  info: { flex: 1, gap: 1 },
  name: { fontSize: 16, fontWeight: '700' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  code: { fontSize: 12, fontWeight: '700' },
  meta: { fontSize: 13 },
  time: { alignItems: 'center', minWidth: 32 },
  timeValue: { fontSize: 18, lineHeight: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  timeUnit: { fontSize: 11, lineHeight: 14 },
  call: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
