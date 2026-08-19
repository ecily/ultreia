# Ultreia Android foundation

This is the independent Ultreia Android-first technical app. It has no runtime
dependency on StepsMatch.

## Local setup

```bash
npm install
copy .env.example .env
npx expo prebuild --platform android
npm run android
```

Set `EXPO_PUBLIC_API_BASE_URL` to the reachable Ultreia API. The test-build
default is `https://api.ultreia.app/api`. For local emulator work, explicitly
set `ULTREIA_MODE=local` and override it with `http://10.0.2.2:3000/api`; for
a physical phone use the deployed Ultreia API URL. The production EAS profile
sets `ULTREIA_MODE=production` and requires HTTPS.

The Android package is `com.ecily.ultreia`. No StepsMatch Firebase or Google
configuration is used. The native release APK contains the production JS
bundle and does not require Expo Go, Metro or a browser. The own Expo/Firebase
configuration is provisioned outside Git and has been verified with the
standalone release APK. For a local standalone Android build, place the own
`google-services.json` in this directory; it is git-ignored and must never be
copied from StepsMatch. EAS can provide the corresponding own Firebase
credentials through its protected project configuration.

The technical geofence is deliberately offset about 40 m from the current
position with a 25 m radius. This gives the hardware test a reproducible
`technical_test` ENTER after a short walk toward the displayed center.

## Technical proof controls

The first screen exposes explicit actions for device registration, notification
permission, foreground/background location, current location, heartbeat, local
notification, push-token registration, background location and geofence ENTER.
Each action reports a visible result. The protected Production server-push test
is intentionally not an APK action; it is operator-only through the root
command `npm run push:test -- --device <allowlisted-device-id>`. Background
tasks are registered once at module load and use only the Ultreia API.
