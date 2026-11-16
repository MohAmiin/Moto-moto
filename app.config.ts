/// <reference types="node" />
// (app.config.ts runs in Node at build time, not in the app.)
import { existsSync } from 'node:fs';
import type { ConfigContext, ExpoConfig } from 'expo/config';

// Firebase for push notifications. The repo is public, so google-services.json isn't in git:
// EAS builds get it from the private file variable GOOGLE_SERVICES_JSON; a local build uses
// the file in the project folder if it's there.
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ?? (existsSync('./google-services.json') ? './google-services.json' : undefined);

export default ({ config }: ConfigContext): ExpoConfig => {
  const expo = config as ExpoConfig;
  return { ...expo, android: { ...expo.android, ...(googleServicesFile ? { googleServicesFile } : {}) } };
};
