import { StyleSheet, View } from 'react-native';

import { RiderAvatar } from '@/components/rider-avatar';
import { Button, Card, Pill, Row, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { callRider } from '@/lib/call';
import { distanceLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { ratingLabel, riderCode } from '@/lib/rider';
import type { NearbyRider } from '@/lib/types';

/** One online driver with photo, Jareeye number, rating, distance and plate, and a button that calls them. */
export function RiderCard({ rider }: { rider: NearbyRider }) {
  const theme = useTheme();
  const { t } = useI18n();
  const distance = distanceLabel(rider.distance_km, t);
  const code = riderCode(rider.rider_number);
  const rating = ratingLabel(rider.rating);
  return (
    <Card>
      <Row gap={Spacing.three}>
        <RiderAvatar name={rider.full_name} photoPath={rider.photo_path} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt style={{ fontWeight: '800', fontSize: 16 }}>{rider.full_name}</Txt>
          <Row gap={Spacing.two}>
            {code ? <Txt style={{ fontWeight: '700', fontSize: 13, color: theme.brand }}>{code}</Txt> : null}
            <Txt style={{ fontSize: 13, fontWeight: '700' }}>
              {rating ? t('rating.value', { rating, count: rider.rating_count }) : t('rating.new')}
            </Txt>
          </Row>
          <Txt variant="muted">
            {distance ?? (rider.area ? t('home.inArea', { area: rider.area }) : '')}
            {distance && rider.area ? ` · ${rider.area}` : ''}
          </Txt>
        </View>
        <View style={{ alignItems: 'flex-end', gap: Spacing.one }}>
          <View style={[styles.plate, { borderColor: theme.text }]}>
            <Txt style={{ fontWeight: '800', fontSize: 12 }}>{rider.plate}</Txt>
          </View>
          {rider.is_busy ? <Pill label={t('rider.busy')} tone="warning" /> : null}
        </View>
      </Row>
      {rider.phone ? (
        <Button title={t('home.call')} kind="gold" onPress={() => callRider(rider.id, rider.phone!)} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  plate: { borderWidth: 1.5, borderRadius: Radius.small - 4, paddingHorizontal: 6, paddingVertical: 2 },
});
