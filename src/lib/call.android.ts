import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, PermissionsAndroid } from 'react-native';

import { logCall, telUrl } from './call-log';

/**
 * Calls a rider and starts ringing straight away. Android asks once for permission to make phone calls;
 * if it's refused (or the phone can't place calls), the dialler opens with the number instead.
 */
export async function callRider(riderId: string, phone: string) {
  logCall(riderId);
  try {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CALL_PHONE);
    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
      await IntentLauncher.startActivityAsync('android.intent.action.CALL', { data: telUrl(phone) });
      return;
    }
  } catch {
    // Fall through to the dialler.
  }
  await Linking.openURL(telUrl(phone));
}
