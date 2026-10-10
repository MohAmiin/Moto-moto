import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AdminButton, AdminScreen, Badge, FilterChips, Panel, PhoneTextField, PinField } from '@/components/kit';
import { LinkButton, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatPhone, isValidLocalPhone, isValidNewLocalPhone, normalizeLocalPhone, toE164 } from '@/lib/format';
import { LANGUAGES, useI18n, type TKey } from '@/lib/i18n';
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
  const { t, locale, language, setLanguage } = useI18n();
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

  return (
    <AdminScreen edges={['top', 'bottom']}>
      <View style={styles.langs}>
        <FilterChips options={LANGUAGES.map((l) => ({ id: l.id, label: l.label }))} value={language} onChange={setLanguage} />
      </View>

      {mode === 'signIn' ? (
        <Panel style={{ alignItems: 'center' }}>
          <Image
            source={require('@/assets/images/logo-full.png')}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel="Jareeye Moto Delivery"
            accessibilityIgnoresInvertColors
          />
          <Txt style={styles.headline} accessibilityRole="header">
            {t('signin.headline')}
          </Txt>
          <Txt variant="muted" style={styles.center}>
            {t('signin.sub')}
          </Txt>
          <Badge tone="accent" label={t('signin.badge')} />
        </Panel>
      ) : null}

      {mode === 'resetSent' && reset ? (
        <Panel>
          <Txt style={styles.title} accessibilityRole="header">
            {t('signin.resetTitle')}
          </Txt>
          <Txt variant="muted" style={styles.small}>
            {t('signin.resetCode')}
          </Txt>
          <View style={[styles.codeBox, { backgroundColor: theme.surfaceMuted, borderColor: theme.hairline }]}>
            <Txt accessibilityLabel={reset.code.split('').join(' ')} selectable style={[styles.code, { color: theme.primaryText }]}>
              {`${reset.code.slice(0, 3)} ${reset.code.slice(3)}`}
            </Txt>
            <Txt variant="muted" style={styles.small}>
              {t('signin.resetExpires', {
                time: new Date(reset.expiresAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
              })}
            </Txt>
          </View>
          <Txt style={styles.body}>{t('signin.resetSent', { phone: formatPhone(reset.phone) })}</Txt>
          <LinkButton title={t('signin.back')} onPress={() => switchMode('signIn')} />
        </Panel>
      ) : (
        <Panel>
          {mode === 'create' ? (
            <Txt style={styles.title} accessibilityRole="header">
              {t('signin.create')}
            </Txt>
          ) : null}
          {mode === 'reset' ? (
            <Txt style={styles.title} accessibilityRole="header">
              {t('signin.resetTitle')}
            </Txt>
          ) : null}

          <PhoneTextField
            label={t('common.phone')}
            value={phone}
            onChangeText={setPhone}
            help={
              mode === 'create' && isValidNewLocalPhone(normalizeLocalPhone(phone))
                ? t('signin.phoneCheck', { phone: formatPhone(normalizeLocalPhone(phone)) })
                : undefined
            }
          />
          <PinField label={t(mode === 'reset' ? 'signin.pinNew' : 'signin.pin')} value={pin} onChangeText={setPin} />
          {mode !== 'signIn' ? <PinField label={t('signin.pinConfirm')} value={pin2} onChangeText={setPin2} /> : null}

          {mode === 'create' ? (
            <Txt variant="muted" style={styles.small}>
              {t('signin.createNote')}
            </Txt>
          ) : null}
          {mode === 'reset' ? (
            <Txt variant="muted" style={styles.small}>
              {t('signin.resetNote')}
            </Txt>
          ) : null}
          {error ? (
            <Txt color="danger" style={styles.small} accessibilityRole="alert">
              {error}
            </Txt>
          ) : null}

          <AdminButton
            title={t(mode === 'signIn' ? 'signin.signIn' : mode === 'create' ? 'signin.create' : 'signin.resetSend')}
            onPress={submit}
            loading={busy}
          />
          {mode !== 'signIn' ? <LinkButton title={t('signin.back')} onPress={() => switchMode('signIn')} /> : null}
        </Panel>
      )}

      {mode === 'signIn' ? (
        <Panel>
          <LinkButton title={t('signin.toCreate')} onPress={() => switchMode('create')} />
          <LinkButton title={t('signin.forgot')} onPress={() => switchMode('reset')} />
          <Txt variant="muted" style={styles.small}>
            {t('signin.both')}
          </Txt>
          <LinkButton title={t('signin.useSms')} onPress={useSmsCode} />
        </Panel>
      ) : null}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  langs: { alignItems: 'flex-start' },
  logo: { width: '100%', height: 120 },
  headline: { fontSize: 20, lineHeight: 26, fontWeight: '500', textAlign: 'center' },
  center: { textAlign: 'center', fontSize: 14, lineHeight: 20 },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '500' },
  body: { fontSize: 14, lineHeight: 20 },
  small: { fontSize: 13, lineHeight: 18 },
  codeBox: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, alignItems: 'center', paddingVertical: 12, gap: 2 },
  code: { fontSize: 34, lineHeight: 42, fontWeight: '500', letterSpacing: 4, writingDirection: 'ltr' },
});
