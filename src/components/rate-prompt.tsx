import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { RiderAvatar } from '@/components/rider-avatar';
import { Card, LinkButton, Row, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';
import { riderCode } from '@/lib/rider';
import { supabase } from '@/lib/supabase';
import type { CallToRate } from '@/lib/types';

/**
 * Asks the customer to rate the driver they last called, a few minutes after the call. Shows nothing
 * when there is no call to rate; skipping counts as answered so the question isn't repeated.
 */
export function RatePrompt() {
  const theme = useTheme();
  const { t } = useI18n();
  const [call, setCall] = useState<CallToRate | null>(null);
  const [thanks, setThanks] = useState(false);
  const [sending, setSending] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      supabase.rpc('call_to_rate').then(({ data }) => {
        if (active) setCall(((data as CallToRate[] | null) ?? [])[0] ?? null);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  async function answer(stars: number | null) {
    if (!call || sending) return;
    setSending(true);
    const { error } = await supabase.rpc('rate_call', { p_call_id: call.call_id, p_stars: stars });
    setSending(false);
    if (error) return;
    setCall(null);
    if (stars) setThanks(true);
  }

  if (thanks) {
    return (
      <Card tone="soft">
        <Txt style={{ fontWeight: '700' }}>{t('rate.thanks')}</Txt>
      </Card>
    );
  }
  if (!call) return null;

  const code = riderCode(call.rider_number);
  return (
    <Card tone="soft">
      <Row gap={Spacing.three}>
        <RiderAvatar name={call.full_name} photoPath={call.photo_path} size={44} />
        <View style={{ flex: 1 }}>
          <Txt variant="heading">{t('rate.title', { name: call.full_name })}</Txt>
          <Txt variant="muted">{code ? `${code} · ${t('rate.sub')}` : t('rate.sub')}</Txt>
        </View>
      </Row>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => answer(n)}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel={t('rate.stars', { n })}
            hitSlop={6}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <Txt style={[styles.star, { color: theme.gold }]}>★</Txt>
          </Pressable>
        ))}
      </View>
      <LinkButton title={t('rate.skip')} onPress={() => answer(null)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  stars: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.three },
  star: { fontSize: 38, lineHeight: 44 },
});
