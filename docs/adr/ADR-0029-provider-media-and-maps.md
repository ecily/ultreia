# ADR-0029: Provider-Medien und Standortkarte

## Status

Accepted — 2026-08-21

## Entscheidung

Provider-Offers koennen bis zu drei Fotos erhalten. Uploads werden als
serverseitig validierte Multipart-Daten an Cloudinary uebergeben. Ultreia
speichert pro Foto nur `publicId`, `secureUrl`, `width`, `height`, `format`,
optionale `bytes`, `sortOrder` und `createdAt`. Der Pfad wird aus Scope,
Provider und Offer gebildet; Upload, Loeschen und Reorder pruefen Eigentum und
Scope. Es gibt keine Base64- oder lokale Dateiablage.

Die Browserkarte wird mit Google Maps JavaScript API geladen. Der Browser-Key
ist vom serverseitigen `GOOGLE_PLACES_API_KEY` getrennt und muss in Google Cloud
auf Maps JavaScript API sowie die Ultreia-Weborigins eingeschraenkt werden.
Der Server liefert ihn nur nach Provider-Authentifizierung. Die Place-Daten
bleiben die Referenz; eine optionale Marker-Korrektur ist auf 25 Meter
begrenzt. Die Routes API ist ausserhalb dieses V1-Funktionsumfangs.

## Konsequenzen

- Cloudinary ist eine externe Runtime-Abhaengigkeit; ohne eigene Ultreia-
  Credentials wird der Upload mit einer kontrollierten Konfigurationsmeldung
  abgelehnt.
- Ein gemeinsames Cloudinary-Konto kann durch den logischen Pfad getrennt
  werden, bietet aber keine Ordner-ACL. Fuer strengere organisatorische
  Trennung sind ein eigenes Konto oder dedizierte externe Credentials zu
  verwenden; StepsMatch-Credentials werden nicht uebernommen.
- Der Browser-Key ist technisch sichtbar und deshalb zwingend per Referrer,
  API- und Origin-Regeln zu begrenzen. Ein Secret wird nicht in die APK oder
  in Server-Places-Anfragen eingebettet.
