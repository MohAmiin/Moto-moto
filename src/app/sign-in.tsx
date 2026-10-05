import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Field, LanguageSwitcher, LinkButton, PhoneField, Screen, Stack, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatPhone, isValidLocalPhone, isValidNewLocalPhone, normalizeLocalPhone, toE164 } from '@/lib/format';
import { useI18n, type TKey } from '@/lib/i18n';
import { isValidNewPin, isValidSignInPin, pinAuth, type PinAuthError } from '@/lib/pin';
import { errorKey, supabase } from '@/lib/supabase';

type Mode = 'signIn' | 'create' | 'reset' | 'resetSent';

const PIN_ERRORS: Record<Exclude<PinAuthError, 'locked'>, TKey> = {
  wrong: 'err.badPin',
  invalid: 'signin.pinInvalid',
  too_many: 'err.tooMany',
  taken: 'err.pinTaken',
  offline: 'err.offline',
  server: 'err.generic',
};

/**
 * Phone number + PIN. Older accounts have 4-digit PINs; new accounts and resets use 6 digits. A forgotten
 * PIN becomes a request with a one-time code: the admin calls the number and the owner reads the code out.
 * SMS codes still work for numbers set up as test numbers in Supabase.
 */
export default function SignIn() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const [mode, setMode] = useState<Mode>('signIn');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState<{ code: string; expiresAt: string; phone: string }>();

  function switchMode(next: Mode) {
    setMode(next);
    setPin('');
    setPin2('');
    setError(undefined);
  }

  /** Checks the form and returns the local phone digits, or null after showing what's wrong. */
  function validate(needsConfirm: boolean) {
    const local = normalizeLocalPhone(phone);
    if (mode === 'create' ? !isValidNewLocalPhone(local) : !isValidLocalPhone(local)) {
      setError(t(mode === 'create' ? 'signin.phoneFull' : 'signin.invalidPhone'));
      return null;
    }
    if (mode === 'signIn' ? !isValidSignInPin(pin) : !isValidNewPin(pin)) {
      setError(t(mode === 'signIn' ? 'signin.pinInvalid' : 'signin.pinNewInvalid'));
      return null;
    }
    if (needsConfirm && pin !== pin2) {
      setError(t('signin.pinMismatch'));
      return null;
    }
    setError(undefined);
    return local;
  }

  async function submit() {
    const local = validate(mode !== 'signIn');
    if (!local) return;
    setBusy(true);
    try {
      const phoneDigits = `252${local}`;
      const result = await pinAuth(mode === 'signIn' ? 'sign-in' : mode === 'create' ? 'sign-up' : 'reset', phoneDigits, pin);
      if (!result.ok) {
        setError(
          result.error === 'locked'
            ? t('err.locked', { minutes: Math.max(1, Math.ceil((result.retryAfterSeconds ?? 900) / 60)) })
            : t(PIN_ERRORS[result.error]),
        );
      } else if (mode === 'reset' && result.code && result.expiresAt) {
        setReset({ code: result.code, expiresAt: result.expiresAt, phone: phoneDigits });
        switchMode('resetSent');
      }
      // Signed in: the app moves on to onboarding or the home screen by itself.
    } catch (e) {
      setError(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  async function useSmsCode() {
    const local = normalizeLocalPhone(phone);
    if (!isValidLocalPhone(local)) {
      setError(t('signin.invalidPhone'));
      return;
    }
    setError(undefined);
    setBusy(true);
    const { error: e } = await supabase.auth.signInWithOtp({ phone: toE164(local) });
    setBusy(false);
    if (e) {
      setError(t(errorKey(e)));
      return;
    }
    router.push({ pathname: '/verify', params: { phone: local } });
  }

  const pinProps = { keyboardType: 'number-pad' as const, secureTextEntry: true, maxLength: 6, style: styles.pin, placeholder: '••••••' };

  return (
    <Screen>
      <LanguageSwitcher />
      <View style={styles.logoPanel}>
        <Image
          source={require('@/assets/images/logo-full.png')}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel="Jareeye Moto Delivery"
          accessibilityIgnoresInvertColors
        />
      </View>

      {mode === 'signIn' ? (
        <View style={[styles.hero, { backgroundColor: '#0046B5' }]}>
          <Txt variant="title" style={{ color: '#FFFFFF' }}>{t('signin.headline')}</Txt>
          <Txt style={{ color: '#FFFFFF', opacity: 0.85 }}>{t('signin.sub')}</Txt>
          <View style={[styles.badge, { backgroundColor: theme.gold }]}>
            <Txt style={[styles.badgeText, { color: theme.onGold }]}>{t('signin.badge')}</Txt>
          </View>
        </View>
      ) : null}

      {mode === 'resetSent' && reset ? (
        <Card tone="soft">
          <Txt variant="heading">{t('signin.resetTitle')}</Txt>
          <Txt variant="muted">{t('signin.resetCode')}</Txt>
          <Txt
            accessibilityLabel={reset.code.split('').join(' ')}
            selectable
            style={[styles.code, { color: theme.brand }]}>
            {`${reset.code.slice(0, 3)} ${reset.code.slice(3)}`}
          </Txt>
          <Txt variant="muted">
            {t('signin.resetExpires', {
              time: new Date(reset.expiresAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
            })}
          </Txt>
          <Txt>{t('signin.resetSent', { phone: formatPhone(reset.phone) })}</Txt>
          <LinkButton title={t('signin.back')} onPress={() => switchMode('signIn')} />
        </Card>
      ) : (
        <Stack>
          {mode === 'create' ? <Txt variant="title">{t('signin.create')}</Txt> : null}
          {mode === 'reset' ? <Txt variant="title">{t('signin.resetTitle')}</Txt> : null}

          <PhoneField value={phone} onChangeText={setPhone} />
          {mode === 'create' && isValidNewLocalPhone(normalizeLocalPhone(phone)) ? (
            <Txt variant="muted" accessibilityLiveRegion="polite">
              {t('signin.phoneCheck', { phone: formatPhone(normalizeLocalPhone(phone)) })}
            </Txt>
          ) : null}
          <Field
            label={t(mode === 'reset' ? 'signin.pinNew' : 'signin.pin')}
            value={pin}
            onChangeText={(v) => setPin(v.replace(/\D/g, ''))}
            {...pinProps}
          />
          {mode !== 'signIn' ? (
            <Field label={t('signin.pinConfirm')} value={pin2} onChangeText={(v) => setPin2(v.replace(/\D/g, ''))} {...pinProps} />
          ) : null}

          {mode === 'create' ? <Txt variant="muted">{t('signin.createNote')}</Txt> : null}
          {mode === 'reset' ? <Txt variant="muted">{t('signin.resetNote')}</Txt> : null}
          {error ? <Txt color="danger">{error}</Txt> : null}

          <Button
            title={t(mode === 'signIn' ? 'signin.signIn' : mode === 'create' ? 'signin.create' : 'signin.resetSend')}
            onPress={submit}
            loading={busy}
          />

          {mode === 'signIn' ? (
            <>
              <LinkButton title={t('signin.toCreate')} onPress={() => switchMode('create')} />
              <LinkButton title={t('signin.forgot')} onPress={() => switchMode('reset')} />
              <Txt variant="muted" style={{ textAlign: 'center' }}>{t('signin.both')}</Txt>
              <LinkButton title={t('signin.useSms')} onPress={useSmsCode} />
            </>
          ) : (
            <LinkButton title={t('signin.back')} onPress={() => switchMode('signIn')} />
          )}
        </Stack>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: Radius.large + 2, padding: Spacing.four, gap: Spacing.three },
  logoPanel: { backgroundColor: '#FFFFFF', borderRadius: Radius.large + 2, padding: Spacing.three, alignItems: 'center' },
  logo: { width: '100%', height: 190 },
  badge: { alignSelf: 'flex-start', borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { fontWeight: '900', fontSize: 13 },
  pin: { fontSize: 24, letterSpacing: 10, textAlign: 'center', writingDirection: 'ltr' },
  code: { fontSize: 40, lineHeight: 48, fontWeight: '800', letterSpacing: 4, textAlign: 'center', writingDirection: 'ltr' },
});
