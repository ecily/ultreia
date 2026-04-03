import { Platform, Linking } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';

function pkg() {
  // fallback auf dein Paketnamen, falls expoConfig zur Laufzeit nicht befüllt ist
  return (Constants?.expoConfig as any)?.android?.package || 'com.ecily.mobile';
}

// App-Details (alle Berechtigungen)
export async function openAppDetailsSettings() {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
      { data: `package:${pkg()}` }
    );
  } catch {
    await Linking.openSettings();
  }
}

// Systemseite: Akku-Optimierung (global)
export async function openBatteryOptimizationList() {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS' as any);
  } catch {
    await openAppDetailsSettings();
  }
}

// Direkter Dialog: "Von Akku-Optimierung ausnehmen" für deine App
export async function requestIgnoreBatteryOptimizations() {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync('android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS' as any, {
      data: `package:${pkg()}`
    });
  } catch {
    await openBatteryOptimizationList();
  }
}

export async function openNotificationSettings() {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync('android.settings.APP_NOTIFICATION_SETTINGS' as any, {
      extra: { app_package: pkg() }
    });
  } catch {
    await openAppDetailsSettings();
  }
}

export async function openLocationPermissionSettings() {
  if (Platform.OS !== 'android') return;
  try {
    // Android 11+: direkter Standort-Dialog der App
    await IntentLauncher.startActivityAsync('android.settings.APPLICATION_DETAILS_SETTINGS' as any, {
      data: `package:${pkg()}`
    });
  } catch {
    await openAppDetailsSettings();
  }
}
