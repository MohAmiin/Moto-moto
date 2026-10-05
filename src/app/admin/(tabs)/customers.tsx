import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { AdminScreen, EmptyNote, ListRow, Panel, SearchField, SectionTitle, TopBar } from '@/components/admin/ui';
import { ConnectionBanner } from '@/components/connection-banner';
import { Monogram } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { searchKey, useAdminRefresh, usePullToRefresh, type CustomerRow } from '@/lib/admin';
import { formatPhone } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

// Enough for the pilot; a search narrows it on the phone.
const LIMIT = 500;

export default function Customers() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<CustomerRow[]>();
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, district, created_at')
      .eq('role', 'customer')
      .order('created_at', { ascending: false })
      .limit(LIMIT);
    setRefreshing(false);
    if (error) {
      setFailed(true);
      return;
    }
    setRows((data as CustomerRow[]) ?? []);
    setFailed(false);
  }, []);

  useAdminRefresh(load, 'admin-customers');
  const pull = usePullToRefresh(load);

  const shown = useMemo(() => {
    const q = searchKey(query);
    if (!q) return rows ?? [];
    return (rows ?? []).filter((c) => searchKey(c.full_name).includes(q) || searchKey(c.phone).includes(q.replace(/^0/, '')));
  }, [rows, query]);

  return (
    <AdminScreen
      header={<TopBar title={t('adm.customers')} />}
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={theme.textSecondary} />}>
      <SearchField value={query} onChangeText={setQuery} placeholder={t('adm.searchCustomers')} />
      {failed ? <ConnectionBanner message={t('admin.loadFailed')} onRetry={load} retrying={refreshing} /> : null}
      {rows ? <SectionTitle title={query ? t('adm.matches', { n: shown.length }) : t('adm.customerCount', { n: rows.length })} /> : null}

      <Panel padded={false}>
        {rows === undefined ? (
          <View style={styles.padded}>
            <EmptyNote icon="customers" title={failed ? t('adm.failedShort') : t('common.loading')} />
          </View>
        ) : shown.length === 0 ? (
          <View style={styles.padded}>
            <EmptyNote
              icon={query ? 'search' : 'customers'}
              title={query ? t('adm.noMatches') : t('adm.noCustomers')}
              body={query ? t('adm.noMatchesBody') : t('adm.noCustomersBody')}
            />
          </View>
        ) : (
          shown.map((c, i) => (
            <ListRow
              key={c.id}
              leading={<Monogram name={c.full_name || '?'} size={40} radius={20} />}
              title={c.full_name || '—'}
              subtitle={[formatPhone(c.phone), c.district, t('adm.joined', { date: new Date(c.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) })]
                .filter(Boolean)
                .join(' · ')}
              onPress={() => router.push({ pathname: '/admin/customer/[id]', params: { id: c.id } })}
              last={i === shown.length - 1}
            />
          ))
        )}
      </Panel>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  padded: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
});
