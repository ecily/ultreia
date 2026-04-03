import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Building2, Gauge, Target } from "lucide-react";

import Navbar from "../components/Navbar";

const blocks = [
  {
    icon: <Target className="h-5 w-5 text-blue-700" />,
    title: "Problem",
    text: "Lokale Werbung trifft den Kontext oft nicht und erzeugt hohen Streuverlust.",
  },
  {
    icon: <Gauge className="h-5 w-5 text-blue-700" />,
    title: "Lösung",
    text: "Realtime-Matching über Ort, Zeit und Interesse mit zuverlässigem Push-Trigger.",
  },
  {
    icon: <Building2 className="h-5 w-5 text-blue-700" />,
    title: "Business-Impact",
    text: "Mehr relevante Kontakte für Anbieter, bessere Conversion und weniger Suchaufwand für Nutzer.",
  },
];

const investorSignals = [
  "Technischer USP: Background-Matching mit Geofence + Heartbeat auch bei geschlossener App",
  "Beidseitiger Netzwerkeffekt: mehr Anbieter erhöhen Nutzwert für User und umgekehrt",
  "Klare Monetarisierung: lokale Sichtbarkeit als messbarer Performance-Channel",
  "MVP-ready Operations: Anbieter-Dashboard, Radiussteuerung, Zeitfenster-Logik, Admin-Karte",
];

const competitiveLens = [
  {
    app: "Google Maps / Local Discovery",
    strength: "Hohe Reichweite und starke Kartennutzung",
    gap: "Keine fokussierte Interessen- und Angebotslogik für lokale Echtzeit-Trigger",
  },
  {
    app: "Groupon / Deal-Portale",
    strength: "Deal-Dichte und bekannte Angebotsmechanik",
    gap: "Primär Pull-basiert, wenig Kontext über aktuellen Laufweg",
  },
  {
    app: "Delivery-Apps / Nearby Feeds",
    strength: "Hohe Nutzung im konkreten Bestellmoment",
    gap: "Angebote selten kontextgetrieben auf Geh-Nähe + Zeitfenster + Interessen",
  },
];

export default function Pitch() {
  return (
    <div className="sm-page">
      <div className="sm-stack">
        <Navbar />

        <section className="sm-shell py-10 sm:py-14">
          <div className="sm-card-soft p-7 sm:p-10 sm-rise">
            <p className="sm-badge">Investor Summary</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
              Ultreia baut die Infrastruktur
              <br />
              für Zero-Search im Alltag.
            </h1>
            <p className="sm-section-copy max-w-4xl">
              Die Plattform monetarisiert Relevanz im Moment: statt Reichweite um jeden
              Preis entsteht ein präziser Match zwischen lokalen Angeboten und realem Bedarf.
            </p>
          </div>
        </section>

        <section className="sm-shell pb-12">
          <div className="grid gap-4 md:grid-cols-3">
            {blocks.map((block, idx) => (
              <article key={block.title} className={`sm-card p-6 sm-rise sm-delay-${Math.min(idx + 1, 3)}`}>
                <div className="mb-3 inline-flex rounded-xl border border-blue-200 bg-blue-50 p-2">{block.icon}</div>
                <h2 className="text-xl font-bold">{block.title}</h2>
                <p className="mt-2 text-slate-700">{block.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="sm-shell pb-12">
          <div className="sm-card p-6 sm:p-8 sm-rise sm-delay-1">
            <h2 className="text-2xl font-extrabold sm:text-3xl">Competitive Lens</h2>
            <p className="mt-2 text-slate-600">
              Ultreia adressiert nicht "noch mehr Reichweite", sondern den präzisen Moment der Relevanz.
            </p>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-4 font-semibold">Kategorie</th>
                    <th className="py-2 pr-4 font-semibold">Stärke</th>
                    <th className="py-2 font-semibold">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {competitiveLens.map((row) => (
                    <tr key={row.app} className="border-b border-slate-100 align-top">
                      <td className="py-3 pr-4 font-semibold text-slate-800">{row.app}</td>
                      <td className="py-3 pr-4 text-slate-700">{row.strength}</td>
                      <td className="py-3 text-slate-700">{row.gap}</td>
                    </tr>
                  ))}
                  <tr className="align-top">
                    <td className="py-3 pr-4 font-semibold text-blue-800">Ultreia</td>
                    <td className="py-3 pr-4 text-slate-700">Ort + Zeit + Interesse als Trigger im echten Kontext</td>
                    <td className="py-3 text-slate-700">Skalierung über regionale Angebotsdichte und Partneraufbau</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="sm-shell pb-12">
          <div className="grid gap-4 md:grid-cols-2">
            {investorSignals.map((item, idx) => (
              <article key={item} className={`sm-card-soft p-6 sm-rise sm-delay-${Math.min(idx + 1, 3)}`}>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-blue-700">Signal {idx + 1}</p>
                <p className="mt-2 text-slate-800">{item}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="sm-shell pb-16 sm:pb-20">
          <div className="sm-card-strong p-8 sm:p-10 sm-rise sm-delay-2">
            <h3 className="text-3xl font-extrabold sm:text-4xl">Lokale Nachfrage in Echtzeit ist ein klarer Category-Fit</h3>
            <p className="mt-3 max-w-3xl text-blue-50 sm:text-lg">
              Ultreia verbindet Angebotsdichte, Laufwege und persönliche Präferenzen
              zu einem Live-Marketplace mit hoher operativer Präzision.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="mailto:hello@ultreia.app" className="sm-btn-secondary gap-2">
                Investor Kontakt <ArrowUpRight size={16} />
              </a>
              <Link to="/home" className="sm-btn-ghost">
                Zur Landing
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
