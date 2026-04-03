// Helles, modernes Ultreia-Map-Theme
// Fokus: klare Straßen (weiß), dezente Flächen (hellgrau), Wasser hellblau,
// Parks sanft grün, Labels dunkelgrau, POIs reduziert.
export default [
  { elementType: "geometry", stylers: [{ color: "#f4f6f9" }] }, // Grundfläche
  { elementType: "labels.text.fill", stylers: [{ color: "#2b2f36" }] }, // dunkle Label
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }, { weight: 2 }] },

  // Wasser
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#cfe7ff" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3a4b66" }] },

  // Parks / Grünflächen
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e7f3e9" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#2f5d35" }] },

  // POIs allgemein (dezent, nicht dominant)
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eef2f6" }] },
  { featureType: "poi", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },

  // Straßen
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#4a5360" }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#f9fbfe" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#f0f4f8" }] },
  { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#e8eef5" }] },

  // ÖPNV eher reduziert
  { featureType: "transit", stylers: [{ visibility: "off" }] },

  // Administrative Grenzen und Labels etwas präsenter, aber fein
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#d9dee6" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#3b4654" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#495368" }] },

  // Landschaft minimal abdunkeln für Kontrast zu Straßen
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#eef2f6" }] },
];
