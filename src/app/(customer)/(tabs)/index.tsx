import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button, Empty, Monogram, Pill, Row, Screen, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { CATEGORIES, money, statusLongKey } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import type { Order, Store, StoreCategory } from '@/lib/types';

export default function Home() {
  const theme = useTheme();
  const { t } = useI18n();
  const { profile } = useAuth();
  const cart = useCart();
  const [stores, setStores] = useState<Store[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [category, setCategory] = useState<StoreCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      Promise.all([
        supabase.from('stores').select('*').eq('is_open', true).order('name'),
        supabase
          .from('orders')
          .select('*')
          .in('status', ['placed', 'accepted', 'picked_up'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle<Order>(),
      ]).then(([s, o]) => {
        if (!live) return;
        setStores((s.data as Store[]) ?? []);
        setActiveOrder(o.data ?? null);
        setLoaded(true);
      });
      return () => {
        live = false;
      };
    }, []),
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stores.filter(
      (s) =>
        (category === 'all' || s.category === category) &&
        (!q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)),
    );
  }, [stores, category, query]);

  const firstName = profile?.full_name.split(' ')[0] ?? '';

  return (
    <Screen
      edges={['top']}
      footer={
        cart.count > 0 ? (
          <Button title={t('home.viewBasket', { count: cart.count, total: money(cart.subtotal) })} onPress={() => router.push('/cart')} />
        ) : null
      }>
      <View style={[styles.top, { backgroundColor: theme.brand }]}>
        <Txt style={{ color: theme.onBrand, opacity: 0.85, fontSize: 13, fontWeight: '600' }}>{t('home.deliverTo', { district: profile?.district ?? '' })}</Txt>
        <Txt variant="heading" style={{ color: theme.onBrand }}>{t('home.hello', { name: firstName })}</Txt>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('home.search')}
          placeholderTextColor={theme.textSecondary}
          style={[styles.search, { backgroundColor: theme.background, color: theme.text }]}
          accessibilityLabel={t('home.search')}
        />
      </View>

      {activeOrder ? (
        <Pressable accessibilityRole="button" onPress={() => router.push(`/order/${activeOrder.id}`)}>
          <View style={[styles.active, { backgroundColor: theme.backgroundSelected }]}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt style={{ fontWeight: '800' }}>{t('common.orderNumber', { id: activeOrder.id })}</Txt>
              <Pill label={t('home.track')} tone="brand" />
            </Row>
            <Txt variant="muted">{t(statusLongKey(activeOrder.status))}</Txt>
          </View>
        </Pressable>
      ) : null}

      <Pressable accessibilityRole="button" onPress={() => router.push('/send')}>
        <View style={[styles.promo, { backgroundColor: theme.gold }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="heading" style={{ color: theme.onGold }}>{t('home.sendTitle')}</Txt>
            <Txt style={{ color: theme.onGold, opacity: 0.85, fontSize: 13 }}>{t('home.sendSub')}</Txt>
          </View>
          <Txt variant="big" style={{ color: theme.onGold }}>$1</Txt>
        </View>
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.two }}>
        {CATEGORIES.map((c) => {
          const selected = c === category;
          return (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setCategory(c)}
              style={[styles.chip, { borderColor: selected ? theme.text : theme.border, backgroundColor: selected ? theme.text : theme.background }]}>
              <Txt style={{ fontWeight: '700', fontSize: 14, color: selected ? theme.background : theme.textSecondary }}>{t(`cat.${c}`)}</Txt>
            </Pressable>
          );
        })}
      </ScrollView>

      <Txt variant="heading">{t('home.openNow')}</Txt>
      {loaded && visible.length === 0 ? <Empty title={t('home.nothingFound')} body={t('home.tryOther')} /> : null}
      {visible.map((s) => (
        <Pressable key={s.id} accessibilityRole="button" onPress={() => router.push(`/store/${s.id}`)}>
          <View style={[styles.store, { borderColor: theme.border }]}>
            <Monogram name={s.name} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt style={{ fontWeight: '700', fontSize: 16 }}>{s.name}</Txt>
              <Txt variant="muted">{s.description}</Txt>
              <Row style={{ marginTop: 4 }}>
                <Pill label={t('common.deliveryBadge')} tone="gold" />
                <Pill label={t('common.minutes', { n: s.eta_label })} />
              </Row>
            </View>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.two },
  search: { borderRadius: Radius.small + 2, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, marginTop: Spacing.one },
  active: { borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.one },
  promo: { borderRadius: Radius.large, padding: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  chip: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 7 },
  store: { flexDirection: 'row', gap: Spacing.three, paddingBottom: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth },
});
