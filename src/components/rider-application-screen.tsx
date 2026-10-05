import { StyleSheet, View } from 'react-native';

import { AdminButton, AdminIcon, AdminScreen, Badge, InfoLine, Notice, Panel, SectionTitle, TopBar } from '@/components/kit';
import { DeleteAccount } from '@/components/delete-account';
import { PhoneCheck } from '@/components/phone-check';
import { Preferences } from '@/components/preferences';
import { RiderApplicationForm } from '@/components/rider-application-form';
import { Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { formatPhone } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

/**
 * A rider who isn't approved yet: the application form (first time, or to resubmit after a rejection),
 * or the pending status with the steps left, including the phone check.
 */
export function RiderApplicationScreen() {
  const { t, locale } = useI18n();
  const { profile, application, signOut } = useAuth();
  if (!profile) return null;

  const footer = (
    <>
      <Preferences />
      <AdminButton title={t('common.signOut')} kind="danger" icon="signOut" onPress={signOut} style={{ marginTop: Spacing.two }} />
      <DeleteAccount />
    </>
  );

  if (!application || application.status === 'rejected') {
    const rejected = application?.status === 'rejected';
    return (
      <AdminScreen edges={['top', 'bottom']} header={<TopBar title={t(rejected ? 'rx.rejectedTitle' : 'rider.completeTitle')} showProfile={false} />}>
        {rejected ? (
          <Notice icon="attention" tone="danger" title={t('rx.rejectedNotice')} body={t('rx.rejectedNext')} />
        ) : (
          <Txt variant="muted" style={styles.intro}>
            {t('rider.completeSub')}
          </Txt>
        )}
        <Panel>
          <RiderApplicationForm createProfile={false} />
        </Panel>
        {footer}
      </AdminScreen>
    );
  }

  // Pending: sent, phone check, then the admin's decision.
  const verified = !!application.phone_verified_at && application.phone_verified_number === profile.phone;
  const sent = new Date(application.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  return (
    <AdminScreen edges={['top', 'bottom']} header={<TopBar title={t('rx.applicationTitle')} showProfile={false} />}>
      <Panel>
        <Badge tone="accent" label={t('rx.underReview')} />
        <Txt variant="muted" style={styles.intro}>
          {t('rx.pendingIntro')}
        </Txt>
      </Panel>

      <SectionTitle title={t('rx.steps')} />
      <Panel>
        <Step done title={t('rx.stepSent')} body={t('rx.stepSentBody', { date: sent })} />
        <Step done={verified} current={!verified} title={t('rider.verifyTitle')} body={verified ? t('rider.verifyDone') : t('rx.stepPhoneBody', { phone: formatPhone(profile.phone) })}>
          {verified ? null : <PhoneCheck />}
        </Step>
        <Step current={verified} title={t('rx.stepApproval')} body={t(verified ? 'rx.stepApprovalReady' : 'rx.stepApprovalWait')} last />
      </Panel>

      <SectionTitle title={t('adm.details')} />
      <Panel>
        <InfoLine label={t('common.name')} value={profile.full_name} />
        <InfoLine label={t('common.phoneShort')} value={formatPhone(profile.phone)} />
        <InfoLine label={t('common.plate')} value={application.plate} />
        <InfoLine label={t('common.district')} value={application.district} last />
      </Panel>
      {footer}
    </AdminScreen>
  );
}

function Step({
  title,
  body,
  done = false,
  current = false,
  last = false,
  children,
}: {
  title: string;
  body: string;
  done?: boolean;
  current?: boolean;
  last?: boolean;
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  const color = done ? theme.success : current ? theme.accentText : theme.textSecondary;
  return (
    <View style={[styles.step, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.hairline }]}>
      <AdminIcon name={done ? 'check' : current ? 'attention' : 'clock'} size={20} color={color} />
      <View style={{ flex: 1, gap: Spacing.two }}>
        <View style={{ gap: 2 }}>
          <Txt style={styles.stepTitle}>{title}</Txt>
          <Txt variant="muted" style={styles.small}>
            {body}
          </Txt>
        </View>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 14, lineHeight: 20 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three - 4, paddingVertical: Spacing.two + 2 },
  stepTitle: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  small: { fontSize: 13, lineHeight: 18 },
});
