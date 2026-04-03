import React, { useRef, useState, useCallback } from "react";
import { GoogleMap, Marker, useJsApiLoader, Autocomplete } from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "400px",
};

const centerDefault = {
  lat: 47.0707,
  lng: 15.4395,
};

const GoogleMapInput = ({ onLocationSelect }) => {
  const [markerPosition, setMarkerPosition] = useState(centerDefault);
  const autocompleteRef = useRef(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ["places"],
  });

  const onPlaceChanged = () => {
    const place = autocompleteRef.current.getPlace();
    if (place.geometry) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const pos = { lat, lng };
      setMarkerPosition(pos);
      onLocationSelect({ lat, lng, address: place.formatted_address });
    }
  };

  const onMapClick = useCallback(
    (event) => {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      setMarkerPosition({ lat, lng });
      onLocationSelect({ lat, lng });
    },
    [onLocationSelect]
  );

  if (!isLoaded) return <p className="text-slate-600">Lade Karte...</p>;

  return (
    <div className="space-y-3">
      <Autocomplete onLoad={(ref) => (autocompleteRef.current = ref)} onPlaceChanged={onPlaceChanged}>
        <input type="text" placeholder="Adresse eingeben" className="sm-input" />
      </Autocomplete>
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <GoogleMap mapContainerStyle={containerStyle} center={markerPosition} zoom={15} onClick={onMapClick}>
          <Marker position={markerPosition} />
        </GoogleMap>
      </div>
    </div>
  );
};

export default GoogleMapInput;
