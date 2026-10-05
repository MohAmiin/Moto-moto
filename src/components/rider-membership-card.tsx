import { StyleSheet, View } from 'react-native';

import { Badge, InfoLine, Notice, Panel, SectionTitle } from '@/components/kit';
import { Txt } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { MEMBERSHIP_LOOK, needsPayment, usd, type MyMembership } from '@/lib/membership';

/**
 * The rider's membership while paid membership is on: status, end date and days left, a warning in the
 * last 3 days, and after it ends what to do (the admin's payment and contact instructions).
 * Renders nothing while membership is off (status "free") or not loaded.
 */
export function RiderMembershipCard({ membership, compact = false }: { membership: MyMembership | null | undefined; compact?: boolean }) {
  const { t, locale } = useI18n();
  if (!membership || membership.status === 'free') return null;

  const look = MEMBERSHIP_LOOK[membership.status];
  const until = membership.expires_at
    ? new Date(membership.expires_at).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  const due = needsPayment(membership.status);
  const howToPay = membership.instructions || t('mem.noInstructions');

  return (
    <>
      {membership.status === 'expiring' ? (
        <Notice
          icon="clock"
          title={t('mem.endsSoon', { n: membership.days_left ?? 0, date: until ?? '' })}
          body={`${t('mem.renewBody', { price: usd(membership.price_usd) })}\n${howToPay}`}
        />
      ) : due ? (
        <Notice
          icon="attention"
          tone="danger"
          title={t(membership.status === 'unpaid' ? 'mem.unpaidTitle' : 'mem.expiredTitle')}
          body={`${t('mem.blockedBody', { price: usd(membership.price_usd) })}\n${howToPay}`}
        />
      ) : null}

      {compact ? null : (
        <>
          <SectionTitle title={t('mem.sectionTitle')} />
          <Panel>
            <View style={styles.head}>
              <Badge label={t(look.label)} tone={look.tone} />
              {membership.expires_at && !due ? (
                <Txt variant="muted" style={styles.small}>
                  {t('mem.daysLeft', { n: membership.days_left ?? 0 })}
                </Txt>
              ) : null}
            </View>
            <InfoLine label={t(due ? 'mem.endedLabel' : 'mem.validUntil')} value={until} />
            <InfoLine label={t('mem.monthly')} value={usd(membership.price_usd)} />
            <InfoLine label={t('mem.howToPay')} value={howToPay} last />
          </Panel>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  small: { fontSize: 13, lineHeight: 18 },
});
