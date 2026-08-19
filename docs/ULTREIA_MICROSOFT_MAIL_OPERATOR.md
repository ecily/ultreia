# Ultreia Microsoft-Mail: Operator-Block

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

## Noch notwendige Microsoft-Schritte

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
   Eine eigene Ultreia-Absender-Mailbox anlegen oder eine bereits vorhandene
   Ultreia-Mailbox bestätigen. Empfohlene V1-Adresse:
   `noreply@ultreia.app`. Sie darf erst verwendet werden, wenn sie im Tenant
   tatsächlich existiert und senden darf. Ergebnis: `MAIL_FROM`.

5. Optional als zusätzliche Tenant-Härtung: Exchange Online Application RBAC
   kann die App auf genau diese Mailbox begrenzen. Microsoft beschreibt dafür
   `New-ServicePrincipal`, eine Mailbox-Management-Scope, die Rolle
   `Application Mail.Send`, `New-ManagementRoleAssignment` und
   `Test-ServicePrincipalAuthorization`. Dieses bestehende ecily-Muster nutzt
   diese Zusatzgrenze nicht; sie wird daher nicht automatisch eingerichtet.

6. Hinterlege danach in DigitalOcean App Platform → `ultreia-backend` →
   **Settings / App-Level Environment Variables** die Werte unter **Runtime**:

   - `MICROSOFT_TENANT_ID` → Directory (tenant) ID aus Schritt 1
   - `MICROSOFT_CLIENT_ID` → Application (client) ID aus Schritt 1
   - `MICROSOFT_CLIENT_SECRET` → Secret-Value aus Schritt 3
   - `MAIL_FROM` → bestätigte Mailbox aus Schritt 4

   `MAIL_PROVIDER=microsoft` und der Timeout sind im Ultreia-Deployment bereits
   als nicht-geheime Runtime-Konfiguration vorbereitet. Bis die vier Werte
   gesetzt sind, bleibt Production absichtlich fail-closed.

## Danach

Nach dem Speichern der vier Runtime-Werte kann Ultreia den DO-Deploy abwarten,
den Tokenabruf und Graph-`202` technisch prüfen und anschließend einen echten
Provider- und Admin-Magic-Link-End-to-End-Test durchführen. Die Mailzustellung
ist bis dahin nicht bewiesen und wird nicht vorgetäuscht.

Primärreferenzen:

- <https://learn.microsoft.com/en-us/graph/auth-v2-service>
- <https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0>
- <https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac>
