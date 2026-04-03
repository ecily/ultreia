import React from "react";
import { Link } from "react-router-dom";

import Navbar from "../components/Navbar";

const sections = [
  {
    title: "1. Welche Technologien werden eingesetzt?",
    text: "Aktuell nur technisch notwendige Speichermechanismen, vor allem Local Storage für Zugang, Sicherheit und stabile Bedienbarkeit.",
    bullets: [
      "Tester-Zugang und NDA-Status",
      "Funktionsrelevante Session-Zustände",
      "Sicherheits- und Routing-Informationen",
    ],
  },
  {
    title: "2. Zweck der Verarbeitung",
    text: "Ausschließlich zur Bereitstellung angeforderter Funktionen wie geschützte Bereiche, korrekte Weiterleitung und zuverlässige Nutzung.",
  },
  {
    title: "3. Analyse- oder Marketing-Cookies",
    text: "Derzeit nicht aktiv. Es werden aktuell keine Analyse- oder Marketing-Cookies gesetzt.",
  },
  {
    title: "4. Speicherdauer und Kontrolle",
    text: "Je nach Zweck bleiben Einträge erhalten, bis sie technisch nicht mehr benötigt werden oder vom Nutzer im Browser gelöscht werden.",
  },
  {
    title: "5. Rechtsgrundlagen",
    text: "Technisch notwendige Speicherzugriffe erfolgen auf Basis der einschlägigen Ausnahmen; nachgelagerte Verarbeitungen richten sich nach geltendem Datenschutzrecht.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="sm-page">
      <div className="sm-stack">
        <Navbar />

        <main className="sm-shell py-10 sm:py-14">
          <section className="sm-card-soft p-7 sm:p-9 sm-rise">
            <h1 className="sm-section-title">Datenschutz und Cookie-Hinweise</h1>
            <p className="sm-section-copy">
              Transparente Informationen zur aktuellen Verarbeitung technischer Daten auf
              der Ultreia-Plattform.
            </p>
          </section>

          <section className="mt-6 grid gap-4">
            {sections.map((section, idx) => (
              <article key={section.title} className={`sm-card p-6 sm-rise sm-delay-${Math.min(idx + 1, 3)}`}>
                <h2 className="text-xl font-bold sm:text-2xl">{section.title}</h2>
                <p className="mt-2 text-slate-700">{section.text}</p>
                {Array.isArray(section.bullets) ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-700">
                    {section.bullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </section>

          <section className="mt-8 sm-card-strong p-7 sm:p-9 sm-rise sm-delay-2">
            <h3 className="text-2xl font-extrabold sm:text-3xl">Hinweis</h3>
            <p className="mt-3 max-w-3xl text-blue-50">
              Diese Seite dient der transparenten Information und ersetzt keine individuelle
              Rechtsberatung.
            </p>
            <div className="mt-6">
              <Link to="/home" className="sm-btn-secondary">
                Zurück zur Startseite
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
