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
override it with `http://10.0.2.2:3000/api`; for a physical phone use the
deployed Ultreia API URL.

The Android package is `com.ecily.ultreia`. No StepsMatch Firebase or Google
configuration is used. Expo/Firebase credentials are required separately before
push-token retrieval can work in a release build.

## Technical proof controls

The first screen exposes explicit actions for device registration, notification
permission, foreground/background location, current location, heartbeat, local
notification, push-token registration, background location and geofence ENTER.
Each action reports a visible result. Background tasks are registered once at
module load and use only the Ultreia API.
