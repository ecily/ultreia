# ADR-0027: Microsoft Graph fuer Production-Magic-Links

## Status

Accepted. Implemented locally; external Microsoft configuration remains
manual before the first real Production-Mailtest.

## Entscheidung

Ultreia verwendet fuer Production-Magic-Links Microsoft Graph mit OAuth 2.0
Client-Credentials und einem eigenen Ultreia-App-Registration-Kontext. Der
Server fordert am Microsoft-Tokenendpoint den Scope
`https://graph.microsoft.com/.default` an und sendet anschliessend eine
multipart/alternative-Mail ueber
`POST /v1.0/users/{MAIL_FROM}/sendMail`.

Die benoetigte Microsoft-Graph-Application-Permission ist `Mail.Send` mit
Admin Consent. Es gibt keinen Browser-, delegated- oder SMTP-Fallback. Der
dedizierte Absender `MAIL_FROM` ist die einzige Mailbox, die Ultreia fuer den
Versand benoetigt; ein Exchange Application-RBAC-Scope kann spaeter als
zusätzliche Tenant-Härtung eingerichtet werden.

## Herkunft und Abgrenzung

Das Muster ist aus der produktiv dokumentierten `ecily.com`-Implementierung
uebernommen: app-only Client-Credentials, `.default`, Graph `sendMail`,
Timeouts und sichere Fehlerklassen. `einfachsparen` verwendet dagegen einen
direkten SMTP-Client mit STARTTLS und AUTH LOGIN/PLAIN; dieser abweichende
Altpfad ist nicht Ultreias Produktionsarchitektur.

Es werden keine App-Registrierungen, Mailboxen, Empfaenger oder Credentials
anderer Projekte wiederverwendet.

## Sicherheits- und Zustellregeln

- Secrets werden nur aus Runtime-Variablen gelesen und nie geloggt.
- Der lokale und automatisierte Testmodus bleibt eine gehashte Diagnose-
  Outbox; dort wird keine echte Microsoft-Mail versendet.
- Production ohne vollstaendige Microsoft-Konfiguration antwortet mit
  `mail_provider_not_configured` und schreibt keinen erfolgreichen Versand.
- Tokenabruf darf bei einem transienten Fehler einmal wiederholt werden.
  Der nicht-idempotente Graph-Mailversand wird nicht blind wiederholt, um
  Doppel-Mails nach einem Timeout zu vermeiden.
- Magic-Link-Mail nutzt DE/EN/ES, Text- und HTML-Teil, eine HTTPS-URL unter
  `https://ultreia.app/auth/verify`, kurze Ablaufzeit und One-Time-Token.
