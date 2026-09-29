import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Button, Choices, Field, Stack, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { AREA_OPTIONS, DEFAULT_AREA } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { errorKey, supabase } from '@/lib/supabase';

/**
 * Collects what we need to vet a rider. Creates the rider profile first when `createProfile` is set
 * (new sign-ups), otherwise submits or resubmits the application for an existing rider profile.
 */
export function RiderApplicationForm({ createProfile }: { createProfile: boolean }) {
  const theme = useTheme();
  const { t } = useI18n();
  const { session, profile, application, refresh } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [idNumber, setIdNumber] = useState(application?.id_number ?? '');
  const [plate, setPlate] = useState(application?.plate ?? '');
  const [district, setDistrict] = useState<string>(application?.district ?? profile?.district ?? DEFAULT_AREA);
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, allowsEditing: true });
    if (!result.canceled) setPhoto(result.assets[0]);
  }

  async function submit() {
    const userId = session?.user.id;
    if (!userId) return;
    if ((createProfile && name.trim().length < 2) || idNumber.trim().length < 3 || plate.trim().length < 2) {
      setError(t('rf.missingFields'));
      return;
    }
    if (!photo && !application?.id_photo_path) {
      setError(t('rf.missingPhoto'));
      return;
    }
    if (!agree) {
      setError(t('rf.mustAgree'));
      return;
    }
    setError(undefined);
    setSaving(true);
    try {
      if (createProfile) {
        const { error: e } = await supabase
          .from('profiles')
          .insert({ id: userId, role: 'rider', full_name: name.trim(), phone: session.user.phone ?? null, district });
        if (e) throw e;
      }

      let photoPath = application?.id_photo_path ?? null;
      if (photo) {
        const body = await (await fetch(photo.uri)).arrayBuffer();
        const ext = photo.mimeType === 'image/png' ? 'png' : 'jpg';
        photoPath = `${userId}/id.${ext}`;
        const { error: e } = await supabase.storage
          .from('rider-ids')
          .upload(photoPath, body, { contentType: photo.mimeType ?? 'image/jpeg', upsert: true });
        if (e) throw e;
      }

      const fields = { id_number: idNumber.trim(), plate: plate.trim().toUpperCase(), district, id_photo_path: photoPath, status: 'pending' as const };
      const { error: e } = application
        ? await supabase.from('rider_applications').update(fields).eq('user_id', userId)
        : await supabase.from('rider_applications').insert({ user_id: userId, ...fields });
      if (e) throw e;

      await refresh();
    } catch (e) {
      setError(t(errorKey(e)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack>
      {createProfile ? (
        <Field label={t('rf.fullName')} value={name} onChangeText={setName} autoComplete="name" placeholder={t('rf.fullNamePh')} />
      ) : null}
      <Field label={t('rf.idNumber')} value={idNumber} onChangeText={setIdNumber} placeholder={t('rf.idPh')} />
      <Field label={t('rf.plate')} value={plate} onChangeText={setPlate} autoCapitalize="characters" placeholder={t('rf.platePh')} />
      <Choices label={t('rf.workDistrict')} options={AREA_OPTIONS} value={district} onChange={setDistrict} columns={2} />

      <View style={{ gap: Spacing.two }}>
        <Txt variant="label">{t('rf.idPhoto')}</Txt>
        <Pressable
          accessibilityRole="button"
          onPress={pickPhoto}
          style={[styles.upload, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
          {photo ? (
            <Image source={{ uri: photo.uri }} style={styles.preview} contentFit="cover" />
          ) : (
            <View style={[styles.preview, styles.placeholder, { backgroundColor: theme.border }]}>
              <Txt variant="heading" color="textSecondary">+</Txt>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Txt style={{ fontWeight: '700' }}>
              {photo ? t('rf.photoChosen') : application?.id_photo_path ? t('rf.photoExists') : t('rf.photoAdd')}
            </Txt>
            <Txt variant="muted">{photo ? t('rf.photoChange') : t('rf.photoHint')}</Txt>
          </View>
        </Pressable>
      </View>

      <View style={styles.agree}>
        <Switch value={agree} onValueChange={setAgree} accessibilityLabel={t('rf.agree')} />
        <Txt style={{ flex: 1 }}>{t('rf.agree')}</Txt>
      </View>

      {error ? <Txt color="danger">{error}</Txt> : null}
      <Button title={t('rf.submit')} onPress={submit} loading={saving} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  upload: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: Radius.small + 2, padding: Spacing.three },
  preview: { width: 56, height: 56, borderRadius: Radius.small },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  agree: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
});
