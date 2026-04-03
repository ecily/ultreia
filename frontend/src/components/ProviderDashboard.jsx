import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle, Clock, LogOut, Ruler, Settings2, Trash2, XCircle } from "lucide-react";
import { GoogleMap, Circle, useJsApiLoader } from "@react-google-maps/api";

import axiosInstance from "../api/axios";

const ProviderDashboard = () => {
  const navigate = useNavigate();
  const [offers, setOffers] = useState([]);
  const [error, setError] = useState("");
  const [providerId, setProviderId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  useEffect(() => {
    const userId = localStorage.getItem("userId");

    if (!userId) {
      navigate("/login");
      return;
    }

    const fetchProviderAndOffers = async () => {
      try {
        const providerRes = await axiosInstance.get(`/providers/user/${userId}`);
        const provider = providerRes.data;
        setProviderId(provider._id);

        const offersRes = await axiosInstance.get(`/offers/provider/${provider._id}`);
        setOffers(offersRes.data);
      } catch (err) {
        console.error(err);
        setError("Daten konnten nicht geladen werden");
      }
    };

    fetchProviderAndOffers();
  }, [navigate]);

  const handleDelete = async (offerId) => {
    try {
      await axiosInstance.delete(`/offers/${offerId}`);
      setOffers((prev) => prev.filter((o) => o._id !== offerId));
    } catch (err) {
      console.error(err);
      alert("Fehler beim Löschen");
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  const getStatusInfo = (offer) => {
    const now = new Date();
    const fromDate = offer.validDates?.from || offer.validDates?.start;
    const toDate = offer.validDates?.to || offer.validDates?.end || fromDate;
    const fromTime = offer.validTimes?.from || offer.validTimes?.start || "00:00";
    const toTime = offer.validTimes?.to || offer.validTimes?.end || "23:59";

    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);
    endDate.setHours(23, 59, 59, 999);

    const [startHour, startMinute] = String(fromTime).split(":") || [];
    const [endHour, endMinute] = String(toTime).split(":") || [];
    if (startHour && startMinute) startDate.setHours(+startHour, +startMinute, 0);
    if (endHour && endMinute) endDate.setHours(+endHour, +endMinute, 59);

    if (now < startDate) {
      const diffMs = startDate - now;
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return {
        key: "upcoming",
        icon: <Clock className="mr-1 h-4 w-4 text-orange-500" />,
        text: `Gültig in ${hours}h ${minutes}min`,
      };
    }

    if (now > endDate) {
      return {
        key: "expired",
        icon: <XCircle className="mr-1 h-4 w-4 text-red-500" />,
        text: "Angebot abgelaufen",
      };
    }

    const diffMs = endDate - now;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return {
      key: "active",
      icon: <CheckCircle className="mr-1 h-4 w-4 text-emerald-600" />,
      text: `Gerade gültig · noch ${hours}h ${minutes}min`,
    };
  };

  const dashboardRows = useMemo(() => {
    return offers.map((offer) => ({ offer, status: getStatusInfo(offer) }));
  }, [offers]);

  const metrics = useMemo(() => {
    const base = { total: offers.length, active: 0, upcoming: 0, expired: 0 };
    for (const row of dashboardRows) {
      if (row.status?.key === "active") base.active += 1;
      if (row.status?.key === "upcoming") base.upcoming += 1;
      if (row.status?.key === "expired") base.expired += 1;
    }
    return base;
  }, [dashboardRows, offers.length]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dashboardRows.filter((row) => {
      if (statusFilter !== "all" && row.status?.key !== statusFilter) return false;
      if (!q) return true;
      const o = row.offer;
      return [o?.name, o?.description, o?.category, o?.subcategory]
        .filter(Boolean)
        .some((txt) => String(txt).toLowerCase().includes(q));
    });
  }, [dashboardRows, query, statusFilter]);

  return (
    <div className="sm-page">
      <div className="sm-stack sm-shell py-8 sm:py-10">
        <div className="mx-auto w-full max-w-5xl space-y-5">
          <section className="sm-card-soft p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl font-extrabold">Deine Angebote</h1>
                <p className="mt-2 text-slate-600">Verwalte Laufzeiten, Radius und Inhalte für deine aktive Ausspielung.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    if (!providerId) return;
                    navigate(`/edit-provider/${providerId}`);
                  }}
                  className="sm-btn-secondary !px-4 !py-2"
                >
                  <Settings2 size={15} /> Stammdaten
                </button>
                <button onClick={handleLogout} className="sm-btn-danger !px-4 !py-2">
                  <LogOut size={15} /> Logout
                </button>
              </div>
            </div>

            {providerId && (
              <Link to={`/add-offer/${providerId}`} className="sm-btn-primary mt-5 !px-4 !py-2">
                Neues Angebot anlegen
              </Link>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Gesamt</p>
                <p className="mt-1 text-2xl font-extrabold">{metrics.total}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">Aktiv</p>
                <p className="mt-1 text-2xl font-extrabold text-emerald-800">{metrics.active}</p>
              </div>
              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-orange-700">Geplant</p>
                <p className="mt-1 text-2xl font-extrabold text-orange-800">{metrics.upcoming}</p>
              </div>
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-red-700">Abgelaufen</p>
                <p className="mt-1 text-2xl font-extrabold text-red-800">{metrics.expired}</p>
              </div>
            </div>
          </section>

          {error && <p className="sm-error">{error}</p>}

          {offers.length === 0 ? (
            <div className="sm-card p-6 text-slate-600">Noch keine Angebote vorhanden.</div>
          ) : (
            <div className="grid gap-4">
              <section className="sm-card p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "all", label: "Alle" },
                      { id: "active", label: "Aktiv" },
                      { id: "upcoming", label: "Geplant" },
                      { id: "expired", label: "Abgelaufen" },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setStatusFilter(f.id)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                          statusFilter === f.id ? "border-blue-300 bg-blue-100 text-blue-800" : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Suche nach Name, Kategorie ..."
                    className="sm-input !w-full sm:!w-[300px]"
                  />
                </div>
              </section>

              {filteredRows.length === 0 ? (
                <div className="sm-card p-6 text-slate-600">Keine Angebote für den aktuellen Filter gefunden.</div>
              ) : null}

              {filteredRows.map(({ offer, status }) => {
                const [lng, lat] = offer.location.coordinates;
                const center = { lat, lng };
                const radiusWithBuffer = offer.radius + 10;

                return (
                  <article key={offer._id} className="sm-card p-5 sm:p-6">
                    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-start gap-3">
                          {offer.images?.[0] ? (
                            <img src={offer.images[0]} alt="Preview" className="h-20 w-20 rounded-xl object-cover" />
                          ) : null}
                          <div>
                            <h2 className="text-xl font-bold">{offer.name}</h2>
                            <p className="mt-1 text-sm text-slate-600">{offer.description}</p>
                            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                              {offer.category} {offer.subcategory ? `· ${offer.subcategory}` : ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                            <span
                              key={day}
                              className={`rounded-full border px-2 py-1 text-xs font-semibold ${
                                Array.isArray(offer.validDays) && offer.validDays.includes(day)
                                  ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                                  : "border-slate-200 bg-slate-50 text-slate-400"
                              }`}
                            >
                              {day.slice(0, 2)}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center gap-1 text-sm text-slate-600">
                          <Ruler className="h-4 w-4" />
                          Angebot gilt im Umkreis von {offer.radius} m
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1">
                          <Link to={`/edit-offer/${offer._id}`} className="sm-btn-secondary !px-4 !py-2">
                            Bearbeiten
                          </Link>
                          <button onClick={() => handleDelete(offer._id)} className="sm-btn-danger !px-4 !py-2">
                            <Trash2 size={14} /> Löschen
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                          {status.icon}
                          {status.text}
                        </div>

                        {isLoaded ? (
                          <GoogleMap
                            mapContainerStyle={{ width: "100%", height: "150px", borderRadius: "12px" }}
                            center={center}
                            zoom={15}
                            options={{ disableDefaultUI: true }}
                            onLoad={(map) => {
                              const bounds = new window.google.maps.LatLngBounds();
                              const circle = new window.google.maps.Circle({ center, radius: radiusWithBuffer });
                              bounds.union(circle.getBounds());
                              map.fitBounds(bounds);
                            }}
                          >
                            <Circle
                              center={center}
                              radius={offer.radius}
                              options={{
                                fillColor: "#3b82f6",
                                fillOpacity: 0.2,
                                strokeColor: "#2563eb",
                                strokeOpacity: 0.8,
                                strokeWeight: 2,
                              }}
                            />
                          </GoogleMap>
                        ) : (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Karte lädt...</div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProviderDashboard;
