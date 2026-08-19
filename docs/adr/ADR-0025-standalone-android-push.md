# ADR-0025: Standalone-Android-App und eigener Push-Kontext

Stand: 2026-08-17

## Entscheidung

Ultreia ist eine eigenständig installierbare Android-App. Expo Go, Metro,
Browser und Emulator sind keine Laufzeitvoraussetzungen. Die Release-APK
enthält ihr Production-JavaScript-Bundle und kommuniziert direkt mit
`https://api.ultreia.app/api`.

Expo bleibt Framework sowie mögliche Build-/Push-Infrastruktur. Für echten
Android-Server-Push werden jedoch ein eigenes Ultreia-Expo-Projekt mit
Project-ID und ein eigener Firebase/FCM-Kontext benötigt. Keine StepsMatch-ID,
kein fremdes `google-services.json` und kein fremdes FCM-Secret werden
übernommen.

## Technischer Ablauf

- Android fordert Notification- und Location-Permissions an.
- Expo Notifications erzeugt mit der eigenen Project-ID einen Push-Token.
- Das Backend registriert den Token, ersetzt alte Tokens pro Gerät und
  deaktiviert `DeviceNotRegistered`-Tokens.
- Der Server-Push-Test bleibt in Production standardmäßig deaktiviert und
  benötigt zusätzlich geschützte Runtime-Konfiguration.
- Lokale Notifications, Background Location und Geofencing funktionieren
  nativ innerhalb der Standalone-App.
- Für Expo SDK 53 muss `expo-asset` als direkte App-Abhängigkeit mit der
  SDK-kompatiblen Version `~11.1.7` geführt werden. Eine nur transitive
  Expo-Abhängigkeit reicht für die Standalone-Autolinking-Auflösung nicht;
  andernfalls kann der Release-Lauf mit `Cannot find native module
  'ExpoAsset'` abbrechen.

## Externe Grenze

Die Expo/EAS-Anmeldung, die eigene Project ID und der eigene Firebase/FCM-
Kontext sind erledigt: Ultreia nutzt den eigenen Account `ecily`, das eigene
Projekt `@ecily/ultreia`, Firebase `ultreia-37602` und FCM v1 für
`com.ecily.ultreia`. Die lokale/native Google-Services-Datei bleibt ignoriert;
EAS/DO-Credentials bleiben außerhalb des Repositories. Der Production-Build
ist mit FCM erfolgreich gebaut, das Testgerät hat Permission-, Token-,
Heartbeat-, lokale Notification- und Geofence-Registrierungsnachweise geliefert.
Offen bleiben die tatsächliche Server-Push-Zustellung, ein Geofence-ENTER nach
physischer Bewegung und die vollständige Feldbestätigung.
