import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, Card, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';
import { errorKey, supabase } from '@/lib/supabase';
import type { RiderApplication } from '@/lib/types';

/**
 * On the pending screen: the rider shows a one-time code and reads it out when Jareeye calls their
 * registered number. The admin types it in; approval needs it (see 20261008000000_rider_phone_verification.sql).
 * The screen updates by itself once confirmed, through the application's realtime updates.
 */
export function PhoneCheck({ application }: { application: RiderApplication }) {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const [code, setCode] = useState<{ code: string; expires_at: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  if (application.phone_verified_at) {
    return (
      <Card tone="soft">
        <Txt style={{ fontWeight: '700', color: theme.success }}>✓ {t('rider.verifyDone')}</Txt>
      </Card>
    );
  }

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
    <Card>
      <Txt variant="heading">{t('rider.verifyTitle')}</Txt>
      <Txt variant="muted">{t('rider.verifyBody')}</Txt>
      {code ? (
        <>
          <Txt accessibilityLabel={code.code.split('').join(' ')} selectable style={[styles.code, { color: theme.brand }]}>
            {`${code.code.slice(0, 3)} ${code.code.slice(3)}`}
          </Txt>
          <Txt variant="muted" style={{ textAlign: 'center' }}>
            {t('signin.resetExpires', {
              time: new Date(code.expires_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
            })}
          </Txt>
        </>
      ) : null}
      {error ? (
        <Txt color="danger" accessibilityRole="alert">
          {error}
        </Txt>
      ) : null}
      <Button title={t(code ? 'rider.verifyNew' : 'rider.verifyGet')} kind={code ? 'ghost' : 'primary'} onPress={showCode} loading={loading} />
    </Card>
  );
}

const styles = StyleSheet.create({
  code: { fontSize: 40, lineHeight: 48, fontWeight: '800', letterSpacing: 4, textAlign: 'center', writingDirection: 'ltr' },
});
