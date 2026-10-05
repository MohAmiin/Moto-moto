import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AdminButton, Badge, EmptyNote, FilterChips, InfoLine, Notice, Panel, SectionTitle, TextField } from '@/components/kit';
import { Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, type TKey } from '@/lib/i18n';
import {
  METHOD_LABEL,
  MEMBERSHIP_LOOK,
  PAYMENT_METHODS,
  confirmMembershipPayment,
  needsAccount,
  needsReference,
  fetchMembershipHistory,
  fetchMemberships,
  newRequestId,
  parseUsd,
  usd,
  type PaymentMethod,
} from '@/lib/membership';
import type { Membership, MembershipPayment } from '@/lib/types';

const ERRORS: Record<string, TKey> = {
  'possible duplicate': 'mem.errDuplicate',
  'invalid amount': 'mem.errAmount',
  'reference too long': 'mem.errReference',
  'reference already used': 'mem.errRefUsed',
  'reference required': 'mem.errRefRequired',
  'receiving account required': 'mem.errAccountRequired',
  'receiving account too long': 'mem.errReference',
  'not a rider': 'err.generic',
};

/**
 * A rider's membership on their admin screen: status, the "Activate / Renew 30 days" form for a payment
 * received outside the app, and the history. Shown (with history) also while the switch is off.
 */
export function RiderMembership({ userId }: { userId: string }) {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const [membership, setMembership] = useState<Membership | null>();
  const [history, setHistory] = useState<MembershipPayment[]>();
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('zaad');
  const [receivedInto, setReceivedInto] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean }>();
  // When the data was loaded, for the preview below (read in the loader, not while rendering).
  const [loadedAt, setLoadedAt] = useState(0);
  // One id per payment being confirmed: kept for retries after a failure, replaced after success.
  const requestId = useRef(newRequestId());

  const load = useCallback(async () => {
    try {
      const [all, rows] = await Promise.all([fetchMemberships(), fetchMembershipHistory(userId)]);
      setMembership(all.get(userId) ?? null);
      setHistory(rows);
      setLoadedAt(Date.now());
    } catch {
      setMembership((prev) => (prev === undefined ? null : prev));
      setHistory((prev) => prev ?? []);
    }
  }, [userId]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, [load]);

  const date = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : null);
  const amountValue = parseUsd(amount);
  const ready =
    amountValue != null && (!needsReference(method) || reference.trim() !== '') && (!needsAccount(method) || receivedInto.trim() !== '');

  async function confirm() {
    if (!ready || amountValue == null || busy) return;
    setBusy(true);
    setMessage(undefined);
    try {
      const r = await confirmMembershipPayment(userId, { amountUsd: amountValue, method, reference, receivedInto }, requestId.current);
      requestId.current = newRequestId();
      setAmount('');
      setReference('');
      setReceivedInto('');
      setMessage({ text: t(r.duplicate ? 'mem.alreadyRecorded' : 'mem.recorded', { date: date(r.period_end) ?? '' }), error: false });
      await load();
    } catch (e) {
      const key = ERRORS[(e as { message?: string }).message ?? ''];
      // A failure that may not have reached the server keeps the same id, so trying again can't renew twice.
      setMessage({ text: key ? t(key) : t('mem.errRetry'), error: true });
    } finally {
      setBusy(false);
    }
  }

  // What a confirmation would do now, as a preview (the database decides with its own clock).
  const current = membership?.expires_at ? new Date(membership.expires_at) : null;
  const start = current && current.getTime() > loadedAt ? current : null;
  const previewEnd = new Date((start ? start.getTime() : loadedAt) + 30 * 86_400_000);
  const look = membership ? MEMBERSHIP_LOOK[membership.status] : null;

  return (
    <>
      <SectionTitle title={t('mem.sectionTitle')} />
      <Panel>
        {membership === undefined ? (
          <EmptyNote icon="clock" title={t('common.loading')} />
        ) : (
          <>
            <View style={styles.head}>
              {look ? <Badge label={t(look.label)} tone={look.tone} /> : null}
              {membership?.expires_at ? (
                <Txt variant="muted" style={styles.small}>
                  {membership.status === 'expired'
                    ? t('mem.expiredOn', { date: date(membership.expires_at) ?? '' })
                    : t('mem.until', { date: date(membership.expires_at) ?? '', n: membership.days_left ?? 0 })}
                </Txt>
              ) : null}
            </View>

            <Notice icon="info" tone="info" title={t('mem.verifyFirst')} body={t('mem.verifyFirstBody')} />
            <Txt variant="muted" style={styles.label}>
              {t('mem.method')}
            </Txt>
            <FilterChips
              options={PAYMENT_METHODS.map((m) => ({ id: m, label: t(METHOD_LABEL[m]) }))}
              value={method}
              onChange={(m) => {
                setMethod(m);
                setMessage(undefined);
              }}
            />
            <TextField label={t('mem.amount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="1.00" />
            {needsReference(method) ? (
              <TextField
                label={t('mem.referenceRequired')}
                value={reference}
                onChangeText={setReference}
                maxLength={120}
                placeholder={t('mem.referencePh')}
                autoCapitalize="characters"
                autoCorrect={false}
                help={t('mem.referenceHelp')}
              />
            ) : (
              <TextField label={t('mem.reference')} value={reference} onChangeText={setReference} maxLength={120} placeholder={t('mem.cashRefPh')} autoCorrect={false} />
            )}
            {method !== 'cash' ? (
              <TextField
                label={t(needsAccount(method) ? 'mem.receivedIntoRequired' : 'mem.receivedInto')}
                value={receivedInto}
                onChangeText={setReceivedInto}
                maxLength={60}
                placeholder={t('mem.receivedIntoPh')}
                autoCorrect={false}
              />
            ) : null}
            <Txt variant="muted" style={styles.small}>
              {t(start ? 'mem.previewRenew' : 'mem.previewNew', { date: date(previewEnd.toISOString()) ?? '' })}
            </Txt>
            <AdminButton title={t('mem.activate')} kind="accent" icon="check" onPress={confirm} loading={busy} disabled={!ready} />
            {message ? (
              <Txt color={message.error ? 'danger' : undefined} style={[styles.small, !message.error && { color: theme.success }]} accessibilityLiveRegion="polite">
                {message.text}
              </Txt>
            ) : null}
          </>
        )}
      </Panel>

      {history && history.length > 0 ? (
        <>
          <SectionTitle title={t('mem.history')} />
          <Panel>
            {history.map((h, i) => (
              <InfoLine
                key={h.id}
                label={[
                  date(h.confirmed_at),
                  h.kind === 'grace' ? t('mem.grace') : usd(h.amount_usd),
                  h.method && h.method in METHOD_LABEL ? t(METHOD_LABEL[h.method as PaymentMethod]) : null,
                  h.reference,
                  h.received_into,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                value={t('mem.historyLine', { from: date(h.period_start) ?? '', to: date(h.period_end) ?? '', name: h.confirmed_by_name ?? '—' })}
                last={i === history.length - 1}
              />
            ))}
          </Panel>
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.two },
  small: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, lineHeight: 16, marginBottom: -4 },
});
