import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AdminButton, EmptyNote, Notice, Panel, SectionTitle, TextField } from '@/components/kit';
import { Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useI18n, type TKey } from '@/lib/i18n';
import { fetchRequestSettings, saveRequestSettings } from '@/lib/requests';
import type { RequestSettings } from '@/lib/types';

type Field = keyof RequestSettings;
// The same limits as the database (request_settings), so mistakes are caught before saving.
const FIELDS: { key: Field; label: TKey; help: TKey; min: number; max: number; decimal: boolean }[] = [
  { key: 'first_radius_km', label: 'rq.setFirstRadius', help: 'rq.setKmHelp', min: 0.5, max: 20, decimal: true },
  { key: 'second_radius_km', label: 'rq.setSecondRadius', help: 'rq.setKmHelp', min: 0.5, max: 30, decimal: true },
  { key: 'riders_per_wave', label: 'rq.setPerWave', help: 'rq.setPerWaveHelp', min: 1, max: 10, decimal: false },
  { key: 'wave_seconds', label: 'rq.setWaveSeconds', help: 'rq.setSecondsHelp', min: 20, max: 600, decimal: false },
  { key: 'expire_seconds', label: 'rq.setExpireSeconds', help: 'rq.setSecondsHelp', min: 60, max: 1800, decimal: false },
];

/** How "Request a moto" reaches riders: the two radii, riders per wave, wave length and expiry. */
export function RequestSettingsSection() {
  const { t } = useI18n();
  const [saved, setSaved] = useState<RequestSettings | null>();
  const [values, setValues] = useState<Record<Field, string>>({} as Record<Field, string>);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ key: TKey; error: boolean }>();

  const load = useCallback(async () => {
    try {
      const s = await fetchRequestSettings();
      setSaved(s);
      if (s) setValues(Object.fromEntries(FIELDS.map((f) => [f.key, String(Number(s[f.key]))])) as Record<Field, string>);
    } catch {
      setSaved(null);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, [load]);

  const parsed = Object.fromEntries(
    FIELDS.map((f) => {
      const n = Number(String(values[f.key] ?? '').replace(',', '.'));
      const ok = Number.isFinite(n) && n >= f.min && n <= f.max && (f.decimal || Number.isInteger(n));
      return [f.key, ok ? n : null];
    }),
  ) as Record<Field, number | null>;
  const invalid = FIELDS.some((f) => parsed[f.key] == null);
  const order =
    !invalid &&
    (parsed.second_radius_km! < parsed.first_radius_km! ? 'rq.setErrRadius' : parsed.expire_seconds! <= parsed.wave_seconds! ? 'rq.setErrExpire' : null);
  const changed = !!saved && FIELDS.some((f) => parsed[f.key] !== Number(saved[f.key]));

  async function save() {
    if (invalid || order) return;
    setBusy(true);
    setMessage(undefined);
    try {
      await saveRequestSettings(parsed as RequestSettings);
      await load();
      setMessage({ key: 'rq.setSaved', error: false });
    } catch {
      setMessage({ key: 'rq.setErrSave', error: true });
    }
    setBusy(false);
  }

  return (
    <>
      <SectionTitle title={t('rq.setTitle')} />
      <Panel>
        {saved === undefined ? null : saved === null ? (
          <EmptyNote icon="attention" title={t('rq.setLoadFailed')} />
        ) : (
          <>
            <Txt variant="muted" style={styles.small}>
              {t('rq.setIntro')}
            </Txt>
            <View style={styles.grid}>
              {FIELDS.map((f) => (
                <View key={f.key} style={styles.cell}>
                  <TextField
                    label={t(f.label)}
                    value={values[f.key] ?? ''}
                    onChangeText={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
                    keyboardType={f.decimal ? 'decimal-pad' : 'number-pad'}
                    error={values[f.key] != null && parsed[f.key] == null ? t(f.help, { min: f.min, max: f.max }) : undefined}
                    help={t(f.help, { min: f.min, max: f.max })}
                  />
                </View>
              ))}
            </View>
            {order ? <Notice icon="attention" tone="danger" title={t(order)} /> : null}
            {message ? <Notice icon={message.error ? 'attention' : 'check'} tone={message.error ? 'danger' : 'info'} title={t(message.key)} /> : null}
            <AdminButton title={t('rq.setSave')} onPress={save} loading={busy} disabled={!changed || invalid || !!order} />
          </>
        )}
      </Panel>
    </>
  );
}

const styles = StyleSheet.create({
  small: { fontSize: 13, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  cell: { flexGrow: 1, flexBasis: 140 },
});
