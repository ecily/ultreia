import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { GoogleMap, Circle, MarkerF } from "@react-google-maps/api";
import { ToastContainer, toast } from "react-toastify";
import { ImagePlus, Save, Trash2 } from "lucide-react";

import axiosInstance from "../api/axios";
import "react-toastify/dist/ReactToastify.css";

const mapContainerStyle = { width: "100%", height: "320px" };
const MAX_IMAGES = 3;

const isValidLngLat = (lng, lat) =>
  Number.isFinite(lng) &&
  Number.isFinite(lat) &&
  lng >= -180 &&
  lng <= 180 &&
  lat >= -90 &&
  lat <= 90;

const geoJsonToLatLng = (coords) => {
  if (!Array.isArray(coords) || coords.length !== 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!isValidLngLat(lng, lat)) return null;
  return { lat, lng };
};

export default function AddOfferForm() {
  const { providerId: paramId } = useParams();
  const navigate = useNavigate();

  const resolvedProviderId = useMemo(() => (paramId || "").trim(), [paramId]);
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const API_BASE = (import.meta.env.VITE_API_BASE_URL || axiosInstance?.defaults?.baseURL || "").replace(/\/+$/, "");

  const [providerLocation, setProviderLocation] = useState(null);
  const [providerMeta, setProviderMeta] = useState(null);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);

  const [formData, setFormData] = useState({
    provider: resolvedProviderId,
    name: "",
    category: "",
    subcategory: "",
    description: "",
    radius: 100,
    validDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    validTimes: { start: "00:00", end: "23:59" },
    validDates: { from: today, to: today },
    contact: "",
    images: [],
  });

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const mapRef = useRef(null);
  const fetchedRef = useRef(false);

  const isGoogleLoaded = typeof window !== "undefined" && typeof window.google !== "undefined" && window.google.maps;

  useEffect(() => {
    setFormData((prev) => ({ ...prev, provider: resolvedProviderId }));
  }, [resolvedProviderId]);

  useEffect(() => {
    axiosInstance
      .get("categories")
      .then((res) => setCategories(Array.isArray(res.data) ? res.data : []))
      .catch((err) => console.error("/categories:", err?.message || err));
  }, []);

  useEffect(() => {
    if (!resolvedProviderId) {
      setError("Kein Anbieter ausgewählt. Rufe die Seite als /offers/add/:providerId auf.");
      return;
    }
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    axiosInstance
      .get(`providers/${resolvedProviderId}`)
      .then((res) => {
        const provider = res?.data;
        if (!provider?._id) return setError("Anbieter nicht gefunden.");

        const ll = geoJsonToLatLng(provider?.location?.coordinates);
        if (!ll) return setError("Ungültige Provider-Koordinaten (GeoJSON [lng, lat]).");

        setProviderLocation(ll);
        setProviderMeta({ name: provider?.name, address: provider?.address });
      })
      .catch(() => setError("Anbieter nicht gefunden."));
  }, [resolvedProviderId]);

  useEffect(() => {
    const selected = categories.find((c) => c.name === formData.category);
    const subs = Array.isArray(selected?.subcategories) ? selected.subcategories : [];
    setSubcategories(subs);
    if (formData.subcategory && !subs.includes(formData.subcategory)) {
      setFormData((prev) => ({ ...prev, subcategory: "" }));
    }
  }, [formData.category, formData.subcategory, categories]);

  useEffect(() => {
    if (providerLocation && mapRef.current) {
      mapRef.current.panTo(providerLocation);
      mapRef.current.setZoom(15);
    }
  }, [providerLocation]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "categoryId") {
      const selected = categories.find((c) => String(c._id) === String(value));
      setFormData((prev) => ({
        ...prev,
        categoryId: value,
        category: selected?.name || "",
        subcategoryId: "",
        subcategory: "",
      }));
    } else if (name === "subcategoryId") {
      const selected = subcategories.find((sc) => String(sc._id) === String(value));
      setFormData((prev) => ({ ...prev, subcategoryId: value, subcategory: selected?.name || "" }));
    } else if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setFormData((prev) => ({ ...prev, [parent]: { ...prev[parent], [child]: value } }));
    } else if (name === "radius") {
      const n = Number(value);
      setFormData((prev) => ({ ...prev, radius: Number.isFinite(n) ? n : prev.radius }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleImageChange = async (e) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;

    const remaining = Math.max(0, MAX_IMAGES - formData.images.length);
    const files = picked.slice(0, remaining);
    if (files.length === 0) {
      setError(`Maximal ${MAX_IMAGES} Bilder erlaubt.`);
      toast.error(`Maximal ${MAX_IMAGES} Bilder erlaubt.`);
      return;
    }

    try {
      setUploading(true);
      const fd = new FormData();
      files.forEach((file) => fd.append("images", file));

      const resp = await fetch(`${API_BASE}/uploads/images?folder=offers`, {
        method: "POST",
        body: fd,
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) {
        const msg = data?.error || `Upload fehlgeschlagen (HTTP ${resp.status}).`;
        throw new Error(msg);
      }

      const urls = (data.images || []).map((i) => i.url).filter(Boolean);
      setFormData((prev) => ({ ...prev, images: [...prev.images, ...urls].slice(0, MAX_IMAGES) }));
      toast.success("Bilder hochgeladen.");
    } catch (err) {
      const msg = err?.message || "Fehler beim Hochladen der Bilder.";
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (index) => {
    const imageUrl = formData.images[index];
    try {
      await axiosInstance.delete("uploads", { data: { url: imageUrl } });
      setFormData((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
      toast.success("Bild entfernt.");
    } catch (err) {
      const serverMsg = err?.response?.data?.error || "Fehler beim Löschen des Bildes.";
      toast.error(serverMsg);
      setFormData((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!resolvedProviderId) {
      setError("Kein Anbieter ausgewählt.");
      toast.error("Kein Anbieter ausgewählt.");
      return;
    }
    if (!providerLocation) {
      setError("Standort des Anbieters fehlt.");
      toast.error("Standort des Anbieters fehlt.");
      return;
    }
    if ((!formData.categoryId && !formData.category) || (!formData.subcategoryId && !formData.subcategory)) {
      setError("Kategorie und Subkategorie müssen gewählt werden.");
      toast.error("Kategorie und Subkategorie müssen gewählt werden.");
      return;
    }
    if ((formData.description || "").length > 250) {
      setError("Beschreibung darf maximal 250 Zeichen haben.");
      toast.error("Beschreibung darf maximal 250 Zeichen haben.");
      return;
    }

    const payload = {
      ...formData,
      provider: resolvedProviderId,
      radius: Number(formData.radius) || 0,
      location: {
        type: "Point",
        coordinates: [providerLocation.lng, providerLocation.lat],
      },
    };

    try {
      await axiosInstance.post("offers", payload);
      toast.success("Angebot erfolgreich gespeichert.");
      navigate(`/dashboard/${resolvedProviderId}`);
    } catch (err) {
      const msg = err.response?.data?.error || "Fehler beim Speichern";
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="sm-page">
      <div className="sm-stack sm-shell py-8 sm:py-10">
        <div className="mx-auto w-full max-w-4xl sm-card p-6 sm:p-8">
          <ToastContainer />
          <h1 className="text-3xl font-extrabold">Angebot anlegen</h1>
          {providerMeta && (
            <p className="mt-2 text-sm text-slate-600">
              Anbieter: <span className="font-semibold text-slate-700">{providerMeta.name}</span> · {providerMeta.address}
            </p>
          )}
          {error && <p className="sm-error mt-4">{error}</p>}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="sm-label" htmlFor="offer-name">Name</label>
              <input id="offer-name" name="name" value={formData.name} onChange={handleChange} required className="sm-input" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="sm-label" htmlFor="offer-category">Kategorie</label>
                <select id="offer-category" name="category" value={formData.category} onChange={handleChange} required className="sm-select">
                  <option value="">Kategorie wählen</option>
                  {categories.map((cat, idx) => (
                    <option key={idx} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="sm-label" htmlFor="offer-subcategory">Subkategorie</label>
                <select id="offer-subcategory" name="subcategory" value={formData.subcategory} onChange={handleChange} required className="sm-select">
                  <option value="">Subkategorie wählen</option>
                  {subcategories.map((sub, idx) => (
                    <option key={idx} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="sm-label" htmlFor="offer-description">Beschreibung (max. 250)</label>
              <textarea id="offer-description" name="description" value={formData.description} onChange={handleChange} maxLength={250} rows={3} className="sm-textarea" />
            </div>

            <div>
              <label className="sm-label" htmlFor="offer-radius">Radius (m)</label>
              <input id="offer-radius" type="number" name="radius" value={formData.radius} onChange={handleChange} min={0} className="sm-input" />
            </div>

            {providerLocation && isGoogleLoaded ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <GoogleMap
                  key={`${providerLocation.lat},${providerLocation.lng}`}
                  mapContainerStyle={mapContainerStyle}
                  zoom={15}
                  center={providerLocation}
                  onLoad={(map) => (mapRef.current = map)}
                  options={{ mapTypeControl: false, streetViewControl: false, fullscreenControl: false, zoomControl: true }}
                >
                  <MarkerF position={providerLocation} />
                  <Circle
                    center={providerLocation}
                    radius={Number(formData.radius) || 0}
                    options={{ strokeColor: "#2563eb", fillColor: "#3b82f6", strokeOpacity: 0.8, strokeWeight: 2, fillOpacity: 0.2 }}
                  />
                </GoogleMap>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-600">Karte nicht geladen (Google Maps Script wird zentral geladen).</div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="sm-label" htmlFor="valid-from">Gültig ab</label>
                <input id="valid-from" type="date" name="validDates.from" value={formData.validDates.from} onChange={handleChange} className="sm-input" />
              </div>
              <div>
                <label className="sm-label" htmlFor="valid-to">Gültig bis</label>
                <input id="valid-to" type="date" name="validDates.to" value={formData.validDates.to} onChange={handleChange} className="sm-input" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="sm-label" htmlFor="time-start">Startzeit</label>
                <input id="time-start" type="time" name="validTimes.start" value={formData.validTimes.start} onChange={handleChange} className="sm-input" />
              </div>
              <div>
                <label className="sm-label" htmlFor="time-end">Endzeit</label>
                <input id="time-end" type="time" name="validTimes.end" value={formData.validTimes.end} onChange={handleChange} className="sm-input" />
              </div>
            </div>

            <div>
              <label className="sm-label" htmlFor="offer-contact">Kontaktinfo (optional)</label>
              <input id="offer-contact" name="contact" value={formData.contact} onChange={handleChange} className="sm-input" />
            </div>

            <div className="sm-card-soft p-4">
              <label className="sm-label" htmlFor="offer-images">Bilder (max. {MAX_IMAGES})</label>
              <input
                id="offer-images"
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                disabled={uploading || formData.images.length >= MAX_IMAGES}
                className="sm-input file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
              />

              {formData.images.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {formData.images.map((img, idx) => (
                    <div key={idx} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <img src={img} alt={`Bild ${idx + 1}`} className="h-24 w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute right-2 top-2 hidden rounded-full bg-red-600 p-1 text-white shadow group-hover:block"
                        title="Bild entfernen"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" disabled={uploading} className="sm-btn-primary gap-2">
              {uploading ? <ImagePlus size={16} /> : <Save size={16} />}
              {uploading ? "Lädt..." : "Angebot speichern"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
