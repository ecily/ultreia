import React from "react";
import { Link } from "react-router-dom";

const CONSENT_KEY = "sm.cookie.notice.v1";

export default function CookieNotice() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    try {
      const seen = localStorage.getItem(CONSENT_KEY) === "1";
      if (!seen) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const acceptNotice = () => {
    try {
      localStorage.setItem(CONSENT_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[110] p-3 sm:p-4">
      <div className="sm-shell">
        <div className="sm-card-soft px-5 py-4 sm:px-6 sm:py-5">
          <p className="text-sm text-slate-700 sm:text-[15px]">
            Ultreia verwendet aktuell nur technisch notwendige Speichertechnologien
            für Zugang, Sicherheit und stabile Nutzung. Analyse- oder Marketing-Cookies
            sind derzeit nicht aktiv.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={acceptNotice} className="sm-btn-primary !px-4 !py-2">
              Verstanden
            </button>
            <Link to="/privacy" className="sm-btn-secondary !px-4 !py-2">
              Datenschutz
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
