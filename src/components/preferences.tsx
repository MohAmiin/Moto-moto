import { StyleSheet } from 'react-native';

import { FilterChips, Panel, SectionTitle } from '@/components/kit';
import { Txt } from '@/components/ui';
import { setAppearance, useAppearance, type AppearanceChoice } from '@/lib/appearance';
import { LANGUAGES, useI18n } from '@/lib/i18n';

/** Language and light/dark choice, for every account screen. */
export function Preferences() {
  const { t, language, setLanguage } = useI18n();
  const appearance = useAppearance();
  const appearanceOptions: { id: AppearanceChoice; label: string }[] = [
    { id: 'system', label: t('adm.appearanceSystem') },
    { id: 'light', label: t('adm.appearanceLight') },
    { id: 'dark', label: t('adm.appearanceDark') },
  ];
  return (
    <>
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
    </>
  );
}

const styles = StyleSheet.create({
  small: { fontSize: 13, lineHeight: 18 },
});
