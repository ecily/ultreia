import React from "react";
import { NavLink, Link } from "react-router-dom";

const items = [
  { to: "/admin/categories", label: "Kategorien" },
  { to: "/admin/offers", label: "Angebote & Karte" },
];

export default function AdminNav() {
  return (
    <div className="sticky top-16 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur">
      <div className="sm-shell flex min-h-14 flex-wrap items-center justify-between gap-2 py-2">
        <nav className="flex flex-wrap items-center gap-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sm-nav-link ${isActive ? "sm-nav-link-active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <Link to="/home" className="sm-btn-secondary !px-4 !py-2">
          Zur Startseite
        </Link>
      </div>
    </div>
  );
}
