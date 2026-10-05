import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { CodeEntry } from '@/components/admin/code-entry';
import { AdminButton, AdminScreen, Badge, DetailBar, EmptyNote, Panel } from '@/components/admin/ui';
import { ConnectionBanner } from '@/components/connection-banner';
import { RiderAvatar } from '@/components/rider-avatar';
import { Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchPinResets, useAdminRefresh, usePullToRefresh, type CodeResult, type PinReset } from '@/lib/admin';
import { formatPhone } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { riderCode } from '@/lib/rider';
import { errorKey, supabase } from '@/lib/supabase';

/** PIN reset requests: call the account's number, ask for the code on the owner's screen, type it in. */
export default function Resets() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const [items, setItems] = useState<PinReset[]>();
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setItems(await fetchPinResets());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useAdminRefresh(load, 'admin-resets');
  const pull = usePullToRefresh(load);

  async function verify(id: string, code: string): Promise<CodeResult | null> {
    setBusy(id);
    setError(undefined);
    const { data, error: e } = await supabase.rpc('admin_verify_pin_reset', { p_id: id, p_code: code });
    setBusy(null);
    if (e) {
      setError(t(errorKey(e)));
      return null;
    }
    const result = (data as CodeResult[] | null)?.[0] ?? null;
    if (result?.outcome === 'approved') setDone(t('admin.resetDone'));
    if (result?.outcome !== 'wrong_code') load();
    return result;
  }

  async function reject(id: string) {
    setBusy(id);
    setError(undefined);
    const { error: e } = await supabase.rpc('admin_reject_pin_reset', { p_id: id });
    setBusy(null);
    if (e) setError(t(errorKey(e)));
    else load();
  }

  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  return (
    <AdminScreen
      edges={['top', 'bottom']}
      header={<DetailBar title={t('adm.pinResets')} />}
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={theme.textSecondary} />}>
      {failed ? <ConnectionBanner message={t('admin.loadFailed')} onRetry={load} retrying={refreshing} /> : null}
      {done ? (
        <Panel>
          <EmptyNote icon="check" title={done} />
        </Panel>
      ) : null}
      {error ? (
        <Txt color="danger" style={styles.small} accessibilityRole="alert">
          {error}
        </Txt>
      ) : null}

      {items === undefined ? (
        <Panel>
          <EmptyNote icon="key" title={failed ? t('adm.failedShort') : t('common.loading')} />
        </Panel>
      ) : items.length === 0 ? (
        <Panel>
          <EmptyNote icon="key" title={t('admin.noResets')} body={t('adm.noResetsBody')} />
        </Panel>
      ) : (
        items.map((r) => {
          const name = r.full_name ?? formatPhone(r.phone);
          return (
            <Panel key={r.id}>
              <View style={styles.head}>
                <RiderAvatar name={name} photoPath={r.photo_path} size={44} round />
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt style={styles.name}>{name}</Txt>
                  <Txt variant="muted" style={styles.small}>
                    {[riderCode(r.rider_number) ?? t('admin.customer'), formatPhone(r.phone)].join(' · ')}
                  </Txt>
                  <Txt variant="muted" style={styles.small}>
                    {t('admin.resetLine', { date: new Date(r.created_at).toLocaleString(locale) })} · {t('admin.resetExpires', { time: time(r.expires_at) })}
                  </Txt>
                </View>
              </View>
              {r.open_for_number > 1 ? <Badge tone="warning" label={t('admin.resetMany', { n: r.open_for_number })} /> : null}
              <CodeEntry
                hint={t('admin.resetHint')}
                phone={r.phone}
                label={t('admin.resetCode')}
                action={t('admin.resetVerify')}
                busy={busy === r.id}
                onSubmit={(c) => verify(r.id, c)}
                messages={{ failed: 'admin.codeFailed', expired: 'admin.codeExpired', not_open: 'admin.notOpen' }}
              />
              <AdminButton title={t('admin.reject')} kind="danger" onPress={() => reject(r.id)} disabled={busy === r.id} />
            </Panel>
          );
        })
      )}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4 },
  name: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  small: { fontSize: 13, lineHeight: 18 },
});
