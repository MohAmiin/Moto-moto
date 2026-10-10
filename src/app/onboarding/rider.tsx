import { AdminScreen, DetailBar, Panel } from '@/components/kit';
import { RiderApplicationForm } from '@/components/rider-application-form';
import { Txt } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

export default function RiderOnboarding() {
  const { t } = useI18n();
  return (
    <AdminScreen edges={['top', 'bottom']} header={<DetailBar title={t('onb.riderRegisterTitle')} />}>
      <Txt variant="muted" style={{ fontSize: 14, lineHeight: 20 }}>
        {t('onb.riderRegisterSub')}
      </Txt>
      <Panel>
        <RiderApplicationForm createProfile />
      </Panel>
    </AdminScreen>
  );
}
