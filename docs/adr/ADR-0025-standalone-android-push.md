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

Die Expo/EAS-Anmeldung, die eigene Project ID und der eigene Firebase/FCM-
Kontext sind erledigt: Ultreia nutzt den eigenen Account `ecily`, das eigene
Projekt `@ecily/ultreia`, Firebase `ultreia-37602` und FCM v1 für
`com.ecily.ultreia`. Die lokale/native Google-Services-Datei bleibt ignoriert;
EAS/DO-Credentials bleiben außerhalb des Repositories. Der Production-Build
ist mit FCM erfolgreich gebaut, der Server-Push-Test ist live aktiviert und
geschützt. Offen bleibt ausschließlich der physische Android-Hardwarebeweis
für Token, tatsächliche Zustellung, Background Location und Geofence-ENTER.
