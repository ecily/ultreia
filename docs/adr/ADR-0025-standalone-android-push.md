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

## Externe Grenze

Die Expo/EAS-Anmeldung und die eigene Project-ID/FCM-Konfiguration sind noch
offen. Danach kann der Production-Build mit geschützten eigenen Credentials
neu gebaut und der echte Server-Push getestet werden.
