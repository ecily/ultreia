import React from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import brandLockup from "../assets/stepsmatch-logo-horizontal-dark.svg";

const navItems = [
  { to: "/home", label: "Home" },
  { to: "/why", label: "Warum StepsMatch" },
  { to: "/pitch", label: "Investor Pitch" },
  { to: "/admin/offers", label: "Admin Demo" },
];

export default function Navbar() {
  const [open, setOpen] = React.useState(false);

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
        <Link to="/home" className="inline-flex items-center gap-3" aria-label="StepsMatch Startseite">
          <img
            src={brandLockup}
            alt="StepsMatch"
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
          <Link to="/login" className="sm-btn-secondary">
            Login
          </Link>
          <Link to="/register" className="sm-btn-primary">
            Anbieter starten
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white/90 text-slate-700 lg:hidden"
          aria-label={open ? "Navigation schließen" : "Navigation öffnen"}
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
              <Link to="/login" className="sm-btn-secondary" onClick={() => setOpen(false)}>
                Login
              </Link>
              <Link to="/register" className="sm-btn-primary" onClick={() => setOpen(false)}>
                Anbieter starten
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
