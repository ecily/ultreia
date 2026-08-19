# ADR-0024: DigitalOcean App-Platform-Kostenobergrenze

Stand: 2026-08-17

## Entscheidung

Ultreia verwendet für den technischen MVP genau eine DigitalOcean-App-
Platform-Service-Instance mit `apps-s-1vcpu-0.5gb`.

- erwartete fixe Basiskosten: 5 USD/Monat
- `instance_count: 1`
- kein Autoscaling
- keine DigitalOcean Managed Database
- MongoDB bleibt extern bei Atlas

Eine teurere Größe oder kostenpflichtige Zusatzkomponente wird nicht
automatisch gewählt. Vor dem ersten kostenpflichtigen Deploy müssen die
aktuelle Verfügbarkeit und die Kosten über die DO-API bestätigt werden.

## Nachweis

Die aktuelle DigitalOcean-Preisdokumentation führt `apps-s-1vcpu-0.5gb` mit
512 MiB, 1 shared CPU, 5 USD/Monat und ohne manuelles oder automatisches
Scaling. Die Repo-Spezifikation verwendet diese Größe.

Die App wurde mit genau dieser Größen- und Instance-Grenze provisioniert. Die
Kostenentscheidung bleibt auf eine Instance ohne Autoscaling und ohne Managed
Database begrenzt; Änderungen benötigen eine neue bewusste Prüfung.
