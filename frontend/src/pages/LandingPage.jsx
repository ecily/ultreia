import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Helmet } from "@dr.pogodin/react-helmet";
import { QRCodeCanvas } from "qrcode.react";
import { ArrowRight, CheckCircle2, Download, Sparkles } from "lucide-react";

import Navbar from "../components/Navbar";
import logoIcon from "../assets/ultreia-icon.svg";
import heroCity from "../assets/hero-city-daylight.jpg";
import previewImage from "../assets/navigation-preview.png";

function ApkModal({ open, onClose, apkUrl, onDontShowAgain }) {
  if (!open) return null;
  const qrValue = `${apkUrl}${apkUrl.includes("?") ? "&" : "?"}src=qr`;

  return (
    <div className="fixed inset-0 z-[120] grid place-items-end bg-slate-900/60 p-3 sm:place-items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="sm-card w-full max-w-xl p-6 sm:p-8 sm-rise">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="sm-badge">
              <Sparkles size={14} /> App-Test starten
            </p>
            <h3 className="mt-3 text-2xl font-extrabold">In unter 1 Minute live</h3>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              QR-Code scannen oder APK direkt laden. Danach kannst du die komplette
              Ultreia-MVP-Strecke sofort testen.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Schliessen
          </button>
        </div>

        <div className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="mx-auto rounded-2xl border border-slate-200 bg-white p-3 sm:mx-0">
            <QRCodeCanvas value={qrValue} size={180} includeMargin level="M" />
          </div>
          <div>
            <p className="text-sm text-slate-600">Option A: Kamera oeffnen und QR scannen</p>
            <a href={apkUrl} className="sm-btn-primary mt-3 !w-full gap-2 sm:!w-auto" target="_blank" rel="noreferrer">
              <Download size={16} /> APK direkt laden
            </a>
            <p className="mt-3 text-xs text-slate-500">Android: Installation aus dieser Quelle einmal erlauben.</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={onDontShowAgain} className="text-sm font-semibold text-slate-600 underline-offset-4 hover:underline">
            Nicht mehr anzeigen
          </button>
          <button type="button" onClick={onClose} className="sm-btn-secondary">
            Weiter zur Landing
          </button>
        </div>
      </div>
    </div>
  );
}

const steps = [
  {
    title: "Anbieter veroeffentlicht ein Angebot",
    text: "Mit Radius, Kategorie und Zeitfenster fuer einen klaren Nutzungskontext.",
  },
  {
    title: "User setzt Interessen",
    text: "Nur relevante Themen aktivieren. Kein permanentes Suchen und kein Feed-Laerm.",
  },
  {
    title: "Match im richtigen Moment",
    text: "Wenn Ort, Zeit und Interesse passen, kommt der Push sofort auf das Geraet.",
  },
];

const useCases = [
  "Feierabend: Restegerichte in direkter Naehe ohne aktives Suchen.",
  "Apotheke/Trafik: Erinnerung exakt beim Vorbeigehen.",
  "Sales: Nur echte Angebote in deinem Interessenprofil.",
  "Happy Hour: Hinweise dann, wenn du ohnehin unterwegs bist.",
  "Neu in der Gegend: lokale Angebote ohne Rechercheaufwand.",
  "Nebenstrassen-Laeden: Sichtbarkeit im richtigen Radius.",
  "Jobs in Gehweite: sofortige Hinweise bei passendem Profil.",
  "Singles/Events: kontextbezogene Treffer statt Spam.",
  "Pilger-/Routenfaelle: relevante Stops entlang des Weges.",
];

const mvpPoints = [
  "Hintergrundsuche laeuft zuverlaessig auch bei geschlossener App",
  "Push-Ausloesung exakt beim Eintritt in ein gueltiges Angebot",
  "Interessenfilter reduziert Rauschen auf wirklich passende Treffer",
  "Anbieter-Dashboard mit Angebotsverwaltung und Radiussteuerung",
];

export default function LandingPage() {
  const location = useLocation();
  const [heroOk, setHeroOk] = React.useState(true);
  const [previewOk, setPreviewOk] = React.useState(true);
  const [apkOpen, setApkOpen] = React.useState(false);

  const title = "Ultreia | finden. nicht suchen.";
  const description =
    "Finden. Nicht suchen. Ultreia zeigt dir passende Angebote genau dann, wenn du wirklich in der Naehe bist und macht den Weg dorthin sofort einfach.";
  const url = "https://www.ultreia.app/";

  const APK_REDIRECT_URL = "https://www.ultreia.app/apk";

  React.useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const fromQuery = params.get("apk") === "1";
      const ndaAcceptedAt = localStorage.getItem("ndaAcceptedAt");
      const modalSeen = localStorage.getItem("apkModalSeen") === "1";

      if (fromQuery) {
        setApkOpen(true);
        params.delete("apk");
        const newSearch = params.toString();
        const newUrl = `${location.pathname}${newSearch ? `?${newSearch}` : ""}${location.hash || ""}`;
        window.history.replaceState({}, "", newUrl);
        return;
      }

      if (ndaAcceptedAt && !modalSeen) setApkOpen(true);
    } catch (e) {
      void e;
    }
  }, [location.pathname, location.search, location.hash]);

  return (
    <div className="sm-page">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
      </Helmet>

      <div className="sm-stack">
        <Navbar />

        <header className="sm-shell py-10 sm:py-14 lg:py-20">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <section className="sm-rise">
              <p className="sm-badge">
                <img src={logoIcon} alt="Ultreia Icon" className="h-4 w-4" />
                MVP-Plattform fuer lokale Relevanz
              </p>

              <h1 className="sm-hero-title mt-5">
                finden.
                <br />
                nicht suchen.
              </h1>

              <p className="mt-5 max-w-2xl text-base text-slate-700 sm:text-xl">
                Du musst nicht mehr suchen: Ultreia sagt dir Bescheid, wenn in
                deiner Naehe gerade etwas wirklich Passendes verfuegbar ist. Ein
                Tipp, ein Klick, losgehen. So hilft die App im Alltag ganz konkret.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <button onClick={() => setApkOpen(true)} className="sm-btn-primary gap-2">
                  App testen <ArrowRight size={16} />
                </button>
                <Link to="/register" className="sm-btn-secondary">
                  Als Anbieter starten
                </Link>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {[
                  ["Du sparst Zeit", "Keine Suche, nur passende Hinweise"],
                  ["Du verpasst weniger", "Hinweise genau im richtigen Moment"],
                  ["Du kommst direkt hin", "Angebot oeffnen und Route starten"],
                ].map(([label, sub]) => (
                  <div key={label} className="sm-card-soft p-4">
                    <p className="text-lg font-bold">{label}</p>
                    <p className="mt-1 text-sm text-slate-600">{sub}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="sm-card overflow-hidden sm-rise sm-delay-1">
              {heroOk ? (
                <img
                  src={heroCity}
                  alt="Staedtische Umgebung als Ultreia-Nutzungsszenario"
                  className="h-[420px] w-full object-cover sm:h-[500px]"
                  onError={() => setHeroOk(false)}
                />
              ) : (
                <div className="h-[420px] w-full bg-gradient-to-br from-blue-100 via-cyan-50 to-emerald-100 sm:h-[500px]" />
              )}
            </section>
          </div>
        </header>

        <section className="sm-shell py-5 sm:py-8">
          <div className="sm-card-soft p-7 sm:p-9 sm-rise sm-delay-1">
            <h2 className="sm-section-title">Warum das im Alltag hilft</h2>
            <p className="sm-section-copy">
              Anbieter pflegen ihre Angebote einmal sauber ein. Du legst nur deine
              Interessen fest. Danach arbeitet Ultreia im Hintergrund und informiert
              dich verlaesslich dann, wenn ein Angebot wirklich zu deinem Weg passt.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {mvpPoints.map((item) => (
                <div key={item} className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                  <span className="text-sm text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sm-shell py-5 sm:py-8">
          <h2 className="sm-section-title sm-rise">So funktioniert der Flow</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {steps.map((step, i) => (
              <article key={step.title} className={`sm-card-soft p-6 sm-rise sm-delay-${Math.min(i + 1, 3)}`}>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-blue-700">Schritt {i + 1}</p>
                <h3 className="mt-2 text-xl font-bold">{step.title}</h3>
                <p className="mt-2 text-slate-700">{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="sm-shell py-5 sm:py-8">
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <article className="sm-card p-6 sm:p-8 sm-rise">
              <h2 className="sm-section-title">Alltagsszenarien mit echtem Nutzen</h2>
              <p className="sm-section-copy">
                Die Relevanz entsteht aus deinem Weg, nicht aus manuellem Suchen.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {useCases.map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </article>

            <article className="sm-card-soft p-5 sm:p-6 sm-rise sm-delay-1">
              <p className="sm-badge">Produktvorschau</p>
              <h3 className="mt-3 text-2xl font-extrabold">Von der Info bis zum Ziel in einem Flow</h3>
              <p className="mt-2 text-sm text-slate-600">
                Du bekommst einen passenden Hinweis, oeffnest das Angebot und startest
                direkt die Route. Einfach, schnell und ohne Umwege.
              </p>
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {previewOk ? (
                  <img
                    src={previewImage}
                    alt="Ultreia App Vorschau"
                    className="h-[280px] w-full object-cover"
                    onError={() => setPreviewOk(false)}
                  />
                ) : (
                  <div className="h-[280px] w-full bg-gradient-to-br from-blue-100 to-emerald-100" />
                )}
              </div>
            </article>
          </div>
        </section>

        <section className="sm-shell pt-6 pb-16 sm:pt-8 sm:pb-20">
          <div className="sm-card-strong p-7 sm:p-10 sm-rise sm-delay-2">
            <p className="sm-chip !border-white/35 !bg-white/10 !text-white">Release-ready Frontend</p>
            <h3 className="mt-4 text-3xl font-extrabold sm:text-4xl">
              Bereit fuer den Live-Rollout der MVP-Experience
            </h3>
            <p className="mt-3 max-w-3xl text-sm text-blue-50 sm:text-lg">
              Fuer User: relevante Hinweise ohne Suchstress. Fuer Anbieter: Sichtbarkeit
              exakt im passenden Moment. Genau dafuer ist Ultreia gebaut.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => setApkOpen(true)} className="sm-btn-secondary">
                App jetzt testen
              </button>
              <Link to="/register" className="sm-btn-ghost">
                Anbieter-Onboarding
              </Link>
              <Link to="/why" className="sm-btn-ghost">
                Warum Ultreia
              </Link>
            </div>
          </div>
        </section>

        <footer className="sm-divider bg-white/70">
          <div className="sm-shell flex flex-col items-start justify-between gap-3 py-7 text-sm text-slate-600 md:flex-row md:items-center">
            <div className="flex items-center gap-2 font-semibold text-slate-700">
              <img src={logoIcon} alt="Ultreia" className="h-5 w-5" />
              © {new Date().getFullYear()} Ultreia
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Link to="/home">Home</Link>
              <Link to="/why">Warum neu</Link>
              <Link to="/register">Registrieren</Link>
              <Link to="/privacy">Datenschutz</Link>
            </div>
          </div>
        </footer>
      </div>

      <ApkModal
        open={apkOpen}
        onClose={() => setApkOpen(false)}
        onDontShowAgain={() => {
          try {
            localStorage.setItem("apkModalSeen", "1");
          } catch (e) {
            void e;
          }
          setApkOpen(false);
        }}
        apkUrl={APK_REDIRECT_URL}
      />
    </div>
  );
}
