import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Choices, Empty, Header, LinkButton, Pill, Row, Screen, Stack, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { STATUS_SHORT, formatPhone, money, paymentLabel } from '@/lib/somali';
import { friendlyError, supabase } from '@/lib/supabase';
import type { ApplicationStatus, Order, RiderApplication } from '@/lib/types';

type Application = RiderApplication & { profile: { full_name: string; phone: string | null } | null; photoUrl?: string };
type AdminOrder = Order & { stores: { name: string } | null };

const TABS = [
  { id: 'pending', label: 'Sugaya' },
  { id: 'approved', label: 'La ansixiyay' },
  { id: 'rejected', label: 'La diiday' },
  { id: 'orders', label: 'Dalabyada' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export default function Admin() {
  const { signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('pending');
  const [applications, setApplications] = useState<Application[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [apps, ords] = await Promise.all([
      supabase
        .from('rider_applications')
        .select('*, profile:profiles!rider_applications_user_id_fkey(full_name, phone)')
        .order('created_at', { ascending: false }),
      supabase.from('orders').select('*, stores(name)').order('created_at', { ascending: false }).limit(100),
    ]);
    const rows = (apps.data as Application[]) ?? [];
    // ID photos live in a private bucket; signed links expire after an hour.
    const withPhotos = await Promise.all(
      rows.map(async (a) => {
        if (!a.id_photo_path || a.status !== 'pending') return a;
        const { data } = await supabase.storage.from('rider-ids').createSignedUrl(a.id_photo_path, 3600);
        return { ...a, photoUrl: data?.signedUrl };
      }),
    );
    setApplications(withPhotos);
    setOrders((ords.data as AdminOrder[]) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const channel = supabase
      .channel('admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_applications' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  async function review(userId: string, approve: boolean) {
    setBusy(userId);
    setError(undefined);
    const { error: e } = await supabase.rpc('review_rider', { p_user_id: userId, p_approve: approve });
    setBusy(null);
    if (e) setError(friendlyError(e));
    else load();
  }

  const count = (s: ApplicationStatus) => applications.filter((a) => a.status === s).length;
  const openOrders = orders.filter((o) => o.status === 'placed' || o.status === 'accepted' || o.status === 'picked_up').length;
  const tabs = TABS.map((t) => ({ ...t, label: t.id === 'orders' ? `${t.label} (${openOrders})` : `${t.label} (${count(t.id)})` }));

  return (
    <Screen>
      <Header title="Maamulka Dhaqso" subtitle="Ansixi darawallada, la soco dalabyada." back={false} />
      <Choices options={tabs} value={tab} onChange={setTab} columns={4} />
      {error ? <Txt color="danger">{error}</Txt> : null}

      {tab === 'orders' ? (
        orders.length === 0 ? (
          <Empty title="Weli dalab ma jiro" />
        ) : (
          orders.map((o) => (
            <Card key={o.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt style={{ fontWeight: '700', flex: 1 }}>
                  #{o.id} · {o.kind === 'store' ? (o.stores?.name ?? 'Dukaan') : `Xirmo ${o.pickup_district} → ${o.dropoff_district}`}
                </Txt>
                <Pill label={STATUS_SHORT[o.status]} tone={o.status === 'delivered' ? 'success' : o.status === 'placed' ? 'warning' : o.status === 'cancelled' ? 'neutral' : 'brand'} />
              </Row>
              <Txt variant="muted">
                {new Date(o.created_at).toLocaleString()} · {money(Number(o.items_total) + Number(o.delivery_fee))} · {paymentLabel(o.payment_method)}
              </Txt>
            </Card>
          ))
        )
      ) : (
        <ApplicationList
          items={applications.filter((a) => a.status === tab)}
          busy={busy}
          onReview={tab === 'pending' ? review : undefined}
        />
      )}

      <LinkButton title="Ka bax" onPress={signOut} />
    </Screen>
  );
}

function ApplicationList({
  items,
  busy,
  onReview,
}: {
  items: Application[];
  busy: string | null;
  onReview?: (userId: string, approve: boolean) => void;
}) {
  if (items.length === 0) return <Empty title="Codsi ma jiro" />;
  return items.map((a) => (
    <Card key={a.user_id}>
      <Row gap={Spacing.three} style={{ alignItems: 'flex-start' }}>
        {a.photoUrl ? <Image source={{ uri: a.photoUrl }} style={styles.photo} contentFit="cover" accessibilityLabel="Sawirka aqoonsiga" /> : null}
        <Stack gap={2} style={{ flex: 1 }}>
          <Txt variant="heading">{a.profile?.full_name ?? '—'}</Txt>
          <Txt variant="muted">{formatPhone(a.profile?.phone)}</Txt>
          <Txt variant="muted">Aqoonsi: {a.id_number} · Taarikada: {a.plate}</Txt>
          <Txt variant="muted">Degmada: {a.district} · {new Date(a.created_at).toLocaleDateString()}</Txt>
        </Stack>
      </Row>
      {onReview ? (
        <View style={styles.actions}>
          <Button title="Ansixi" onPress={() => onReview(a.user_id, true)} loading={busy === a.user_id} style={{ flex: 1 }} />
          <Button title="Diid" kind="danger" onPress={() => onReview(a.user_id, false)} disabled={busy === a.user_id} style={{ flex: 1 }} />
        </View>
      ) : null}
    </Card>
  ));
}

const styles = StyleSheet.create({
  photo: { width: 96, height: 64, borderRadius: Radius.small },
  actions: { flexDirection: 'row', gap: Spacing.two },
});
