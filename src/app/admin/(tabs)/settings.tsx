import { StyleSheet, View } from 'react-native';

import { AdminButton, AdminScreen, InfoLine, Panel, SectionTitle, TopBar } from '@/components/kit';
import { Preferences } from '@/components/preferences';
import { Monogram, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { formatPhone } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

// Which Supabase project this build talks to, so a staging build is easy to tell apart.
const SERVER = (() => {
  try {
    return new URL(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').hostname.split('.')[0] || null;
  } catch {
    return null;
  }
})();

export default function Settings() {
  const { t } = useI18n();
  const { profile, signOut } = useAuth();

  return (
    <AdminScreen header={<TopBar title={t('adm.settings')} showProfile={false} />}>
      <Panel>
        <View style={styles.head}>
          <Monogram name={profile?.full_name || '?'} size={52} radius={26} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt style={styles.name}>{profile?.full_name || '—'}</Txt>
            <Txt variant="muted" style={styles.small}>
              {[t('adm.roleAdmin'), formatPhone(profile?.phone)].filter(Boolean).join(' · ')}
            </Txt>
          </View>
        </View>
      </Panel>

      <Preferences />

      <SectionTitle title={t('adm.about')} />
      <Panel>
        <InfoLine label={t('adm.server')} value={SERVER} last />
      </Panel>

      <AdminButton title={t('common.signOut')} kind="danger" icon="signOut" onPress={signOut} style={{ marginTop: Spacing.two }} />
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4 },
  name: { fontSize: 17, lineHeight: 23, fontWeight: '500' },
  small: { fontSize: 13, lineHeight: 18 },
});
