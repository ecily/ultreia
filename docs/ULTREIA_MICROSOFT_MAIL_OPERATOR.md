# Ultreia Microsoft-Mail: Operator-Block

Status: Production eingerichtet und live verifiziert, Stand 2026-08-28.

Die eigene Microsoft-App-Konfiguration und eine dedizierte Ultreia-
Absendermailbox sind als geschützte DigitalOcean-Runtimewerte eingerichtet.
Mehrere Production-Magic-Link-Requests lieferten HTTP 200; die zugehörigen
Backend-Events belegen Microsoft Graph `sendMail` mit Upstream HTTP 202. Der
konkrete `MAIL_FROM`-Wert und alle übrigen Runtimewerte werden bewusst nicht im
Repository dokumentiert.

## Bewährtes Muster

`ecily.com` verwendet produktiv Microsoft Graph mit OAuth 2.0
Client-Credentials. Der Backend-Service ruft mit
`https://graph.microsoft.com/.default` ein app-only Token ab und sendet per
`POST /v1.0/users/{sender}/sendMail`. Die App besitzt die Graph-Application-
Permission `Mail.Send` und Admin Consent. SMTP ist dort verworfen.

`einfachsparen` ist ein anderer, direkter SMTP-/STARTTLS-/AUTH-LOGIN- bzw.
AUTH-PLAIN-Pfad. Er ist technisch gelesen, aber nicht die ausgewählte
Ultreia-Variante.

## Ultreia-Runtime

Production verwendet ausschließlich diese Werte:

```text
MAIL_PROVIDER=microsoft
MICROSOFT_TENANT_ID=<eigene Ultreia-Tenant-ID>
MICROSOFT_CLIENT_ID=<eigene Ultreia-App-ID>
MICROSOFT_CLIENT_SECRET=<neuer Ultreia-Client-Secretwert>
MAIL_FROM=<eigene Ultreia-Mailbox>
MICROSOFT_GRAPH_TIMEOUT_MS=10000
```

Die vier konfigurationsabhängigen Werte werden ausschließlich als Runtime-
Variablen der DigitalOcean-App `ultreia-backend` unter `RUN_TIME` hinterlegt.
Kein Wert gehört in Git, lokale Doku oder Chat.

## Einrichtungsreferenz und Wiederherstellung

Die folgenden Schritte dokumentieren die bereits umgesetzte Einrichtung und
dienen nur für Wiederherstellung oder Rotation. Sie sind keine aktuelle
To-do-Liste.

1. Öffne den Microsoft-Entra-Adminbereich:
   <https://entra.microsoft.com/> → **Identity** → **Applications** → **App
   registrations** → **New registration**. Lege eine eigene Single-Tenant-App
   mit dem exakten Namen `Ultreia Production Mail` an. Es ist kein Redirect
   URI nötig, weil Ultreia app-only und ohne Benutzerinteraktion arbeitet.
   Ergebnis: `Application (client) ID` und `Directory (tenant) ID`.

2. Öffne in dieser App **API permissions** → **Add a permission** →
   **Microsoft Graph** → **Application permissions** → `Mail.Send` → **Add
   permissions**. Danach **Grant admin consent** fuer den Tenant bestätigen.
   Ergebnis: die app-only `Mail.Send`-Berechtigung ist wirksam.

3. Öffne **Certificates & secrets** → **New client secret**. Verwende die
   Beschreibung `Ultreia Production Mail` und eine kurze, organisatorisch
   rotationsfähige Laufzeit. Den Secret-**Value** einmal sicher kopieren.
   Ergebnis: `MICROSOFT_CLIENT_SECRET`.

4. Öffne das Exchange Admin Center:
   <https://admin.exchange.microsoft.com/> → **Recipients** → **Mailboxes**.
   Eine eigene Ultreia-Absendermailbox anlegen oder die vorhandene Runtime-
   Mailbox bestätigen. `noreply@ultreia.app` war eine frühe Empfehlung, ist
   aber in dieser Dokumentation nicht als aktueller Runtimewert bestätigt.
   Ergebnis: `MAIL_FROM`.

5. Optional als zusätzliche Tenant-Härtung: Exchange Online Application RBAC
   kann die App auf genau diese Mailbox begrenzen. Microsoft beschreibt dafür
   `New-ServicePrincipal`, eine Mailbox-Management-Scope, die Rolle
   `Application Mail.Send`, `New-ManagementRoleAssignment` und
   `Test-ServicePrincipalAuthorization`. Dieses bestehende ecily-Muster nutzt
   diese Zusatzgrenze nicht; sie wird daher nicht automatisch eingerichtet.

6. Hinterlege beziehungsweise rotiere danach in DigitalOcean App Platform → `ultreia-backend` →
   **Settings / App-Level Environment Variables** die Werte unter **Runtime**:

   - `MICROSOFT_TENANT_ID` → Directory (tenant) ID aus Schritt 1
   - `MICROSOFT_CLIENT_ID` → Application (client) ID aus Schritt 1
   - `MICROSOFT_CLIENT_SECRET` → Secret-Value aus Schritt 3
   - `MAIL_FROM` → bestätigte Mailbox aus Schritt 4

   `MAIL_PROVIDER=microsoft` und der Timeout sind im Ultreia-Deployment als
   nicht-geheime Runtime-Konfiguration gesetzt. Fehlt einer der notwendigen
   Werte nach einer Rotation, bleibt Production absichtlich fail-closed.

## Aktueller Nachweis und offene Härtung

Graph-Tokenabruf und `sendMail` HTTP 202 sind live serverseitig nachgewiesen.
Provider- und Admin-Requests für den autorisierten Multi-Role-Account wurden
wiederholt akzeptiert. Das Öffnen eines konkreten One-Time-Links und der
anschließende Browserzustand bleiben ein interaktiver Nutzerbeweis und werden
nicht aus dem Versandlog abgeleitet.

Optional offen bleibt eine zusätzliche Exchange-Application-RBAC-Begrenzung
auf genau die verwendete Absendermailbox sowie die organisatorische Rotation
der Runtime-Credentials. Ein Absenderwechsel ist nur nach Bestätigung der neuen
Mailbox und erneutem Live-Nachweis zulässig.

Primärreferenzen:

- <https://learn.microsoft.com/en-us/graph/auth-v2-service>
- <https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0>
- <https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac>

## TEMPORÄR deaktiviert: neue Magic-Link-Requests (2026-09-13)

Grund: Schutz vor unerwünschter/missbräuchlicher Nutzung während Entwicklung.
`MAGIC_LINK_ENABLED=false` ist der sichere Default und wird als Runtimevariable
am bestehenden DigitalOcean-Service `api` der App `ultreia-backend` gesetzt.
Die bisherigen Graph-202-Nachweise beschreiben den Stand vor der Abschaltung.
Keine Mailcredentials entfernen oder rotieren, keine Sessions oder Links löschen.

Reaktivierung: Runtimevariable `MAGIC_LINK_ENABLED=true` setzen und Backend
redeployen. Dabei auch das Deploymentmanifest bewusst angleichen, damit ein
späteres Anwenden nicht versehentlich wieder deaktiviert. Kein Code-Rückbau und
kein Frontend-Rebuild nötig; Loginseite nach Reaktivierung neu laden. Für lokale
Auth-Tests explizit `magicLinkEnabled: true` beziehungsweise
`MAGIC_LINK_ENABLED=true` verwenden. Standard bleibt global aus, auch local_test.

Bei deaktivierter Anforderung: HTTP 403, stabiler Status
`magic_link_temporarily_disabled`, keine Accountsuche/-Anlage, kein Token,
kein Magic-Link-Datensatz, kein Graph-Tokenabruf und kein sendMail. Bereits
versendete Links bleiben bis TTL einmal verifizierbar. Bestehende Sessions,
Refresh, Logout, Rollen und Scopes bleiben unverändert.

Sichere strukturierte Blockierlogs: `event=magic_link_request_blocked`, timestamp,
validierte role (sonst unspecified), `status=disabled`; keine E-Mail, IP oder Tokens.
Das bisherige aktive Request-Limit beträgt 8 pro 60 Sekunden und Verbindungs-IP
(pro Prozess). Express konfiguriert kein trust proxy; hinter einem Proxy kann
sich das Limit daher auf die Proxy-IP beziehen. Ein separates E-Mail-Limit fehlt.
Diese Grenzen werden hier nicht umgebaut. Die Abschaltung läuft vor dem Limiter,
damit jeder blockierte Request denselben 403-Status erhält und kein Limiter als
Sicherheitsvoraussetzung dient. Ein zukünftiger Ausbau sollte die vertrauenswürdige
Proxykette und ein datensparsames E-Mail-Limit ausdrücklich prüfen.

Live-Besonderheit der App Platform: HTTP 503 aus dem Backend wurde am
2026-09-13 von der vorgeschalteten Plattform in eine generische HTML-Fehlerseite
mit HTTP 504 umgewandelt. Die temporäre Sperre verwendet deshalb HTTP 403 mit
dem unveränderten JSON-Status `magic_link_temporarily_disabled`, damit Webclients
die lokalisierte Meldung zuverlässig anzeigen können. Die Sicherheitswirkung
und Reaktivierung bleiben gleich.
