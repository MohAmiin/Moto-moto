import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { AdminButton, AdminIcon, FilterChips, TextField } from '@/components/kit';
import { Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { AREA_OPTIONS, toDistrict } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { uploadRiderPhoto } from '@/lib/rider';
import { accountPhone } from '@/lib/pin';
import { errorKey, supabase } from '@/lib/supabase';

/**
 * Collects what we need to vet a rider. Creates the rider profile first when `createProfile` is set
 * (new sign-ups), otherwise submits or resubmits the application for an existing rider profile.
 */
export function RiderApplicationForm({ createProfile }: { createProfile: boolean }) {
  const { t } = useI18n();
  const { session, profile, application, refresh } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [idNumber, setIdNumber] = useState(application?.id_number ?? '');
  const [plate, setPlate] = useState(application?.plate ?? '');
  const [district, setDistrict] = useState<string>(toDistrict(application?.district ?? profile?.district));
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [face, setFace] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, allowsEditing: true });
    if (!result.canceled) setPhoto(result.assets[0]);
  }

  async function pickFace() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled) setFace(result.assets[0]);
  }

  async function submit() {
    const userId = session?.user.id;
    if (!userId) return;
    // The ID number and ID photo are optional for now; when given, the ID number must be 3+ characters.
    const id = idNumber.trim();
    if ((createProfile && name.trim().length < 2) || (id.length > 0 && id.length < 3) || plate.trim().length < 2) {
      setError(t('rf.missingFields'));
      return;
    }
    if (!face && !profile?.photo_path) {
      setError(t('rf.missingFace'));
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
          .insert({ id: userId, role: 'rider', full_name: name.trim(), phone: accountPhone(session.user), district });
        if (e) throw e;
      }

      if (face) await uploadRiderPhoto(userId, face, profile?.photo_path ?? null);

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

      const fields = { id_number: id || null, plate: plate.trim().toUpperCase(), district, id_photo_path: photoPath, status: 'pending' as const };
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

  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.three }}>
      {createProfile ? (
        <TextField label={t('rf.fullName')} value={name} onChangeText={setName} autoComplete="name" placeholder={t('rf.fullNamePh')} />
      ) : null}
      <TextField label={t('rf.idNumber')} value={idNumber} onChangeText={setIdNumber} placeholder={t('rf.idPh')} />
      <TextField label={t('rf.plate')} value={plate} onChangeText={setPlate} autoCapitalize="characters" placeholder={t('rf.platePh')} />
      <View style={{ gap: 4 }}>
        <Txt variant="muted" style={styles.label}>
          {t('rf.workDistrict')}
        </Txt>
        <FilterChips options={AREA_OPTIONS} value={district} onChange={setDistrict} />
      </View>

      <PhotoPicker
        label={t('rf.facePhoto')}
        asset={face}
        onPress={pickFace}
        title={face ? t('rf.photoChosen') : profile?.photo_path ? t('rf.photoExists') : t('rf.photoAdd')}
        hint={face ? t('rf.photoChange') : t('rf.faceHint')}
      />

      <PhotoPicker
        label={t('rf.idPhoto')}
        asset={photo}
        onPress={pickPhoto}
        title={photo ? t('rf.photoChosen') : application?.id_photo_path ? t('rf.photoExists') : t('rf.photoAdd')}
        hint={photo ? t('rf.photoChange') : t('rf.photoHint')}
      />

      <View style={styles.agree}>
        <Switch
          value={agree}
          onValueChange={setAgree}
          accessibilityLabel={t('rf.agree')}
          trackColor={{ false: theme.hairline, true: theme.primary }}
          thumbColor="#FFFFFF"
        />
        <Txt style={styles.agreeText}>{t('rf.agree')}</Txt>
      </View>

      {error ? (
        <Txt color="danger" style={styles.small} accessibilityRole="alert">
          {error}
        </Txt>
      ) : null}
      <AdminButton title={t('rf.submit')} onPress={submit} loading={saving} />
    </View>
  );
}

function PhotoPicker({
  label,
  asset,
  onPress,
  title,
  hint,
}: {
  label: string;
  asset: ImagePicker.ImagePickerAsset | null;
  onPress: () => void;
  title: string;
  hint: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Txt variant="muted" style={styles.label}>
        {label}
      </Txt>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${title}`}
        onPress={onPress}
        style={({ pressed }) => [styles.upload, { borderColor: theme.hairline, backgroundColor: theme.surfaceMuted, opacity: pressed ? 0.8 : 1 }]}>
        {asset ? (
          <Image source={{ uri: asset.uri }} style={styles.preview} contentFit="cover" />
        ) : (
          <View style={[styles.preview, styles.placeholder, { backgroundColor: theme.surface, borderColor: theme.hairline }]}>
            <AdminIcon name="camera" size={20} color={theme.textSecondary} />
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Txt style={styles.pickTitle}>{title}</Txt>
          <Txt variant="muted" style={styles.small}>
            {hint}
          </Txt>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, lineHeight: 16 },
  small: { fontSize: 13, lineHeight: 18 },
  upload: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: Spacing.two + 4, minHeight: 72 },
  preview: { width: 52, height: 52, borderRadius: 10 },
  placeholder: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  pickTitle: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  agree: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4 },
  agreeText: { flex: 1, fontSize: 14, lineHeight: 20 },
});
