import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { RiderAvatar } from '@/components/rider-avatar';
import { Pill, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { callRider } from '@/lib/call';
import { distanceLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { ratingLabel, riderCode } from '@/lib/rider';
import type { NearbyRider } from '@/lib/types';

/** One online driver: photo, name, Jareeye number, rating, distance and area, and a round call button. */
export function RiderCard({ rider }: { rider: NearbyRider }) {
  const theme = useTheme();
  const { t } = useI18n();
  const distance = distanceLabel(rider.distance_km, t);
  const code = riderCode(rider.rider_number);
  const rating = ratingLabel(rider.rating);
  const meta = [
    rating ? `★ ${rating}` : t('rating.new'),
    distance,
    rider.area,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <RiderAvatar name={rider.full_name} photoPath={rider.photo_path} size={54} />
      <View style={styles.info}>
        <Txt style={styles.name} numberOfLines={1}>{rider.full_name}</Txt>
        <View style={styles.codeRow}>
          <Txt style={[styles.code, { color: theme.brand }]}>{[code, rider.plate].filter(Boolean).join(' · ')}</Txt>
          {rider.is_busy ? <Pill label={t('rider.busy')} tone="warning" /> : null}
        </View>
        <Txt variant="muted" style={styles.meta} numberOfLines={1}>{meta}</Txt>
      </View>
      {rider.phone ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('home.call')} ${rider.full_name}`}
          onPress={() => callRider(rider.id, rider.phone!)}
          hitSlop={6}
          style={({ pressed }) => [styles.call, { backgroundColor: theme.gold, opacity: pressed ? 0.8 : 1 }]}>
          <Image source={require('@/assets/icons/phone.png')} style={styles.callIcon} tintColor="#FFFFFF" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three - 4, borderRadius: Radius.large - 4 },
  info: { flex: 1, gap: 1 },
  name: { fontSize: 16, fontWeight: '700' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  code: { fontSize: 12, fontWeight: '700' },
  meta: { fontSize: 13 },
  call: {
    width: 52,
    height: 52,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B0A',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  callIcon: { width: 24, height: 24 },
});
