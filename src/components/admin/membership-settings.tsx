import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { AdminButton, EmptyNote, Notice, Panel, SectionTitle, TextField } from '@/components/kit';
import { Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, type TKey } from '@/lib/i18n';
import { fetchMembershipSettings, parseUsd, saveMembershipSettings, usd } from '@/lib/membership';
import type { MembershipSettings } from '@/lib/types';

const ERRORS: Record<string, TKey> = {
  'price required': 'mem.errPrice',
  'invalid price': 'mem.errPrice',
};

/**
 * The paid-membership switch, the monthly price and the payment instructions riders see. Turning the
 * switch on asks for confirmation first and explains what will happen.
 */
export function MembershipSettingsSection() {
  const theme = useTheme();
  const { t } = useI18n();
  const [saved, setSaved] = useState<MembershipSettings | null>();
  const [required, setRequired] = useState(false);
  const [price, setPrice] = useState('');
  const [instructions, setInstructions] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean }>();

  const load = useCallback(async () => {
    try {
      const s = await fetchMembershipSettings();
      setSaved(s);
      setRequired(s?.required ?? false);
      setPrice(s?.price_usd != null ? String(Number(s.price_usd)) : '');
      setInstructions(s?.instructions ?? '');
    } catch {
      setSaved(null);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, [load]);

  const priceValue = price.trim() ? parseUsd(price) : null;
  const priceInvalid = price.trim() !== '' && priceValue == null;
  const changed =
    !!saved &&
    (required !== saved.required ||
      priceValue !== (saved.price_usd != null ? Number(saved.price_usd) : null) ||
      instructions.trim() !== (saved.instructions ?? ''));

  async function save(confirmed: boolean) {
    setMessage(undefined);
    if (required && priceValue == null) {
      setMessage({ text: t('mem.errPrice'), error: true });
      return;
    }
    // Turning it on changes what riders can do: ask first.
    if (required && !saved?.required && !confirmed) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setBusy(true);
    try {
      const result = await saveMembershipSettings(required, priceValue, instructions);
      await load();
      setMessage({
        text: result?.grace_given ? t('mem.savedGrace', { n: result.grace_given }) : t('mem.saved'),
        error: false,
      });
    } catch (e) {
      const key = ERRORS[(e as { message?: string }).message ?? ''];
      setMessage({ text: key ? t(key) : t('err.generic'), error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionTitle title={t('mem.sectionTitle')} />
      <Panel>
        {saved === undefined ? (
          <EmptyNote icon="clock" title={t('common.loading')} />
        ) : saved === null ? (
          <EmptyNote icon="attention" title={t('adm.failedShort')} body={t('admin.loadFailed')} />
        ) : (
          <>
            <View style={styles.switchRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt style={styles.title}>{t('mem.require')}</Txt>
                <Txt variant="muted" style={styles.small}>
                  {t(saved.required ? 'mem.onNow' : 'mem.offNow')}
                </Txt>
              </View>
              <Switch
                value={required}
                onValueChange={(v) => {
                  setRequired(v);
                  setConfirming(false);
                  setMessage(undefined);
                }}
                accessibilityLabel={t('mem.require')}
                trackColor={{ false: theme.hairline, true: theme.accent }}
                thumbColor="#FFFFFF"
              />
            </View>
            <TextField
              label={t('mem.price')}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              placeholder="0.00"
              error={priceInvalid ? t('mem.errPrice') : undefined}
              help={t('mem.priceHelp')}
            />
            <TextField
              label={t('mem.instructions')}
              value={instructions}
              onChangeText={setInstructions}
              multiline
              maxLength={1000}
              placeholder={t('mem.instructionsPh')}
              help={t('mem.instructionsHelp')}
            />

            {confirming ? (
              <View style={{ gap: Spacing.two }}>
                <Notice
                  icon="attention"
                  title={t('mem.confirmTitle')}
                  body={t(saved.first_enabled_at ? 'mem.confirmAgain' : 'mem.confirmFirst', { price: usd(priceValue) })}
                />
                <View style={styles.actions}>
                  <AdminButton title={t('acct.deleteCancel')} kind="outline" onPress={() => setConfirming(false)} disabled={busy} style={{ flex: 1 }} />
                  <AdminButton title={t('mem.turnOn')} kind="accent" onPress={() => save(true)} loading={busy} style={{ flex: 1 }} />
                </View>
              </View>
            ) : (
              <AdminButton title={t('mem.save')} onPress={() => save(false)} loading={busy} disabled={!changed || priceInvalid} />
            )}
            {message ? (
              <Txt color={message.error ? 'danger' : undefined} variant={message.error ? undefined : 'muted'} style={styles.small} accessibilityLiveRegion="polite">
                {message.text}
              </Txt>
            ) : null}
          </>
        )}
      </Panel>
    </>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  small: { fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: Spacing.two },
});
