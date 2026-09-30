import type { ImagePickerAsset } from 'expo-image-picker';

import { LTR, PDI } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

const PHOTO_BUCKET = 'rider-photos';

/** A driver's Jareeye number as printed on their vest, e.g. JRY-007. */
export function riderCode(n: number | null | undefined) {
  return n == null ? null : `${LTR}JRY-${String(n).padStart(3, '0')}${PDI}`;
}

/** Public link to a driver's face photo. */
export function riderPhotoUrl(path: string | null | undefined) {
  return path ? supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl : null;
}

/** "4.8" for a rating; null before the first one. */
export function ratingLabel(rating: number | string | null | undefined) {
  return rating == null ? null : Number(rating).toFixed(1);
}

/**
 * Uploads a new face photo and saves it on the profile. Each photo gets a new file name so phones don't
 * keep showing a cached old one; the previous file is removed.
 */
export async function uploadRiderPhoto(userId: string, asset: ImagePickerAsset, oldPath: string | null) {
  const body = await (await fetch(asset.uri)).arrayBuffer();
  const ext = asset.mimeType === 'image/png' ? 'png' : 'jpg';
  const path = `${userId}/face-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, body, { contentType: asset.mimeType ?? 'image/jpeg' });
  if (uploadError) throw uploadError;
  const { error } = await supabase.from('profiles').update({ photo_path: path }).eq('id', userId);
  if (error) throw error;
  if (oldPath && oldPath !== path) await supabase.storage.from(PHOTO_BUCKET).remove([oldPath]);
  return path;
}
