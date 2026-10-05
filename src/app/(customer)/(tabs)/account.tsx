import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AdminButton, AdminScreen, FilterChips, Panel, SectionTitle, TopBar } from '@/components/kit';
import { DeleteAccount } from '@/components/delete-account';
import { Preferences } from '@/components/preferences';
import { Monogram, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { AREA_OPTIONS, formatPhone, toDistrict } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { errorKey, supabase } from '@/lib/supabase';

export default function Account() {
  const { t } = useI18n();
  const { profile, refresh, signOut } = useAuth();
  const [message, setMessage] = useState<string>();

  if (!profile) return null;

  async function changeDistrict(district: string) {
    const { error } = await supabase.from('profiles').update({ district }).eq('id', profile!.id);
    if (error) setMessage(t(errorKey(error)));
    else {
      setMessage(t('acct.addressChanged'));
      await refresh();
    }
  }

  return (
    <AdminScreen header={<TopBar title={t('acct.title')} showProfile={false} />}>
      <Panel>
        <View style={styles.head}>
          <Monogram name={profile.full_name} size={52} radius={26} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt style={styles.name}>{profile.full_name}</Txt>
            <Txt variant="muted" style={styles.small}>
              {formatPhone(profile.phone)}
            </Txt>
          </View>
        </View>
      </Panel>

      <SectionTitle title={t('acct.deliveryDistrict')} />
      <Panel>
        <View style={styles.wrap}>
          <FilterChips options={AREA_OPTIONS} value={toDistrict(profile.district)} onChange={changeDistrict} />
        </View>
        <Txt variant="muted" style={styles.small} accessibilityLiveRegion="polite">
          {message ?? t('cx.districtHint')}
        </Txt>
      </Panel>

      <Preferences />

      <AdminButton title={t('common.signOut')} kind="danger" icon="signOut" onPress={signOut} style={{ marginTop: Spacing.two }} />
      <DeleteAccount />
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4 },
  name: { fontSize: 17, lineHeight: 23, fontWeight: '500' },
  small: { fontSize: 13, lineHeight: 18 },
  wrap: { marginHorizontal: -Spacing.three, paddingHorizontal: Spacing.three },
});
