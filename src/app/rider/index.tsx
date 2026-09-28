import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { RiderApplicationForm } from '@/components/rider-application-form';
import { Button, Card, Empty, Header, LinkButton, Pill, Row, Screen, Stack, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { formatPhone, money, packageLabel, paymentLabel } from '@/lib/somali';
import { friendlyError, supabase } from '@/lib/supabase';
import type { Order } from '@/lib/types';

export default function RiderHome() {
  const { profile, application, signOut } = useAuth();
  if (!profile) return null;

  if (!application) {
    return (
      <Screen>
        <Header title="Dhammaystir codsigaaga" subtitle="Waxaan u baahanahay macluumaadka mootadaada ka hor intaadan bilaabin." back={false} />
        <RiderApplicationForm createProfile={false} />
        <LinkButton title="Ka bax" onPress={signOut} />
      </Screen>
    );
  }

  if (application.status === 'rejected') {
    return (
      <Screen>
        <Header title="Codsigaaga lama aqbalin" subtitle="Hubi macluumaadka oo mar kale soo gudbi, ama la xiriir xafiiska Dhaqso." back={false} />
        <RiderApplicationForm createProfile={false} />
        <LinkButton title="Ka bax" onPress={signOut} />
      </Screen>
    );
  }

  if (application.status === 'pending') {
    return (
      <Screen>
        <Stack style={{ alignItems: 'center', paddingTop: Spacing.five }}>
          <Txt variant="title" style={{ textAlign: 'center' }}>Codsigaaga waa la helay</Txt>
          <Txt variant="muted" style={{ textAlign: 'center' }}>
            Kooxdayadu waxay hubin doontaa aqoonsigaaga iyo mootadaada. Boggan wuu is beddeli doonaa marka lagu ansixiyo.
          </Txt>
        </Stack>
        <Card>
          <Detail label="Magaca" value={profile.full_name} />
          <Detail label="Taleefan" value={formatPhone(profile.phone)} />
          <Detail label="Taarikada" value={application.plate} />
          <Detail label="Degmada" value={application.district} />
        </Card>
        <LinkButton title="Ka bax" onPress={signOut} />
      </Screen>
    );
  }

  return <Dashboard />;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Txt variant="muted">{label}</Txt>
      <Txt style={{ fontWeight: '600' }}>{value}</Txt>
    </Row>
  );
}

type Job = Order & { stores: { name: string } | null };

function Dashboard() {
  const theme = useTheme();
  const { profile, application, refresh, signOut } = useAuth();
  const [online, setOnline] = useState(profile?.is_online ?? false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [active, setActive] = useState<Job | null>(null);
  const [today, setToday] = useState({ trips: 0, earned: 0 });
  const [error, setError] = useState<string>();
  const [accepting, setAccepting] = useState<number | null>(null);
  const riderId = profile!.id;

  const load = useCallback(async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [open, mine, done] = await Promise.all([
      supabase.from('orders').select('*, stores(name)').is('rider_id', null).eq('status', 'placed').order('created_at'),
      supabase.from('orders').select('*, stores(name)').eq('rider_id', riderId).in('status', ['accepted', 'picked_up']).maybeSingle(),
      supabase.from('orders').select('delivery_fee').eq('rider_id', riderId).eq('status', 'delivered').gte('delivered_at', start.toISOString()),
    ]);
    setJobs((open.data as Job[]) ?? []);
    setActive((mine.data as Job) ?? null);
    const delivered = done.data ?? [];
    setToday({ trips: delivered.length, earned: delivered.reduce((sum, o) => sum + Number(o.delivery_fee), 0) });
  }, [riderId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // New orders and orders taken by other riders show up without refreshing.
  useEffect(() => {
    const channel = supabase
      .channel('rider-jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  async function toggleOnline(next: boolean) {
    setOnline(next);
    const { error: e } = await supabase.from('profiles').update({ is_online: next }).eq('id', riderId);
    if (e) {
      setOnline(!next);
      setError(friendlyError(e));
    } else {
      refresh();
    }
  }

  async function accept(job: Job) {
    setAccepting(job.id);
    setError(undefined);
    const { error: e } = await supabase.rpc('accept_order', { p_order_id: job.id });
    setAccepting(null);
    if (e) {
      setError(friendlyError(e));
      load();
      return;
    }
    router.push(`/rider/job/${job.id}`);
  }

  return (
    <Screen>
      <View style={[styles.head, { backgroundColor: theme.text }]}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Txt variant="heading" style={{ color: theme.background }}>{profile!.full_name}</Txt>
            <Txt style={{ color: theme.background, opacity: 0.7, fontSize: 13 }}>
              {application!.plate} · {application!.district}
            </Txt>
          </View>
          <Row>
            <Txt style={{ color: theme.background, fontWeight: '700' }}>{online ? 'Online' : 'Offline'}</Txt>
            <Switch value={online} onValueChange={toggleOnline} accessibilityLabel="Online" />
          </Row>
        </Row>
        <Row gap={Spacing.two}>
          <Stat label="Safarrada maanta" value={String(today.trips)} />
          <Stat label="Dakhliga maanta" value={money(today.earned)} />
          <Stat label="Dalabyo cusub" value={String(online ? jobs.length : 0)} />
        </Row>
      </View>

      {error ? <Txt color="danger">{error}</Txt> : null}

      {active ? (
        <Card style={{ borderColor: theme.gold, borderWidth: 2 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Pill label={active.status === 'accepted' ? 'Soo qaado' : 'U geey macmiilka'} tone="warning" />
            <Txt variant="big">$1</Txt>
          </Row>
          <JobSummary job={active} />
          <Button kind="gold" title="Fur shaqada" onPress={() => router.push(`/rider/job/${active.id}`)} />
        </Card>
      ) : !online ? (
        <Empty title="Waxaad tahay offline" body="Shid si aad u hesho dalabyo." />
      ) : jobs.length === 0 ? (
        <Empty title="Sug dalabyo" body="Dalab cusub marka la sameeyo halkan ayuu ka muuqan doonaa." />
      ) : (
        jobs.map((job) => (
          <Card key={job.id} style={{ borderColor: theme.gold, borderWidth: 2 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Pill label="Dalab cusub" tone="gold" />
              <Txt variant="big">$1</Txt>
            </Row>
            <JobSummary job={job} />
            <Button title="Aqbal" onPress={() => accept(job)} loading={accepting === job.id} />
          </Card>
        ))
      )}

      <LinkButton title="Ka bax" onPress={signOut} />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: theme.textSecondary + '33' }]}>
      <Txt style={{ color: theme.background, fontSize: 20, fontWeight: '900' }}>{value}</Txt>
      <Txt style={{ color: theme.background, opacity: 0.75, fontSize: 12, fontWeight: '600' }}>{label}</Txt>
    </View>
  );
}

function JobSummary({ job }: { job: Job }) {
  const pickup = job.kind === 'store' ? (job.stores?.name ?? job.pickup_note) : job.pickup_note;
  const total = Number(job.items_total) + Number(job.delivery_fee);
  return (
    <Stack gap={Spacing.two}>
      <Leg tag="A" title={pickup} subtitle={`Degmada ${job.pickup_district}`} />
      <Leg tag="B" title={`Degmada ${job.dropoff_district}`} subtitle={job.dropoff_note || 'Macmiil'} />
      <Txt variant="muted">
        #{job.id} · {job.kind === 'store' ? 'Dalab dukaan' : packageLabel(job.package_type)} ·{' '}
        {job.payment_method === 'cash' ? `Ka qaado ${money(total)} lacag caddaan ah` : `Horay loo bixiyay (${paymentLabel(job.payment_method)})`}
      </Txt>
    </Stack>
  );
}

function Leg({ tag, title, subtitle }: { tag: 'A' | 'B'; title: string; subtitle: string }) {
  const theme = useTheme();
  return (
    <Row gap={Spacing.three}>
      <View style={[styles.tag, { backgroundColor: tag === 'A' ? theme.success : theme.danger }]}>
        <Txt style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{tag}</Txt>
      </View>
      <View style={{ flex: 1 }}>
        <Txt style={{ fontWeight: '700' }}>{title}</Txt>
        <Txt variant="muted">{subtitle}</Txt>
      </View>
    </Row>
  );
}

const styles = StyleSheet.create({
  head: { borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.three },
  stat: { flex: 1, borderRadius: Radius.small + 2, padding: Spacing.two + 2 },
  tag: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
