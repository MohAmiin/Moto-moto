import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { LiveMap, type LiveMapData } from "@/components/live-map";
import { riderPoints } from "@/components/live-map/points";
import { RiderAvatar } from "@/components/rider-avatar";
import { RiderCard } from "@/components/rider-card";
import {
  Button,
  Card,
  Choices,
  Empty,
  Header,
  LanguageSwitcher,
  LinkButton,
  Row,
  Screen,
  Stack,
  Txt,
} from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { formatPhone } from "@/lib/format";
import { useI18n, type TKey } from "@/lib/i18n";
import { ratingLabel, riderCode } from "@/lib/rider";
import { errorKey, supabase } from "@/lib/supabase";
import type {
  ApplicationStatus,
  NearbyRider,
  RiderApplication,
} from "@/lib/types";

type Application = RiderApplication & {
  profile: {
    full_name: string;
    phone: string | null;
    photo_path: string | null;
  } | null;
  photoUrl?: string;
};
/** Calls and average stars per driver. */
type Stats = Record<string, { calls: number; stars: number; ratings: number }>;

const TABS = ["pending", "approved", "rejected", "online"] as const;
type Tab = (typeof TABS)[number];

export default function Admin() {
  const { t } = useI18n();
  const { signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("pending");
  const [applications, setApplications] = useState<Application[]>([]);
  const [online, setOnline] = useState<NearbyRider[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [apps, riders, calls] = await Promise.all([
      supabase
        .from("rider_applications")
        .select(
          "*, profile:profiles!rider_applications_user_id_fkey(full_name, phone, photo_path)",
        )
        .order("created_at", { ascending: false }),
      supabase.rpc("nearby_riders", { p_lat: null, p_lng: null, p_area: null }),
      supabase.from("calls").select("rider_id, stars"),
    ]);
    const next: Stats = {};
    for (const c of (calls.data as {
      rider_id: string;
      stars: number | null;
    }[]) ?? []) {
      const s = (next[c.rider_id] ??= { calls: 0, stars: 0, ratings: 0 });
      s.calls += 1;
      if (c.stars) {
        s.stars += c.stars;
        s.ratings += 1;
      }
    }
    setStats(next);
    const rows = (apps.data as Application[]) ?? [];
    // ID photos live in a private bucket; signed links expire after an hour.
    const withPhotos = await Promise.all(
      rows.map(async (a) => {
        if (!a.id_photo_path || a.status !== "pending") return a;
        const { data } = await supabase.storage
          .from("rider-ids")
          .createSignedUrl(a.id_photo_path, 3600);
        return { ...a, photoUrl: data?.signedUrl };
      }),
    );
    setApplications(withPhotos);
    setOnline((riders.data as NearbyRider[]) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const channel = supabase
      .channel("admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rider_applications" },
        () => load(),
      )
      .subscribe();
    const timer = setInterval(load, 30_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, [load]);

  async function review(userId: string, approve: boolean) {
    setBusy(userId);
    setError(undefined);
    const { error: e } = await supabase.rpc("review_rider", {
      p_user_id: userId,
      p_approve: approve,
    });
    setBusy(null);
    if (e) setError(t(errorKey(e)));
    else load();
  }

  const mapData = useMemo<LiveMapData>(
    () => ({ me: null, riders: riderPoints(online, t) }),
    [online, t],
  );

  const count = (s: ApplicationStatus) =>
    applications.filter((a) => a.status === s).length;
  const tabs = TABS.map((id) => ({
    id,
    label: `${t(`admin.${id}` as TKey)} (${id === "online" ? online.length : count(id)})`,
  }));

  return (
    <Screen>
      <LanguageSwitcher />
      <Header title={t("admin.title")} subtitle={t("admin.sub")} back={false} />
      <Choices options={tabs} value={tab} onChange={setTab} columns={4} />
      {error ? <Txt color="danger">{error}</Txt> : null}

      {tab === "online" ? (
        <>
          <LiveMap data={mapData} height={320} />
          {online.length === 0 ? (
            <Empty title={t("admin.noOnline")} />
          ) : (
            online.map((r) => <RiderCard key={r.id} rider={r} />)
          )}
        </>
      ) : (
        <ApplicationList
          items={applications.filter((a) => a.status === tab)}
          stats={tab === "approved" ? stats : undefined}
          busy={busy}
          onReview={tab === "pending" ? review : undefined}
        />
      )}

      <LinkButton title={t("common.signOut")} onPress={signOut} />
    </Screen>
  );
}

function ApplicationList({
  items,
  stats,
  busy,
  onReview,
}: {
  items: Application[];
  stats?: Stats;
  busy: string | null;
  onReview?: (userId: string, approve: boolean) => void;
}) {
  const { t, locale } = useI18n();
  if (items.length === 0) return <Empty title={t("admin.noApplications")} />;
  return items.map((a) => {
    const s = stats?.[a.user_id];
    const code = riderCode(a.rider_number);
    return (
      <Card key={a.user_id}>
        <Row gap={Spacing.three} style={{ alignItems: "flex-start" }}>
          <RiderAvatar
            name={a.profile?.full_name ?? "?"}
            photoPath={a.profile?.photo_path}
            size={64}
          />
          {a.photoUrl ? (
            <Image
              source={{ uri: a.photoUrl }}
              style={styles.photo}
              contentFit="cover"
              accessibilityLabel={t("admin.idPhoto")}
            />
          ) : null}
          <Stack gap={2} style={{ flex: 1 }}>
            <Txt variant="heading">{a.profile?.full_name ?? "—"}</Txt>
            {code ? <Txt style={{ fontWeight: "700" }}>{code}</Txt> : null}
            {stats ? (
              <Txt variant="muted">
                {t("admin.stats", {
                  calls: s?.calls ?? 0,
                  rating: s?.ratings
                    ? t("rating.value", {
                        rating: ratingLabel(s.stars / s.ratings)!,
                        count: s.ratings,
                      })
                    : t("admin.noRating"),
                })}
              </Txt>
            ) : null}
            <Txt variant="muted">{formatPhone(a.profile?.phone)}</Txt>
            <Txt variant="muted">
              {t("admin.idLine", { id: a.id_number, plate: a.plate })}
            </Txt>
            <Txt variant="muted">
              {t("admin.districtLine", {
                d: a.district,
                date: new Date(a.created_at).toLocaleDateString(locale),
              })}
            </Txt>
          </Stack>
        </Row>
        {onReview ? (
          <View style={styles.actions}>
            <Button
              title={t("admin.approve")}
              onPress={() => onReview(a.user_id, true)}
              loading={busy === a.user_id}
              style={{ flex: 1 }}
            />
            <Button
              title={t("admin.reject")}
              kind="danger"
              onPress={() => onReview(a.user_id, false)}
              disabled={busy === a.user_id}
              style={{ flex: 1 }}
            />
          </View>
        ) : null}
      </Card>
    );
  });
}

const styles = StyleSheet.create({
  photo: { width: 96, height: 64, borderRadius: Radius.small },
  actions: { flexDirection: "row", gap: Spacing.two },
});
