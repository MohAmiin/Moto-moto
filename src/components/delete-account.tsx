import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, LinkButton, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { errorKey, supabase } from '@/lib/supabase';

/** Removes every file in a user's folder of a storage bucket. */
async function removeFolder(bucket: string, userId: string) {
  const { data } = await supabase.storage.from(bucket).list(userId);
  if (data?.length) await supabase.storage.from(bucket).remove(data.map((f) => `${userId}/${f.name}`));
}

/**
 * "Delete my account", with a confirmation step. Removes the user's photos, then the account and
 * everything linked to it (see delete_my_account in the database), and signs out.
 */
export function DeleteAccount() {
  const { t } = useI18n();
  const { session, signOut } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>();

  async function remove() {
    const userId = session?.user.id;
    if (!userId) return;
    setDeleting(true);
    setError(undefined);
    try {
      await removeFolder('rider-photos', userId);
      await removeFolder('rider-ids', userId);
      const { error: e } = await supabase.rpc('delete_my_account');
      if (e) throw e;
      await signOut();
    } catch (e) {
      setError(t(errorKey(e)));
      setDeleting(false);
    }
  }

  if (!confirming) return <LinkButton title={t('acct.delete')} onPress={() => setConfirming(true)} />;

  return (
    <Card>
      <Txt variant="heading">{t('acct.deleteTitle')}</Txt>
      <Txt>{t('acct.deleteBody')}</Txt>
      {error ? <Txt color="danger">{error}</Txt> : null}
      <View style={{ gap: Spacing.two }}>
        <Button title={t('acct.deleteConfirm')} kind="danger" onPress={remove} loading={deleting} />
        <Button title={t('acct.deleteCancel')} kind="ghost" onPress={() => setConfirming(false)} disabled={deleting} />
      </View>
    </Card>
  );
}
