import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AdminButton, AdminScreen, InfoLine, Panel, SectionTitle, TopBar } from '@/components/kit';
import { DeleteAccount } from '@/components/delete-account';
import { Preferences } from '@/components/preferences';
import { RiderAvatar } from '@/components/rider-avatar';
import { Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { formatPhone } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { riderCode, uploadRiderPhoto } from '@/lib/rider';
import { errorKey } from '@/lib/supabase';

export default function RiderAccount() {
  const { t } = useI18n();
  const { profile, application, refresh, signOut } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  if (!profile) return null;

  async function changePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled) return;
    setSaving(true);
    setError(undefined);
    try {
      await uploadRiderPhoto(profile!.id, result.assets[0], profile!.photo_path ?? null);
      await refresh();
    } catch (e) {
      console.warn('photo upload failed', e);
      setError(t(errorKey(e)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminScreen header={<TopBar title={t('acct.title')} showProfile={false} />}>
      <Panel>
        <View style={styles.head}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('rider.changePhoto')} onPress={changePhoto} hitSlop={6}>
            <RiderAvatar name={profile.full_name} photoPath={profile.photo_path} size={60} round />
          </Pressable>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt style={styles.name}>{profile.full_name}</Txt>
            <Txt variant="muted" style={styles.small}>
              {[riderCode(application?.rider_number), formatPhone(profile.phone)].filter(Boolean).join(' · ')}
            </Txt>
          </View>
        </View>
        <AdminButton title={profile.photo_path ? t('rider.changePhoto') : t('rider.addPhoto')} kind="outline" icon="camera" onPress={changePhoto} loading={saving} />
        {error ? (
          <Txt color="danger" style={styles.small} accessibilityRole="alert">
            {error}
          </Txt>
        ) : null}
      </Panel>

      <SectionTitle title={t('adm.details')} />
      <Panel>
        <InfoLine label={t('rx.jry')} value={riderCode(application?.rider_number)} />
        <InfoLine label={t('common.plate')} value={application?.plate} />
        <InfoLine label={t('common.phoneShort')} value={formatPhone(profile.phone)} last />
      </Panel>

      <Preferences />

      <AdminButton title={t('common.signOut')} kind="danger" icon="signOut" onPress={signOut} style={{ marginTop: Spacing.two }} />
      <DeleteAccount />
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4 },
  name: { fontSize: 17, lineHeight: 23, fontWeight: '500' },
  small: { fontSize: 13, lineHeight: 18 },
});
