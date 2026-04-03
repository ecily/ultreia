import React from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import brandLockup from "../assets/ultreia-logo-horizontal-dark.svg";
import { useI18n, SUPPORTED_LOCALES } from "../i18n";
import { BRAND_NAME } from "../config/brand";

export default function Navbar() {
  const [open, setOpen] = React.useState(false);
  const { locale, setLocale, t } = useI18n();

  const navItems = React.useMemo(
    () => [
      { to: "/home", label: t("nav.home", "Home") },
      { to: "/why", label: t("nav.why", "Warum Ultreia") },
      { to: "/pitch", label: t("nav.pitch", "Investor Pitch") },
      { to: "/admin/offers", label: t("nav.admin", "Admin Demo") },
    ],
    [t]
  );

  React.useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const navClass = ({ isActive }) =>
    `sm-nav-link ${isActive ? "sm-nav-link-active" : ""}`;

  return (
    <header className="sm-glass-nav">
      <div className="sm-shell flex h-20 items-center justify-between gap-4 py-2">
        <Link to="/home" className="inline-flex items-center gap-3" aria-label={t("nav.brandHome", "Ultreia Startseite")}>
          <img
            src={brandLockup}
            alt={BRAND_NAME}
            className="h-10 w-auto sm:h-11 lg:h-12"
            loading="eager"
          />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={navClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <label className="sr-only" htmlFor="langSelectTop">{t("common.language", "Sprache")}</label>
          <select
            id="langSelectTop"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            {SUPPORTED_LOCALES.map((lng) => (
              <option key={lng} value={lng}>{lng.toUpperCase()}</option>
            ))}
          </select>
          <Link to="/login" className="sm-btn-secondary">
            {t("nav.login", "Login")}
          </Link>
          <Link to="/register" className="sm-btn-primary">
            {t("nav.startProvider", "Anbieter starten")}
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white/90 text-slate-700 lg:hidden"
          aria-label={open ? "Navigation schliessen" : "Navigation oeffnen"}
          aria-expanded={open}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-slate-200/70 bg-white/95 px-4 pb-5 pt-3 shadow-xl lg:hidden">
          <div className="sm-shell grid gap-2 px-0">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={navClass}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 sm:col-span-2"
                aria-label={t("common.language", "Sprache")}
              >
                {SUPPORTED_LOCALES.map((lng) => (
                  <option key={lng} value={lng}>{lng.toUpperCase()}</option>
                ))}
              </select>
              <Link to="/login" className="sm-btn-secondary" onClick={() => setOpen(false)}>
                {t("nav.login", "Login")}
              </Link>
              <Link to="/register" className="sm-btn-primary" onClick={() => setOpen(false)}>
                {t("nav.startProvider", "Anbieter starten")}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
