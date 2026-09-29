import { Linking } from 'react-native';

import { logCall, telUrl } from './call-log';

/**
 * Calls a rider. iPhones always show their own "Call +252…?" confirmation first, which apps can't skip;
 * the Android version (call.android.ts) starts ringing straight away.
 */
export async function callRider(riderId: string, phone: string) {
  logCall(riderId);
  await Linking.openURL(telUrl(phone));
}
