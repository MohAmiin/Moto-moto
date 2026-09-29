import { RiderApplicationForm } from '@/components/rider-application-form';
import { Header, Screen } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

export default function RiderOnboarding() {
  const { t } = useI18n();
  return (
    <Screen>
      <Header title={t('onb.riderRegisterTitle')} subtitle={t('onb.riderRegisterSub')} />
      <RiderApplicationForm createProfile />
    </Screen>
  );
}
