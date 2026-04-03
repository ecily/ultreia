import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, UserPlus } from "lucide-react";

import axiosInstance from "../api/axios";

const Register = ({ onRegisterSuccess }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: "", email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [verifyEmail, setVerifyEmail] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyHint, setVerifyHint] = useState("");
  const [verifyPreview, setVerifyPreview] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const handleChange = (e) => setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const resolveProviderAndGo = async (userId, fallbackProviderId = "") => {
    let providerId = fallbackProviderId;
    if (!providerId) {
      const providerRes = await axiosInstance.get(`/providers/user/${userId}`);
      providerId = providerRes?.data?._id || "";
    }
    if (!providerId) throw new Error("Kein Anbieterprofil gefunden.");

    localStorage.setItem("providerId", providerId);
    if (onRegisterSuccess) onRegisterSuccess(providerId);
    navigate(`/dashboard/${providerId}`);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await axiosInstance.post("/users/register", formData);
      const data = res?.data || {};
      const userId = data?.user?._id;
      const providerId = data?.provider?._id || "";

      if (userId) localStorage.setItem("userId", userId);

      if (data?.verificationRequired) {
        setVerifyEmail(data?.email || formData.email || "");
        setVerifyHint(data?.message || "Bitte bestaetige zuerst deine E-Mail-Adresse.");
        setVerifyPreview(data?.verificationCodePreview || "");
        return;
      }

      if (!userId) throw new Error("Registrierung erfolgreich, aber userId fehlt.");
      await resolveProviderAndGo(userId, providerId);
    } catch (err) {
      const data = err?.response?.data || {};

      if (data?.verificationRequired) {
        setVerifyEmail(data?.email || formData.email || "");
        setVerifyHint(data?.message || "Bitte bestaetige zuerst deine E-Mail-Adresse.");
        setVerifyPreview(data?.verificationCodePreview || "");
      } else {
        setError(data?.message || data?.error || err?.message || "Registrierung fehlgeschlagen.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setVerifyLoading(true);
    try {
      const email = (verifyEmail || formData.email || "").trim();
      const code = (verifyCode || "").trim();
      const res = await axiosInstance.post("/users/verify-email", { email, code });
      const userId = res?.data?.user?._id;
      if (!userId) throw new Error("Verifizierung erfolgreich, aber userId fehlt.");
      localStorage.setItem("userId", userId);
      setVerifyHint("E-Mail bestaetigt. Du wirst weitergeleitet...");
      await resolveProviderAndGo(userId);
    } catch (err) {
      const data = err?.response?.data || {};
      setError(data?.message || data?.error || err?.message || "Verifizierung fehlgeschlagen.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setResendLoading(true);
    try {
      const email = (verifyEmail || formData.email || "").trim();
      const res = await axiosInstance.post("/users/resend-verification", { email });
      setVerifyHint(res?.data?.message || "Neuer Verifizierungscode wurde gesendet.");
      setVerifyPreview(res?.data?.verificationCodePreview || "");
    } catch (err) {
      const data = err?.response?.data || {};
      setError(data?.message || data?.error || err?.message || "Code konnte nicht erneut gesendet werden.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="sm-page">
      <div className="sm-stack sm-shell grid min-h-screen place-items-center py-10">
        <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <section className="sm-card p-7 sm:p-8 sm-rise">
            <h1 className="text-3xl font-extrabold">Anbieter Registrierung</h1>
            <p className="mt-2 text-slate-600">
              In wenigen Minuten live gehen und lokale Sichtbarkeit genau im richtigen
              Moment erhalten.
            </p>

            {error && <div className="sm-error mt-4">{error}</div>}

            <form onSubmit={handleRegister} className="mt-6 space-y-4">
              <div>
                <label htmlFor="name" className="sm-label">Name</label>
                <input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="sm-input"
                />
              </div>

              <div>
                <label htmlFor="email" className="sm-label">E-Mail</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="sm-input"
                />
              </div>

              <div>
                <label htmlFor="password" className="sm-label">Passwort</label>
                <div className="relative mt-1">
                  <input
                    id="password"
                    type={showPw ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="sm-input pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute inset-y-0 right-1 my-auto grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                    aria-label={showPw ? "Passwort verbergen" : "Passwort anzeigen"}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="sm-btn-primary !w-full gap-2">
                <UserPlus size={16} />
                {isLoading ? "Konto wird erstellt..." : "Konto erstellen"}
              </button>
            </form>

            {!!verifyEmail && (
              <form onSubmit={handleVerify} className="mt-5 space-y-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
                <p className="text-sm font-semibold text-blue-900">E-Mail Verifizierung erforderlich</p>
                {!!verifyHint && <p className="text-sm text-blue-800">{verifyHint}</p>}
                {!!verifyPreview && (
                  <p className="text-xs text-blue-700">
                    Testcode: <span className="font-semibold">{verifyPreview}</span>
                  </p>
                )}
                <div>
                  <label className="sm-label" htmlFor="verifyCode">Verifizierungscode</label>
                  <input
                    id="verifyCode"
                    type="text"
                    inputMode="numeric"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    className="sm-input"
                    placeholder="6-stelliger Code"
                    required
                  />
                </div>
                <button type="submit" disabled={verifyLoading} className="sm-btn-primary !w-full">
                  {verifyLoading ? "Pruefe Code..." : "E-Mail bestaetigen"}
                </button>
                <button type="button" disabled={resendLoading} onClick={handleResend} className="sm-btn-secondary !w-full">
                  {resendLoading ? "Sende erneut..." : "Code erneut senden"}
                </button>
              </form>
            )}

            <div className="mt-4 flex items-center justify-between text-sm">
              <Link to="/login" className="font-semibold text-blue-700 hover:text-blue-800">
                Schon registriert?
              </Link>
              <Link to="/home" className="text-slate-600 hover:text-slate-800">
                Zur Landing
              </Link>
            </div>
          </section>

          <section className="sm-card-strong p-7 sm:p-9 sm-rise sm-delay-1">
            <p className="sm-chip !border-white/30 !bg-white/10 !text-white">Go Live Setup</p>
            <h2 className="mt-4 text-3xl font-extrabold">Von 0 auf lokales Matching</h2>
            <p className="mt-3 text-blue-50 sm:text-lg">
              Nach der Registrierung kannst du direkt Angebote anlegen, Radius setzen
              und Gueltigkeitsfenster definieren.
            </p>
            <ul className="mt-6 grid gap-3 text-sm text-blue-50">
              <li>• Anbieter-Stammdaten mit Kartenposition</li>
              <li>• Angebotslogik mit Tagen, Uhrzeiten und Laufzeit</li>
              <li>• Dashboard fuer Pflege und Optimierung</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Register;
