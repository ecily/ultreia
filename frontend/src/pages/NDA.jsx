import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FileText, ShieldCheck } from "lucide-react";

import axiosInstance from "../api/axios";
import logoIcon from "../assets/stepsmatch-icon.svg";

const NDA_VERSION = "v1.0";
const NDA_DATE = "20.08.2025";

export default function NDA() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/home";

  const containerRef = useRef(null);

  const [checked, setChecked] = useState(false);
  const [scrolledEnd, setScrolledEnd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const testerKey = useMemo(() => localStorage.getItem("stepsmatch_tester_key") || "", []);
  const testerInfo = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("stepsmatch_tester_info") || "{}");
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    const accepted = localStorage.getItem("stepsmatch_ndaa_accepted") === "1";
    if (accepted) navigate(next, { replace: true });
  }, [navigate, next]);

  useEffect(() => {
    if (!testerKey) navigate("/", { replace: true });
  }, [testerKey, navigate]);

  const onScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const reachedEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 12;
    if (reachedEnd) setScrolledEnd(true);
  };

  const handleAccept = async () => {
    setErrorMsg("");
    setSubmitting(true);
    try {
      localStorage.setItem("stepsmatch_ndaa_accepted", "1");
      localStorage.setItem("stepsmatch_ndaa_version", NDA_VERSION);
      localStorage.setItem("stepsmatch_ndaa_date", NDA_DATE);

      try {
        localStorage.setItem("ndaAcceptedAt", new Date().toISOString());
      } catch {
        // ignore
      }

      try {
        await axiosInstance.post("/testers/accept", {
          key: testerKey,
          ndaVersion: NDA_VERSION,
        });
      } catch (err) {
        console.warn("[NDA] accept log failed", err?.response?.data || err?.message);
      }

      navigate(next, { replace: true });
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || "Akzeptieren derzeit nicht möglich. Bitte später erneut versuchen.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sm-page">
      <div className="sm-stack sm-shell py-8 sm:py-10">
        <div className="mx-auto w-full max-w-5xl sm-card p-5 sm:p-7">
          <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 pb-4">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-blue-200 bg-blue-50">
              <img src={logoIcon} alt="StepsMatch" className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-blue-700">Vertraulichkeitsvereinbarung</p>
              <h1 className="text-xl font-extrabold sm:text-2xl">NDA für die Pre-Seed-Testphase</h1>
            </div>
            <div className="ml-auto rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              Version {NDA_VERSION} · Stand {NDA_DATE}
            </div>
          </header>

          <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
            <article className="sm-card-soft p-4 sm:p-5">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Tester-Daten</p>
              <div className="mt-2 grid gap-1 text-sm text-slate-700">
                <p><span className="font-semibold text-slate-500">Name:</span> {testerInfo?.name || "—"}</p>
                <p><span className="font-semibold text-slate-500">E-Mail:</span> {testerInfo?.email || "—"}</p>
                <p className="break-all"><span className="font-semibold text-slate-500">Key:</span> <code className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">{testerKey || "—"}</code></p>
              </div>
            </article>

            <article className="sm-card-soft p-4 sm:p-5 lg:max-w-sm">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-blue-700" />
                <p className="text-sm text-slate-700">
                  Zugang zur Testphase wird erst nach bestätigter NDA freigeschaltet.
                  APK-Download ist bewusst nicht Teil dieses Schritts.
                </p>
              </div>
            </article>
          </section>

          <section
            ref={containerRef}
            onScroll={onScroll}
            aria-label="NDA Text"
            className="mt-4 h-[420px] overflow-auto rounded-2xl border border-slate-200 bg-white px-4 py-5 sm:h-[500px] sm:px-6"
          >
            <NDAContent />
          </section>

          <section className="mt-5 border-t border-slate-200 pt-4">
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                disabled={submitting}
                aria-checked={checked}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700"
              />
              <span>
                Ich habe die Vertraulichkeitsvereinbarung gelesen und stimme den Bedingungen zu.
              </span>
            </label>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={() => window.print()} disabled={submitting} className="sm-btn-secondary !px-4 !py-2">
                Drucken / PDF
              </button>
              <button
                type="button"
                onClick={handleAccept}
                disabled={!checked || !scrolledEnd || submitting}
                aria-busy={submitting}
                className="sm-btn-primary !px-4 !py-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Speichere Zustimmung..." : "Akzeptieren & fortfahren"}
              </button>
            </div>

            <div aria-live="polite" className="mt-3 min-h-6">
              {errorMsg ? <div className="sm-error">{errorMsg}</div> : null}
              {!errorMsg && !scrolledEnd ? (
                <p className="text-xs text-slate-500">Bitte bis zum Ende des Dokuments scrollen.</p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function NDAContent() {
  return (
    <article className="space-y-4 text-sm leading-7 text-slate-700">
      <header className="flex items-center gap-2 text-slate-900">
        <FileText className="h-4 w-4" />
        <h2 className="text-lg font-extrabold">Vertraulichkeitsvereinbarung (NDA) – Pre-Seed-Testphase</h2>
      </header>

      <section>
        <h3 className="text-base font-bold text-slate-900">1. Parteien und Zweck</h3>
        <p>
          Diese Vertraulichkeitsvereinbarung ("Vereinbarung") wird geschlossen zwischen der
          <strong> StepsMatch ECILY e.U.</strong>, Sitz in Österreich ("StepsMatch"), und der in der
          Testerdatenbank hinterlegten natürlichen Person ("Tester"). Zweck dieser Vereinbarung ist es,
          dem Tester vertrauliche Informationen ausschließlich zur Evaluierung und Erprobung der
          StepsMatch-Lösung in einer frühen Entwicklungsphase zugänglich zu machen.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold text-slate-900">2. Vertrauliche Informationen</h3>
        <p>
          Vertrauliche Informationen sind sämtliche nicht öffentlichen Informationen, unabhängig von
          Form oder Medium, einschließlich Konzepte, Geschäftsmodelle, Produktdaten, Quellcode,
          APIs, Datenmodelle, Dokumentationen, Algorithmen, Prototypen, Markt- und Finanzdaten
          sowie davon abgeleitete Notizen und Analysen.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold text-slate-900">3. Pflichten des Testers</h3>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Vertrauliche Informationen ausschließlich für den vereinbarten Testzweck nutzen.</li>
          <li>Keine Offenlegung an Dritte ohne vorherige schriftliche Zustimmung von StepsMatch.</li>
          <li>Angemessene technische und organisatorische Schutzmaßnahmen einhalten.</li>
          <li>Kein Reverse Engineering, keine Dekompilierung, keine Konkurrenzableitung.</li>
          <li>Unverzügliche Meldung bei drohender oder tatsächlicher unbefugter Offenlegung.</li>
        </ol>
      </section>

      <section>
        <h3 className="text-base font-bold text-slate-900">4. Ausnahmen</h3>
        <p>
          Die Pflichten gelten nicht für Informationen, die nachweislich allgemein bekannt sind,
          rechtmäßig ohne Geheimhaltungspflicht von Dritten stammen, unabhängig entwickelt wurden
          oder aufgrund zwingender gesetzlicher Vorgaben offengelegt werden müssen.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold text-slate-900">5. Eigentum, Rückgabe und Löschung</h3>
        <p>
          Alle vertraulichen Informationen bleiben Eigentum von StepsMatch. Auf Anforderung sind
          diese unverzüglich zurückzugeben oder zu löschen und die Löschung schriftlich zu bestätigen.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold text-slate-900">6. Laufzeit</h3>
        <p>
          Diese Vereinbarung gilt während der gesamten Pre-Seed-Testphase sowie drei Jahre danach.
          Für geschützte Betriebs- und Geschäftsgeheimnisse gelten die Geheimhaltungspflichten,
          solange deren Schutzwürdigkeit besteht.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold text-slate-900">7. Rechte, Lizenzen und Feedback</h3>
        <p>
          Durch diese Vereinbarung werden keine Eigentums- oder Lizenzrechte an geistigem Eigentum
          übertragen. Für bereitgestelltes Feedback erhält StepsMatch ein unentgeltliches,
          zeitlich und räumlich unbeschränktes Nutzungsrecht.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold text-slate-900">8. Datenschutz (DSGVO)</h3>
        <p>
          StepsMatch verarbeitet personenbezogene Daten des Testers ausschließlich zur Zugangskontrolle,
          Vertragsdurchführung und Dokumentation der Zustimmung nach den einschlägigen Rechtsgrundlagen
          der DSGVO.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold text-slate-900">9. Rechtsbehelfe</h3>
        <p>
          Bei Verstößen kann StepsMatch Unterlassungs- und Schadenersatzansprüche geltend machen,
          einschließlich einstweiliger Verfügungen nach österreichischem Recht.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold text-slate-900">10. Rechtswahl und Gerichtsstand</h3>
        <p>
          Es gilt österreichisches Recht unter Ausschluss seiner Kollisionsnormen. Gerichtsstand ist,
          soweit zulässig, Wien.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold text-slate-900">11. Schlussbestimmungen</h3>
        <p>
          Änderungen und Ergänzungen bedürfen der Schriftform; E-Mail genügt. Sollten einzelne
          Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.
          Die elektronische Zustimmung per Click-Wrap ist rechtsverbindlich.
        </p>
      </section>

      <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
        <strong>Akzeptanz:</strong> Mit Klick auf "Akzeptieren & fortfahren" bestätigst du die
        Kenntnisnahme und Zustimmung zu dieser Vereinbarung.
      </p>
    </article>
  );
}
