import { StyleSheet, View } from 'react-native';

import { Button, Card, Monogram, Row, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { distanceLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { callPhone, openWhatsApp } from '@/lib/location';
import type { NearbyRider } from '@/lib/types';

/** One online rider with distance, plate and buttons to call or WhatsApp them. */
export function RiderCard({ rider }: { rider: NearbyRider }) {
  const theme = useTheme();
  const { t } = useI18n();
  const distance = distanceLabel(rider.distance_km, t);
  return (
    <Card>
      <Row gap={Spacing.three}>
        <Monogram name={rider.full_name} size={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt style={{ fontWeight: '800', fontSize: 16 }}>{rider.full_name}</Txt>
          <Txt variant="muted">
            {distance ?? (rider.area ? t('home.inArea', { area: rider.area }) : '')}
            {distance && rider.area ? ` · ${rider.area}` : ''}
          </Txt>
        </View>
        <View style={[styles.plate, { borderColor: theme.text }]}>
          <Txt style={{ fontWeight: '800', fontSize: 12 }}>{rider.plate}</Txt>
        </View>
      </Row>
      {rider.phone ? (
        <Row gap={Spacing.two}>
          <Button title={t('home.call')} kind="gold" onPress={() => callPhone(rider.phone!)} style={{ flex: 1 }} />
          <Button title={t('home.whatsapp')} kind="ghost" onPress={() => openWhatsApp(rider.phone!)} style={{ flex: 1 }} />
        </Row>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  plate: { borderWidth: 1.5, borderRadius: Radius.small - 4, paddingHorizontal: 6, paddingVertical: 2 },
});
