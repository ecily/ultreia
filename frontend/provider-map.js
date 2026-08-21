(function initializeProviderMap() {
  const loadPromises = new Map();

  function haversineMeters(first, second) {
    const radians = (value) => value * Math.PI / 180;
    const dLat = radians(second.lat - first.lat); const dLng = radians(second.lng - first.lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(first.lat)) * Math.cos(radians(second.lat)) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function load(apiKey) {
    if (!apiKey) return Promise.reject(new Error('maps_key_missing'));
    if (window.google?.maps) return Promise.resolve(window.google.maps);
    if (loadPromises.has(apiKey)) return loadPromises.get(apiKey);
    const promise = new Promise((resolve, reject) => {
      const callback = `__ultreiaMapsReady${Date.now()}`;
      const script = document.createElement('script');
      window[callback] = () => { delete window[callback]; resolve(window.google.maps); };
      script.async = true;
      script.defer = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&callback=${callback}`;
      script.onerror = () => { delete window[callback]; reject(new Error('maps_load_failed')); };
      document.head.appendChild(script);
    });
    loadPromises.set(apiKey, promise);
    return promise;
  }

  function coordinates(location) {
    const original = location?.googleOriginalLocation || location?.finalLocation || location;
    const final = location?.finalLocation || location;
    return { original: { lat: Number(original?.latitude), lng: Number(original?.longitude) }, final: { lat: Number(final?.latitude), lng: Number(final?.longitude) } };
  }

  async function mount(container, { apiKey, location, editable = false, labels = {}, onMove, onError } = {}) {
    if (!container || !location) return null;
    container.replaceChildren();
    const canvas = document.createElement('div');
    canvas.className = 'provider-map-canvas';
    canvas.setAttribute('role', 'img');
    const text = { mapLabel: 'Provider location map', markerMoved: 'Marker moved', markerTooFar: 'Marker movement exceeds 25 m.', mapUnavailable: 'Map preview is unavailable; the address remains available as text.', ...labels };
    canvas.setAttribute('aria-label', container.dataset.mapLabel || text.mapLabel);
    const details = document.createElement('div');
    details.className = 'provider-map-copy';
    details.innerHTML = `<strong>${String(location.formattedAddress || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</strong><span data-map-adjustment></span>`;
    container.append(canvas, details);
    try {
      const maps = await load(apiKey);
      const points = coordinates(location);
      if (![points.original.lat, points.original.lng, points.final.lat, points.final.lng].every(Number.isFinite)) throw new Error('maps_location_invalid');
      let finalPoint = points.final;
      const map = new maps.Map(canvas, { center: finalPoint, zoom: 17, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, gestureHandling: 'cooperative' });
      const marker = new maps.Marker({ map, position: finalPoint, draggable: editable, title: location.formattedAddress || 'Provider location' });
      const updateAdjustment = (point, accepted = true) => {
        const adjustmentMeters = haversineMeters(points.original, point);
        const target = details.querySelector('[data-map-adjustment]');
        if (target) target.textContent = accepted ? `${text.markerMoved}: ${Math.round(adjustmentMeters)} m` : text.markerTooFar;
        onMove?.({ ...point, adjustmentMeters, accepted });
      };
      if (editable) marker.addListener('dragend', () => {
        const position = marker.getPosition();
        const point = { lat: position.lat(), lng: position.lng() };
        const accepted = haversineMeters(points.original, point) <= 25;
        if (accepted) finalPoint = point;
        else marker.setPosition(finalPoint);
        updateAdjustment(finalPoint, accepted);
      });
      updateAdjustment(points.final, true);
      return { map, marker };
    } catch (mapError) {
      container.classList.add('provider-map-error');
      const error = document.createElement('span');
      error.dataset.mapError = '';
      error.textContent = text.mapUnavailable;
      details.append(error);
      onError?.(mapError);
      return null;
    }
  }

  window.UltreiaProviderMap = { mount, haversineMeters };
})();
