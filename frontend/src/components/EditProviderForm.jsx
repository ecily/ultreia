import React, { useEffect, useRef, useState, useCallback } from "react";
import { GoogleMap, useLoadScript, Autocomplete, Circle } from "@react-google-maps/api";
import { useNavigate, useParams } from "react-router-dom";
import { LocateFixed, MapPinned, Save, Satellite } from "lucide-react";

import axiosInstance from "../api/axios";

const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const GOOGLE_LIBRARIES = ["places", "marker"];

const mapContainerStyle = { width: "100%", height: "340px" };
const fallbackCenter = { lat: 47.0707, lng: 15.4395 };

export default function EditProviderForm() {
  const navigate = useNavigate();
  const { providerId: routeProviderId } = useParams();

  const [providerId, setProviderId] = useState(routeProviderId || "");
  const [loading, setLoading] = useState(true);
  const [loadErrorText, setLoadErrorText] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    description: "",
    contact: "",
    address: "",
  });

  const [markerPosition, setMarkerPosition] = useState(fallbackCenter);
  const [radius, setRadius] = useState(300);
  const [mapType, setMapType] = useState("roadmap");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);

  const autocompleteRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_LIBRARIES,
  });

  useEffect(() => {
    let isActive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        setLoadErrorText("");

        let pid = routeProviderId;

        if (pid && /\$\{/.test(pid)) pid = "";

        if (!pid) {
          const userId = localStorage.getItem("userId");
          if (!userId) {
            setLoadErrorText("Kein Benutzer angemeldet.");
            navigate("/login");
            return;
          }

          try {
            const res = await axiosInstance.get(`/providers/user/${encodeURIComponent(userId)}`);
            pid = res?.data?._id;
          } catch (err) {
            if (err?.response?.status === 404) {
              setLoadErrorText("Für diesen Benutzer ist noch kein Anbieter angelegt.");
              setLoading(false);
              return;
            }
            throw err;
          }
        }

        if (!pid) {
          setLoadErrorText("Kein Anbieter gefunden.");
          setLoading(false);
          return;
        }
        setProviderId(pid);

        const provRes = await axiosInstance.get(`/providers/${encodeURIComponent(pid)}`);
        const p = provRes?.data;
        if (!p) {
          setLoadErrorText("Anbieterdaten leer oder ungültig.");
          setLoading(false);
          return;
        }

        if (!isActive) return;

        setFormData({
          name: p.name || "",
          category: p.category || "",
          description: p.description || "",
          contact: p.contact || "",
          address: p.address || "",
        });

        const coords = Array.isArray(p.location?.coordinates)
          ? { lat: p.location.coordinates[1], lng: p.location.coordinates[0] }
          : fallbackCenter;

        setMarkerPosition(coords);
        setRadius(typeof p.radiusMeters === "number" ? p.radiusMeters : 300);
        setDirty(false);

        if (mapRef.current) {
          mapRef.current.panTo(coords);
          mapRef.current.setZoom(15);
        }
      } catch (e) {
        const msg = e?.response?.data?.error || e?.message || "Fehler beim Laden der Anbieterdaten.";
        setLoadErrorText(msg);
      } finally {
        if (isActive) setLoading(false);
      }
    })();

    return () => {
      isActive = false;
    };
  }, [routeProviderId, navigate]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.google?.maps) return;
    if (markerRef.current) return;

    const hasAdvanced = !!window.google?.maps?.marker?.AdvancedMarkerElement;
    const canUseAdvanced = hasAdvanced && !!MAP_ID;

    if (canUseAdvanced) {
      markerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: markerPosition,
        gmpDraggable: true,
        title: "Standort",
      });
      markerRef.current.addListener("dragend", (e) => {
        setMarkerPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        setDirty(true);
      });
    } else {
      markerRef.current = new window.google.maps.Marker({
        map: mapRef.current,
        position: markerPosition,
        draggable: true,
        title: "Standort",
      });
      markerRef.current.addListener("dragend", (e) => {
        setMarkerPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        setDirty(true);
      });
    }
  }, [isLoaded, markerPosition]);

  useEffect(() => {
    if (!markerRef.current || !window.google?.maps) return;
    const m = markerRef.current;
    if (
      window.google?.maps?.marker?.AdvancedMarkerElement &&
      m instanceof window.google.maps.marker.AdvancedMarkerElement
    ) {
      m.position = markerPosition;
    } else if (m.setPosition) {
      m.setPosition(markerPosition);
    }
  }, [markerPosition]);

  const handlePlaceChanged = () => {
    const place = autocompleteRef.current?.getPlace?.();
    if (!place || !place.geometry) {
      setError("Adresse konnte nicht erkannt werden. Bitte erneut versuchen.");
      return;
    }
    const { lat, lng } = place.geometry.location;
    const next = { lat: lat(), lng: lng() };
    setMarkerPosition(next);
    setFormData((prev) => ({ ...prev, address: place.formatted_address || prev.address }));
    setDirty(true);
    if (mapRef.current) {
      mapRef.current.panTo(next);
      mapRef.current.setZoom(16);
    }
  };

  const geocodeAddress = async (address) =>
    new Promise((resolve, reject) => {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address, region: "AT" }, (results, status) => {
        if (status === "OK" && results[0]) resolve(results[0]);
        else reject(new Error(status));
      });
    });

  const applyAddressPosition = async () => {
    setError("");
    const addr = (formData.address || "").trim();
    if (!addr) {
      setError("Bitte zuerst eine Adresse eingeben.");
      return;
    }
    try {
      setIsGeocoding(true);
      const result = await geocodeAddress(addr);
      const loc = result.geometry.location;
      const next = { lat: loc.lat(), lng: loc.lng() };
      setMarkerPosition(next);
      setDirty(true);
      if (mapRef.current) {
        mapRef.current.panTo(next);
        mapRef.current.setZoom(16);
      }
    } catch (err) {
      console.error(err);
      setError("Adresse konnte nicht geokodiert werden.");
    } finally {
      setIsGeocoding(false);
    }
  };

  const locateMe = () => {
    if (!navigator?.geolocation) {
      setError("Geolokalisierung wird nicht unterstützt.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMarkerPosition(coords);
        setDirty(true);
        if (mapRef.current) {
          mapRef.current.panTo(coords);
          mapRef.current.setZoom(16);
        }
        setIsLocating(false);
      },
      (err) => {
        console.error(err);
        setError("Standort konnte nicht ermittelt werden.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target || {};
    setFormData((prev) => ({ ...prev, [name]: value }));
    setDirty(true);
  };

  const doSave = useCallback(async () => {
    if (!providerId || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError("");
      setSuccess(false);

      const payload = {
        ...formData,
        location: {
          type: "Point",
          coordinates: [markerPosition.lng, markerPosition.lat],
        },
        radiusMeters: radius,
      };

      const url = `/providers/${encodeURIComponent(providerId)}`;

      try {
        await axiosInstance.patch(url, payload);
      } catch (err) {
        const st = err?.response?.status;
        if (st === 404 || st === 405 || st === 400) {
          await axiosInstance.put(url, payload);
        } else {
          throw err;
        }
      }

      setSuccess(true);
      setDirty(false);
      setTimeout(() => navigate(`/dashboard/${providerId}`), 450);
    } catch (err) {
      setError(err?.response?.data?.error || "Fehler beim Speichern der Stammdaten");
    } finally {
      setIsSubmitting(false);
    }
  }, [providerId, formData, markerPosition, radius, isSubmitting, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await doSave();
  };

  if (loadError) return <p className="sm-shell py-6 text-red-600">Fehler beim Laden der Karte.</p>;
  if (!isLoaded) return <p className="sm-shell py-6 text-slate-600">Karte wird geladen...</p>;
  if (loading) return <p className="sm-shell py-6 text-slate-600">Anbieterdaten werden geladen...</p>;
  if (loadErrorText) return <p className="sm-shell py-6 text-red-600">{loadErrorText}</p>;

  const disableSave = isSubmitting || isGeocoding || isLocating || !providerId || !dirty;

  return (
    <div className="sm-page">
      <div className="sm-stack sm-shell py-8 sm:py-10">
        <div className="mx-auto w-full max-w-4xl sm-card p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold">Anbieter-Stammdaten bearbeiten</h1>
              <p className="mt-2 text-slate-600">Ändere Profil, Standort und Radius ohne die Angebotslogik zu verlieren.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => navigate(`/dashboard/${providerId || ""}`)} className="sm-btn-secondary !px-4 !py-2">
                Zurück
              </button>
              <button type="button" onClick={doSave} disabled={disableSave} className="sm-btn-primary !px-4 !py-2 disabled:cursor-not-allowed disabled:opacity-60">
                <Save size={15} /> {isSubmitting ? "Speichere..." : dirty ? "Speichern" : "Gespeichert"}
              </button>
            </div>
          </div>

          {error && <p className="sm-error mt-4">{error}</p>}
          {success && <p className="sm-success mt-4">Änderungen gespeichert.</p>}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="sm-label" htmlFor="edit-provider-name">Name</label>
                <input id="edit-provider-name" name="name" value={formData.name} onChange={handleInputChange} required className="sm-input" />
              </div>
              <div>
                <label className="sm-label" htmlFor="edit-provider-category">Kategorie</label>
                <input id="edit-provider-category" name="category" value={formData.category} onChange={handleInputChange} required className="sm-input" />
              </div>
            </div>

            <div>
              <label className="sm-label" htmlFor="edit-provider-description">Beschreibung</label>
              <textarea id="edit-provider-description" name="description" value={formData.description} onChange={handleInputChange} rows={3} className="sm-textarea" />
            </div>

            <div>
              <label className="sm-label" htmlFor="edit-provider-contact">Kontakt</label>
              <input id="edit-provider-contact" name="contact" value={formData.contact} onChange={handleInputChange} className="sm-input" />
            </div>

            <div className="sm-card-soft p-4 sm:p-5">
              <label className="sm-label" htmlFor="edit-provider-address">Adresse</label>
              <Autocomplete onLoad={(ref) => (autocompleteRef.current = ref)} onPlaceChanged={handlePlaceChanged} options={{ componentRestrictions: { country: "at" } }}>
                <input
                  id="edit-provider-address"
                  type="text"
                  placeholder="Adresse eingeben"
                  value={formData.address}
                  onChange={(e) => {
                    setFormData((p) => ({ ...p, address: e.target.value }));
                    setDirty(true);
                  }}
                  className="sm-input"
                />
              </Autocomplete>

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={applyAddressPosition} className="sm-btn-primary !px-4 !py-2" disabled={isGeocoding}>
                  <MapPinned size={15} /> {isGeocoding ? "Übernehme..." : "Adresse übernehmen"}
                </button>
                <button type="button" onClick={locateMe} className="sm-btn-secondary !px-4 !py-2" disabled={isLocating}>
                  <LocateFixed size={15} /> {isLocating ? "Bestimme..." : "Mein Standort"}
                </button>
                <button type="button" onClick={() => setMapType((t) => (t === "roadmap" ? "satellite" : "roadmap"))} className="sm-btn-secondary !px-4 !py-2">
                  <Satellite size={15} /> {mapType === "roadmap" ? "Satellit" : "Karte"}
                </button>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={markerPosition}
                  zoom={15}
                  onLoad={(map) => (mapRef.current = map)}
                  onClick={(e) => {
                    setMarkerPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() });
                    setDirty(true);
                  }}
                  options={{
                    mapId: MAP_ID,
                    mapTypeId: mapType,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                    zoomControl: true,
                  }}
                >
                  <Circle center={markerPosition} radius={radius} options={{ strokeOpacity: 0.6, strokeWeight: 1, fillOpacity: 0.12 }} />
                </GoogleMap>
              </div>
            </div>

            <div className="sm-card-soft p-4">
              <label className="sm-label">Radius: {radius} m</label>
              <input
                type="range"
                min={50}
                max={5000}
                step={50}
                value={radius}
                onChange={(e) => {
                  setRadius(Number(e.target.value));
                  setDirty(true);
                }}
                className="w-full"
              />
              <div className="mt-1 flex justify-between text-xs text-slate-500">
                <span>50 m</span>
                <span>5.000 m</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-700">Koordinaten:</span> {markerPosition.lat.toFixed(6)}, {markerPosition.lng.toFixed(6)}
              </p>
              <button type="submit" disabled={isSubmitting || isGeocoding || isLocating || !providerId} className="sm-btn-primary !px-4 !py-2">
                {isSubmitting ? "Speichere..." : "Änderungen speichern"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
