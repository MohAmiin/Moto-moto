import { Image } from 'expo-image';

import { Monogram } from '@/components/ui';
import { riderPhotoUrl } from '@/lib/rider';

/** The driver's face photo, or their initials until they add one. `round` makes it a circle. */
export function RiderAvatar({
  name,
  photoPath,
  size = 52,
  round = false,
}: {
  name: string;
  photoPath: string | null | undefined;
  size?: number;
  round?: boolean;
}) {
  const url = riderPhotoUrl(photoPath);
  const radius = round ? size / 2 : size * 0.28;
  if (!url) return <Monogram name={name} size={size} radius={radius} />;
  return (
    <Image
      source={{ uri: url }}
      style={{ width: size, height: size, borderRadius: radius }}
      contentFit="cover"
      accessibilityLabel={name}
      transition={150}
    />
  );
}
