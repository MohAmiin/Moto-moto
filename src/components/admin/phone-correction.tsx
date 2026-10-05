import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AdminButton, Notice, Panel, TextField } from '@/components/kit';
import { LinkButton, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { formatPhone, isValidNewLocalPhone, normalizeLocalPhone } from '@/lib/format';
import { useI18n, type TKey } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

const ERRORS: Record<string, TKey> = {
  'phone taken': 'phone.errTaken',
  'same number': 'phone.errSame',
  'invalid phone': 'signin.phoneFull',
  'account not found': 'err.generic',
};

/**
 * Corrects an account's phone number (admin_change_phone): the database checks no other account has it in
 * any form, keeps the PIN and history, and makes riders confirm the new number before approval again.
 */
export function PhoneCorrection({ userId, isRider, onChanged }: { userId: string; isRider: boolean; onChanged: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean }>();
  const local = normalizeLocalPhone(input);
  const valid = isValidNewLocalPhone(local);

  async function change() {
    if (!valid || busy) return;
    setBusy(true);
    setMessage(undefined);
    const { error } = await supabase.rpc('admin_change_phone', { p_user_id: userId, p_phone: `252${local}` });
    setBusy(false);
    if (error) {
      const key = ERRORS[error.message];
      setMessage({ text: key ? t(key) : t('err.generic'), error: true });
      return;
    }
    setOpen(false);
    setInput('');
    setMessage({ text: t('phone.changed', { phone: formatPhone(local) }), error: false });
    onChanged();
  }

  if (!open) {
    return (
      <View style={{ gap: Spacing.one }}>
        <LinkButton title={t('phone.correct')} onPress={() => setOpen(true)} />
        {message ? (
          <Txt color={message.error ? 'danger' : 'success'} style={styles.small} accessibilityLiveRegion="polite">
            {message.text}
          </Txt>
        ) : null}
      </View>
    );
  }

  return (
    <Panel>
      <TextField
        label={t('phone.newNumber')}
        value={input}
        onChangeText={setInput}
        keyboardType="phone-pad"
        placeholder="63 123 4567"
        autoCorrect={false}
        help={valid ? t('signin.phoneCheck', { phone: formatPhone(local) }) : t('signin.phoneFull')}
      />
      <Notice icon="info" tone="info" title={t('phone.effectTitle')} body={t(isRider ? 'phone.effectRider' : 'phone.effectCustomer')} />
      {message ? (
        <Txt color={message.error ? 'danger' : 'success'} style={styles.small} accessibilityRole="alert">
          {message.text}
        </Txt>
      ) : null}
      <View style={styles.actions}>
        <AdminButton title={t('acct.deleteCancel')} kind="outline" onPress={() => setOpen(false)} disabled={busy} style={{ flex: 1 }} />
        <AdminButton title={t('phone.change')} onPress={change} loading={busy} disabled={!valid} style={{ flex: 1 }} />
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  small: { fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: Spacing.two },
});
