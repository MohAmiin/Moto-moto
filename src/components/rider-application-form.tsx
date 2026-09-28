import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Button, Choices, Field, Stack, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { DISTRICTS } from '@/lib/somali';
import { friendlyError, supabase } from '@/lib/supabase';

const districtOptions = DISTRICTS.map((d) => ({ id: d, label: d }));

/**
 * Collects what we need to vet a rider. Creates the rider profile first when `createProfile` is set
 * (new sign-ups), otherwise submits or resubmits the application for an existing rider profile.
 */
export function RiderApplicationForm({ createProfile }: { createProfile: boolean }) {
  const theme = useTheme();
  const { session, profile, application, refresh } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [idNumber, setIdNumber] = useState(application?.id_number ?? '');
  const [plate, setPlate] = useState(application?.plate ?? '');
  const [district, setDistrict] = useState<string>(application?.district ?? profile?.district ?? 'Hodan');
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
      setError('Fadlan buuxi magaca, lambarka aqoonsiga iyo taarikada');
      return;
    }
    if (!photo && !application?.id_photo_path) {
      setError('Fadlan soo geli sawirka kaarka aqoonsiga');
      return;
    }
    if (!agree) {
      setError('Fadlan oggolow shuruudaha');
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
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack>
      {createProfile ? (
        <Field label="Magaca oo buuxa" value={name} onChangeText={setName} autoComplete="name" placeholder="tus. Cabdi Xasan Faarax" />
      ) : null}
      <Field label="Lambarka aqoonsiga" value={idNumber} onChangeText={setIdNumber} placeholder="tus. 1234567" />
      <Field label="Taarikada mootada" value={plate} onChangeText={setPlate} autoCapitalize="characters" placeholder="tus. MT 214" />
      <Choices label="Degmada aad ka shaqeyso" options={districtOptions} value={district} onChange={setDistrict} columns={3} />

      <View style={{ gap: Spacing.two }}>
        <Txt variant="label">Sawirka kaarka aqoonsiga</Txt>
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
              {photo ? 'Sawirka waa la doortay' : application?.id_photo_path ? 'Sawir hore ayaa jira' : 'Sawir ku soo geli'}
            </Txt>
            <Txt variant="muted">{photo ? 'Riix si aad u beddesho' : 'Kaarka aqoonsiga ama baasaboorka'}</Txt>
          </View>
        </Pressable>
      </View>

      <View style={styles.agree}>
        <Switch value={agree} onValueChange={setAgree} accessibilityLabel="Waxaan oggolahay shuruudaha" />
        <Txt style={{ flex: 1 }}>Waxaan oggolahay shuruudaha Dhaqso, waxaanan leeyahay mooto iyo liisan wadis.</Txt>
      </View>

      {error ? <Txt color="danger">{error}</Txt> : null}
      <Button title="Gudbi codsiga" onPress={submit} loading={saving} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  upload: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: Radius.small + 2, padding: Spacing.three },
  preview: { width: 56, height: 56, borderRadius: Radius.small },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  agree: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
});
