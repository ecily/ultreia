(function initializeProviderOfferUi() {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  function filterNeeds(needs, query) {
    const normalized = String(query || '').trim().toLocaleLowerCase();
    if (!normalized) return needs.slice();
    return needs.filter((need) => `${need.label} ${need.key}`.toLocaleLowerCase().includes(normalized));
  }

  function popularNeeds(needs, limit = 6) { return needs.slice(0, limit); }

  function groupNeeds(needs) {
    return [...new Set(needs.map((need) => need.group || need.criticality || 'other'))].map((group) => ({ group, items: needs.filter((need) => (need.group || need.criticality || 'other') === group) }));
  }

  function presetWeekly(preset, existing = {}) {
    const weekly = Object.fromEntries(days.map((day) => [day, []]));
    if (preset === 'daily') days.forEach((day) => { weekly[day] = [{ open: '08:00', close: '18:00' }]; });
    if (preset === 'weekdays') days.slice(0, 5).forEach((day) => { weekly[day] = [{ open: '08:00', close: '18:00' }]; });
    if (preset === 'custom') return structuredClone(existing || weekly);
    return weekly;
  }

  function detectHoursPreset(weekly = {}) {
    const signature = (day) => JSON.stringify(weekly[day] || []);
    const first = signature('monday');
    if (first !== '[]' && days.every((day) => signature(day) === first)) return 'daily';
    if (first !== '[]' && days.slice(0, 5).every((day) => signature(day) === first) && days.slice(5).every((day) => signature(day) === '[]')) return 'weekdays';
    return 'custom';
  }

  function priceVisibility(type) {
    return { amount: ['fixed', 'from'].includes(type), range: type === 'range', currency: !['free', 'donativo', 'on_request'].includes(type) };
  }

  function hasOpeningWindow(weekly = {}) { return days.some((day) => (weekly[day] || []).some((window) => window?.open && window?.close && window.open !== window.close)); }

  function validateOfferDraft(body) {
    if (String(body?.title || '').trim().length < 2) return { field: 'title', code: 'title_required' };
    if (String(body?.description || '').trim().length < 2) return { field: 'description', code: 'description_required' };
    if (!Array.isArray(body?.needKeys) || body.needKeys.length === 0) return { field: 'needKeys', code: 'needs_required' };
    const price = body.price || {};
    if (!['free', 'donativo', 'on_request'].includes(price.type) && price.type !== 'range' && (!Number.isFinite(price.amount) || price.amount < 0)) return { field: 'price', code: 'price_invalid' };
    if (price.type === 'range' && (!Number.isFinite(price.min) || !Number.isFinite(price.max) || price.min < 0 || price.max < price.min)) return { field: 'price', code: 'price_invalid' };
    if (!hasOpeningWindow(body.availability?.weekly || {})) return { field: 'hours', code: 'hours_required' };
    if (!Number.isInteger(body.radiusMeters) || body.radiusMeters < 50 || body.radiusMeters > 1000) return { field: 'radiusMeters', code: 'radius_invalid' };
    return null;
  }

  window.UltreiaProviderOfferUi = { days, filterNeeds, popularNeeds, groupNeeds, presetWeekly, detectHoursPreset, priceVisibility, hasOpeningWindow, validateOfferDraft };
})();
