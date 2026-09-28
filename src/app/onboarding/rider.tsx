import { RiderApplicationForm } from '@/components/rider-application-form';
import { Header, Screen } from '@/components/ui';

export default function RiderOnboarding() {
  return (
    <Screen>
      <Header
        title="Is diiwaan geli sida darawal"
        subtitle="Waxaan u baahanahay inaan hubinno cidda aad tahay. Macaamiishu waxay arkaan magacaaga iyo taarikada mootada."
      />
      <RiderApplicationForm createProfile />
    </Screen>
  );
}
