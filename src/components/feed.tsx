import { Image, type ImageSource } from 'expo-image';

// The app's own single-colour icons (assets/icons). On iPhone the kit uses SF Symbols and falls back to these.

export const Icons = {
  home: require('@/assets/icons/home.png'),
  user: require('@/assets/icons/user.png'),
  award: require('@/assets/icons/award.png'),
  flame: require('@/assets/icons/flame.png'),
  motorbike: require('@/assets/icons/motorbike.png'),
  star: require('@/assets/icons/star.png'),
  map: require('@/assets/icons/map.png'),
  clock: require('@/assets/icons/clock.png'),
  route: require('@/assets/icons/route.png'),
  phone: require('@/assets/icons/phone.png'),
  locate: require('@/assets/icons/locate.png'),
} as const;

/** A single-colour icon from assets/icons. */
export function Icon({ source, size = 20, color }: { source: ImageSource | number; size?: number; color: string }) {
  return <Image source={source} style={{ width: size, height: size }} tintColor={color} contentFit="contain" />;
}
