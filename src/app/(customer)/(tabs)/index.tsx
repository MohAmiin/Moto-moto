import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button, Empty, Monogram, Pill, Row, Screen, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { CATEGORIES, STATUS_LABEL, money } from '@/lib/somali';
import { supabase } from '@/lib/supabase';
import type { Order, Store, StoreCategory } from '@/lib/types';

export default function Home() {
  const theme = useTheme();
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
          <Button title={`Eeg dambiisha · ${cart.count} · ${money(cart.subtotal)}`} onPress={() => router.push('/cart')} />
        ) : null
      }>
      <View style={[styles.top, { backgroundColor: theme.brand }]}>
        <Txt style={{ color: theme.onBrand, opacity: 0.85, fontSize: 13, fontWeight: '600' }}>Geynta · {profile?.district}</Txt>
        <Txt variant="heading" style={{ color: theme.onBrand }}>Soo dhawoow, {firstName}</Txt>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Raadi maqaayad, cunto ama dukaan"
          placeholderTextColor={theme.textSecondary}
          style={[styles.search, { backgroundColor: theme.background, color: theme.text }]}
          accessibilityLabel="Raadi"
        />
      </View>

      {activeOrder ? (
        <Pressable accessibilityRole="button" onPress={() => router.push(`/order/${activeOrder.id}`)}>
          <View style={[styles.active, { backgroundColor: theme.backgroundSelected }]}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt style={{ fontWeight: '800' }}>Dalab #{activeOrder.id}</Txt>
              <Pill label="Raac" tone="brand" />
            </Row>
            <Txt variant="muted">{STATUS_LABEL[activeOrder.status]}</Txt>
          </View>
        </Pressable>
      ) : null}

      <Pressable accessibilityRole="button" onPress={() => router.push('/send')}>
        <View style={[styles.promo, { backgroundColor: theme.gold }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="heading" style={{ color: theme.onGold }}>Dir xirmo meel kasta</Txt>
            <Txt style={{ color: theme.onGold, opacity: 0.85, fontSize: 13 }}>Mooto ayaa ka qaadaysa, meel kasta u geynaysa</Txt>
          </View>
          <Txt variant="big" style={{ color: theme.onGold }}>$1</Txt>
        </View>
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.two }}>
        {CATEGORIES.map((c) => {
          const selected = c.id === category;
          return (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setCategory(c.id)}
              style={[styles.chip, { borderColor: selected ? theme.text : theme.border, backgroundColor: selected ? theme.text : theme.background }]}>
              <Txt style={{ fontWeight: '700', fontSize: 14, color: selected ? theme.background : theme.textSecondary }}>{c.label}</Txt>
            </Pressable>
          );
        })}
      </ScrollView>

      <Txt variant="heading">Meelaha furan</Txt>
      {loaded && visible.length === 0 ? <Empty title="Waxba lama helin" body="Isku day eray ama qayb kale." /> : null}
      {visible.map((s) => (
        <Pressable key={s.id} accessibilityRole="button" onPress={() => router.push(`/store/${s.id}`)}>
          <View style={[styles.store, { borderColor: theme.border }]}>
            <Monogram name={s.name} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt style={{ fontWeight: '700', fontSize: 16 }}>{s.name}</Txt>
              <Txt variant="muted">{s.description}</Txt>
              <Row style={{ marginTop: 4 }}>
                <Pill label="Geyn $1" tone="gold" />
                <Pill label={`${s.eta_label} daqiiqo`} />
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
