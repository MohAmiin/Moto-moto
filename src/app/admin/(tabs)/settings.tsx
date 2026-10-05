import { StyleSheet, View } from 'react-native';

import { AdminButton, AdminScreen, FilterChips, InfoLine, Panel, SectionTitle, TopBar } from '@/components/admin/ui';
import { Monogram, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { setAppearance, useAppearance, type AppearanceChoice } from '@/lib/appearance';
import { useAuth } from '@/lib/auth';
import { formatPhone } from '@/lib/format';
import { LANGUAGES, useI18n } from '@/lib/i18n';

// Which Supabase project this build talks to, so a staging build is easy to tell apart.
const SERVER = (() => {
  try {
    return new URL(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').hostname.split('.')[0] || null;
  } catch {
    return null;
  }
})();

export default function Settings() {
  const { t, language, setLanguage } = useI18n();
  const { profile, signOut } = useAuth();
  const appearance = useAppearance();

  const appearanceOptions: { id: AppearanceChoice; label: string }[] = [
    { id: 'system', label: t('adm.appearanceSystem') },
    { id: 'light', label: t('adm.appearanceLight') },
    { id: 'dark', label: t('adm.appearanceDark') },
  ];

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

      <SectionTitle title={t('common.language')} />
      <Panel>
        <FilterChips options={LANGUAGES.map((l) => ({ id: l.id, label: l.label }))} value={language} onChange={setLanguage} />
      </Panel>

      <SectionTitle title={t('adm.appearance')} />
      <Panel>
        <FilterChips options={appearanceOptions} value={appearance} onChange={setAppearance} />
        <Txt variant="muted" style={styles.small}>
          {t('adm.appearanceHint')}
        </Txt>
      </Panel>

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
