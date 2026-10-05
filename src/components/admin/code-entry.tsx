import { useState } from 'react';
import { Linking, StyleSheet, TextInput, View } from 'react-native';

import { AdminButton } from '@/components/kit';
import { Txt, withFont } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CodeResult } from '@/lib/admin';
import { telUrl } from '@/lib/call-log';
import { formatPhone } from '@/lib/format';
import { useI18n, type TKey } from '@/lib/i18n';

/**
 * Call the number, type the 6-digit code the person reads out, and submit. The database decides whether
 * the code is right; this shows what happened (wrong code with tries left, expired, used up).
 */
export function CodeEntry({
  hint,
  phone,
  label,
  action,
  busy,
  onSubmit,
  messages,
}: {
  hint: string;
  phone: string;
  label: string;
  action: string;
  busy: boolean;
  onSubmit: (code: string) => Promise<CodeResult | null>;
  messages: Partial<Record<string, TKey>>;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<string>();

  async function submit() {
    const r = await onSubmit(code);
    if (!r) return;
    setCode('');
    if (r.outcome === 'wrong_code') setResult(t('admin.wrongCode', { n: r.checks_left }));
    else {
      const key = messages[r.outcome];
      setResult(key ? t(key) : undefined);
    }
  }

  return (
    <View style={{ gap: Spacing.two + 2 }}>
      <Txt variant="muted" style={styles.hint}>
        {hint}
      </Txt>
      <AdminButton title={`${t('admin.callNow')} ${formatPhone(phone)}`} kind="outline" icon="phone" onPress={() => Linking.openURL(telUrl(phone))} />
      <Txt variant="muted" style={styles.label}>
        {label}
      </Txt>
      <TextInput
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="000000"
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel={label}
        style={[
          withFont({ fontWeight: '500' }),
          styles.code,
          { color: theme.text, backgroundColor: theme.surfaceMuted, borderColor: result ? theme.danger : theme.hairline },
        ]}
      />
      {result ? (
        <Txt color="danger" style={styles.hint} accessibilityRole="alert">
          {result}
        </Txt>
      ) : null}
      <AdminButton title={action} onPress={submit} loading={busy} disabled={code.length !== 6} />
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, lineHeight: 16, marginBottom: -Spacing.one },
  code: {
    fontSize: 22,
    letterSpacing: 6,
    textAlign: 'center',
    writingDirection: 'ltr',
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 52,
    paddingVertical: Spacing.two,
  },
});
