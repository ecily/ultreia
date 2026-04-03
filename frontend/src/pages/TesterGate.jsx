import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, ShieldCheck } from "lucide-react";

import axiosInstance from "../api/axios";
import logoIcon from "../assets/ultreia-icon.svg";

const NDA_ACCEPTED_KEY = "ultreia_nda_accepted";
const NDA_ACCEPTED_LEGACY_KEY = "ultreia_ndaa_accepted";

function SpecialMessageModal({ open, message, onClose }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[130] grid place-items-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="sm-card w-full max-w-md p-6 sm:p-7" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-extrabold text-slate-900">Persoenliche Nachricht</h3>
        <p className="mt-3 text-base text-slate-700">{message}</p>
        <button type="button" onClick={onClose} className="sm-btn-primary mt-6 !w-full">
          Schliessen
        </button>
      </div>
    </div>
  );
}

export default function TesterGate() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/home";

  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [specialMessage, setSpecialMessage] = useState("");

  useEffect(() => {
    const accepted =
      localStorage.getItem(NDA_ACCEPTED_KEY) === "1" ||
      localStorage.getItem(NDA_ACCEPTED_LEGACY_KEY) === "1";
    if (accepted) navigate(next, { replace: true });
  }, [navigate, next]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ultreia_tester_key");
      if (saved && typeof saved === "string") setKey(saved);
    } catch (e) {
      void e;
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    const trimmed = key.trim().toUpperCase();
    if (!trimmed) {
      setErrorMsg("Bitte gib deinen Tester-Key ein.");
      return;
    }

    setLoading(true);
    try {
      const res = await axiosInstance.post("/testers/validate", { key: trimmed });
      if (res?.data?.ok) {
        localStorage.setItem("ultreia_tester_key", trimmed);
        const testerPayload = res?.data?.tester || {};
        localStorage.setItem("ultreia_tester_info", JSON.stringify(testerPayload));

        const modalMessage = String(testerPayload?.gateModalMessage || "").trim();
        if (modalMessage) {
          setSpecialMessage(modalMessage);
          return;
        }

        navigate("/nda", { replace: true });
      } else {
        setErrorMsg("Ungueltiger Key. Bitte ueberpruefe deine Eingabe.");
      }
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || "Validierung derzeit nicht moeglich.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SpecialMessageModal
        open={Boolean(specialMessage)}
        message={specialMessage}
        onClose={() => {
          setSpecialMessage("");
          navigate("/nda", { replace: true });
        }}
      />

      <div className="sm-page">
        <div className="sm-stack sm-shell grid min-h-screen place-items-center py-10">
          <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.08fr_0.92fr]">
            <section className="sm-card-strong p-7 sm:p-9 sm-rise">
              <p className="sm-chip !border-white/30 !bg-white/10 !text-white">Private Testphase</p>
              <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">Willkommen im Ultreia MVP-Access</h1>
              <p className="mt-3 max-w-xl text-blue-50 sm:text-lg">
                Zugang zur Testumgebung erfolgt ueber persoenlichen Tester-Key und NDA-Akzeptanz.
                Danach steht dir die komplette Frontend-Strecke offen.
              </p>
              <div className="mt-6 grid gap-3 text-sm text-blue-50">
                <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Zugang nur fuer eingeladene Tester</div>
                <div className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Key-Pruefung gegen Backend-Validierung</div>
              </div>
            </section>

            <section className="sm-card p-7 sm:p-8 sm-rise sm-delay-1">
              <div className="flex items-center gap-2">
                <img src={logoIcon} alt="Ultreia" className="h-6 w-6" />
                <p className="text-sm font-semibold text-slate-600">Tester-Zugang</p>
              </div>

              <h2 className="mt-4 text-2xl font-extrabold">Zugang freischalten</h2>
              <p className="mt-2 text-slate-600">Bitte Key eingeben, um zur NDA und anschliessend in die App-Preview zu gelangen.</p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="testerKey" className="sm-label">Tester-Key</label>
                  <input
                    id="testerKey"
                    type="text"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    disabled={loading}
                    className="sm-input uppercase tracking-wide"
                    placeholder="z. B. SM-2026-ALPHA"
                  />
                </div>

                {errorMsg ? <div className="sm-error">{errorMsg}</div> : null}

                <button type="submit" disabled={loading} className="sm-btn-primary !w-full">
                  {loading ? "Pruefe Key..." : "Weiter zur NDA"}
                </button>
              </form>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
