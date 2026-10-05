import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AdminButton } from '@/components/kit';
import { Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';
import { errorKey, supabase } from '@/lib/supabase';

/**
 * On the pending screen: the rider shows a one-time code and reads it out when Jareeye calls their
 * registered number. The admin types it in; approval needs it (see 20261008000000_rider_phone_verification.sql).
 * The screen updates by itself once confirmed, through the application's realtime updates.
 */
export function PhoneCheck() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const [code, setCode] = useState<{ code: string; expires_at: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function showCode() {
    setLoading(true);
    setError(undefined);
    const { data, error: e } = await supabase.rpc('rider_phone_code');
    setLoading(false);
    const row = (data as { code: string; expires_at: string }[] | null)?.[0];
    if (e || !row) setError(t(errorKey(e)));
    else setCode(row);
  }

  return (
    <View style={{ gap: 8 }}>
      {code ? (
        <View style={[styles.codeBox, { backgroundColor: theme.surfaceMuted, borderColor: theme.hairline }]}>
          <Txt accessibilityLabel={code.code.split('').join(' ')} selectable style={[styles.code, { color: theme.primaryText }]}>
            {`${code.code.slice(0, 3)} ${code.code.slice(3)}`}
          </Txt>
          <Txt variant="muted" style={styles.small}>
            {t('signin.resetExpires', { time: new Date(code.expires_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}
          </Txt>
        </View>
      ) : null}
      {error ? (
        <Txt color="danger" style={styles.small} accessibilityRole="alert">
          {error}
        </Txt>
      ) : null}
      <AdminButton title={t(code ? 'rider.verifyNew' : 'rider.verifyGet')} kind={code ? 'outline' : 'primary'} onPress={showCode} loading={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  codeBox: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, alignItems: 'center', paddingVertical: 12, gap: 2 },
  code: { fontSize: 34, lineHeight: 42, fontWeight: '500', letterSpacing: 4, writingDirection: 'ltr' },
  small: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
