import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, Clock3, Radar } from "lucide-react";

import Navbar from "../components/Navbar";
import logoIcon from "../assets/stepsmatch-icon.svg";

const pillars = [
  {
    icon: <Radar className="h-5 w-5 text-blue-700" />,
    title: "Kontext statt Zufall",
    text: "Anbieter definieren Radius, Kategorie und Zeitfenster. Dadurch wird Relevanz steuerbar.",
  },
  {
    icon: <BadgeCheck className="h-5 w-5 text-blue-700" />,
    title: "Interessen statt Overload",
    text: "User wählen bewusst ihre Themen und bekommen nur passende Hinweise.",
  },
  {
    icon: <Clock3 className="h-5 w-5 text-blue-700" />,
    title: "Timing statt Suchstress",
    text: "Push wird nur ausgelöst, wenn Ort, Zeit und Interesse gleichzeitig passen.",
  },
];

export default function WhyStepsMatch() {
  return (
    <div className="sm-page">
      <div className="sm-stack">
        <Navbar />

        <section className="sm-shell py-10 sm:py-14 lg:py-16">
          <div className="sm-card-soft p-7 sm:p-10 sm-rise">
            <p className="sm-badge">
              <img src={logoIcon} alt="StepsMatch" className="h-4 w-4" />
              Warum StepsMatch neu ist
            </p>
            <h1 className="sm-hero-title mt-5 max-w-4xl text-[clamp(2.2rem,6vw,4.5rem)]">
              Relevanz im richtigen Moment.
              <br />
              Nicht im falschen Feed.
            </h1>
            <p className="sm-section-copy max-w-4xl">
              StepsMatch verschiebt den Fokus von permanenter Suche auf situative Relevanz.
              Das Produkt arbeitet mit Kontextsignalen statt mit Aufmerksamkeitsschleifen.
            </p>
          </div>
        </section>

        <section className="sm-shell pb-12">
          <div className="grid gap-4 md:grid-cols-3">
            {pillars.map((pillar, idx) => (
              <article key={pillar.title} className={`sm-card p-6 sm-rise sm-delay-${Math.min(idx + 1, 3)}`}>
                <div className="mb-3 inline-flex rounded-xl border border-blue-200 bg-blue-50 p-2">{pillar.icon}</div>
                <h2 className="text-xl font-bold">{pillar.title}</h2>
                <p className="mt-2 text-slate-700">{pillar.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="sm-shell pb-16 sm:pb-20">
          <div className="sm-card-strong p-8 sm:p-10 sm-rise sm-delay-2">
            <h3 className="text-3xl font-extrabold sm:text-4xl">Der Nutzen ist auf beiden Seiten sofort spürbar</h3>
            <p className="mt-3 max-w-3xl text-blue-50 sm:text-lg">
              User erhalten präzise Hinweise ohne Noise. Anbieter erreichen Menschen genau
              im relevanten Radius und Zeitfenster.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/register" className="sm-btn-secondary gap-2">
                Als Anbieter starten <ArrowRight size={16} />
              </Link>
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
