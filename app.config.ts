import type { ConfigContext, ExpoConfig } from 'expo/config';

// APP_VARIANT=staging (set by the "staging" profile in eas.json) builds a separate app that installs next to
// the live one and talks to the jareeye-staging Supabase project. Without it, app.json is used unchanged.
export default ({ config }: ConfigContext): ExpoConfig => {
  const expo = config as ExpoConfig;
  if (process.env.APP_VARIANT !== 'staging') return expo;
  return {
    ...expo,
    name: 'Jareeye Staging',
    scheme: 'jareeye-staging',
    ios: { ...expo.ios, bundleIdentifier: 'so.jareeye.app.staging' },
    android: { ...expo.android, package: 'so.jareeye.app.staging' },
  };
};
