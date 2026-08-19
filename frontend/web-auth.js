const WEB_API_BASE = 'https://api.ultreia.app/api';
const WEB_SCOPE_KEY = 'ultreia.web.scope';
let webRefreshPromise = null;

const webText = {
  de: {
    providerLogin: 'Anbieter anmelden', adminLogin: 'Admin anmelden', provider: 'Anbieter', admin: 'Administration', email: 'E-Mail', send: 'Magic Link senden', sent: 'Wenn die Adresse berechtigt ist, wird ein Magic Link an diese Adresse gesendet.', pendingMail: 'Der Produktions-Mailversand ist noch nicht eingerichtet.', verify: 'Anmeldung wird geprüft …', success: 'Anmeldung erfolgreich', role: 'Rolle', scope: 'Bereich', logout: 'Abmelden', dashboardPending: 'Provider-Dashboard wird schrittweise aufgebaut.', adminPending: 'Admin-Bereich wird schrittweise aufgebaut.', denied: 'Für diesen Bereich fehlt die erforderliche Rolle.', back: 'Zurück zur Anmeldung', localTest: 'Technischer local_test-Modus', localTestHint: 'Nur autorisierte Admin-/Test-Accounts können diesen Bereich nutzen.', requested: 'Anfrage konnte nicht verarbeitet werden.', mailMissing: 'Der Produktions-Mailprovider ist noch nicht konfiguriert.', mailFailed: 'Der Mailprovider konnte die Nachricht nicht versenden.'
  },
  en: {
    providerLogin: 'Provider login', adminLogin: 'Admin login', provider: 'Provider', admin: 'Administration', email: 'Email', send: 'Send magic link', sent: 'If this address is eligible, a magic link will be sent to it.', pendingMail: 'Production email delivery is not configured yet.', verify: 'Checking sign-in …', success: 'Sign-in successful', role: 'Role', scope: 'Scope', logout: 'Sign out', dashboardPending: 'The provider dashboard is being built step by step.', adminPending: 'The admin area is being built step by step.', denied: 'This area requires a different role.', back: 'Back to sign-in', localTest: 'Technical local_test mode', localTestHint: 'Only authorized admin/test accounts can use this scope.', requested: 'The request could not be processed.', mailMissing: 'The production mail provider is not configured yet.', mailFailed: 'The mail provider could not send the message.'
  },
  es: {
    providerLogin: 'Acceso para proveedores', adminLogin: 'Acceso de administración', provider: 'Proveedor', admin: 'Administración', email: 'Correo electrónico', send: 'Enviar enlace mágico', sent: 'Si la dirección está autorizada, se enviará un enlace mágico.', pendingMail: 'El envío de correo de producción aún no está configurado.', verify: 'Comprobando el acceso …', success: 'Acceso correcto', role: 'Rol', scope: 'Ámbito', logout: 'Cerrar sesión', dashboardPending: 'El panel de proveedores se está construyendo paso a paso.', adminPending: 'El área de administración se está construyendo paso a paso.', denied: 'Esta área requiere otro rol.', back: 'Volver al acceso', localTest: 'Modo técnico local_test', localTestHint: 'Solo las cuentas de administrador/prueba autorizadas pueden usar este ámbito.', requested: 'No se pudo procesar la solicitud.', mailMissing: 'El proveedor de correo de producción aún no está configurado.', mailFailed: 'El proveedor de correo no pudo enviar el mensaje.'
  }
};

const providerText = {
  de: { providerStep: 'Anbieter', locationStep: 'Standort', offerStep: 'Erstes Angebot', businessName: 'Betriebsname', sourceLocale: 'Quellsprache', phone: 'Telefon (optional)', website: 'Website (optional)', save: 'Speichern', locationSearch: 'Adresse oder Ort suchen', saveLocation: 'Standort speichern', googleMissing: 'Google Places ist noch nicht konfiguriert.', locationAdjust: 'Marker-Korrektur bis 25 m moglich.', needs: 'Needs', title: 'Titel', description: 'Beschreibung', price: 'Preis', priceType: 'Preisart', amount: 'Betrag', min: 'Von', max: 'Bis', currency: 'Wahrung', hours: 'Offnungszeiten', radius: 'Radius (Meter)', createOffer: 'Angebot speichern', editOffer: 'Angebot bearbeiten', cancel: 'Abbrechen', active: 'Aktiv', draft: 'Entwurf', paused: 'Pausiert', expired: 'Abgelaufen', pause: 'Pausieren', resume: 'Reaktivieren', confirm: 'Bestatigen', noOffers: 'Noch kein Angebot angelegt.', offerSaved: 'Angebot gespeichert.', providerError: 'Der Vorgang konnte nicht gespeichert werden.' },
  en: { providerStep: 'Provider', locationStep: 'Location', offerStep: 'First offer', businessName: 'Business name', sourceLocale: 'Source language', phone: 'Phone (optional)', website: 'Website (optional)', save: 'Save', locationSearch: 'Search address or place', saveLocation: 'Save location', googleMissing: 'Google Places is not configured yet.', locationAdjust: 'You can adjust the marker by up to 25 m.', needs: 'Needs', title: 'Title', description: 'Description', price: 'Price', priceType: 'Price type', amount: 'Amount', min: 'From', max: 'To', currency: 'Currency', hours: 'Opening hours', radius: 'Radius (metres)', createOffer: 'Save offer', editOffer: 'Edit offer', cancel: 'Cancel', active: 'Active', draft: 'Draft', paused: 'Paused', expired: 'Expired', pause: 'Pause', resume: 'Reactivate', confirm: 'Confirm', noOffers: 'No offer yet.', offerSaved: 'Offer saved.', providerError: 'The change could not be saved.' },
  es: { providerStep: 'Proveedor', locationStep: 'Ubicacion', offerStep: 'Primera oferta', businessName: 'Nombre del negocio', sourceLocale: 'Idioma original', phone: 'Telefono (opcional)', website: 'Sitio web (opcional)', save: 'Guardar', locationSearch: 'Buscar direccion o lugar', saveLocation: 'Guardar ubicacion', googleMissing: 'Google Places aun no esta configurado.', locationAdjust: 'Puedes ajustar el marcador hasta 25 m.', needs: 'Necesidades', title: 'Titulo', description: 'Descripcion', price: 'Precio', priceType: 'Tipo de precio', amount: 'Importe', min: 'Desde', max: 'Hasta', currency: 'Moneda', hours: 'Horario', radius: 'Radio (metros)', createOffer: 'Guardar oferta', editOffer: 'Editar oferta', cancel: 'Cancelar', active: 'Activa', draft: 'Borrador', paused: 'Pausada', expired: 'Caducada', pause: 'Pausar', resume: 'Reactivar', confirm: 'Confirmar', noOffers: 'Todavia no hay ofertas.', offerSaved: 'Oferta guardada.', providerError: 'No se pudo guardar el cambio.' },
};

function pt(key) { return providerText[currentWebLanguage()][key] || providerText.en[key] || key; }

function currentWebLanguage() {
  return supportedLanguages.includes(window.localStorage.getItem(storageKey)) ? window.localStorage.getItem(storageKey) : getInitialLanguage();
}

function tx(key) { return webText[currentWebLanguage()][key]; }

function webScope() { return window.sessionStorage.getItem(WEB_SCOPE_KEY) || 'production'; }

async function webRefresh() {
  if (!webRefreshPromise) {
    webRefreshPromise = fetch(`${WEB_API_BASE}/auth/session/refresh`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json', 'x-ultreia-web': '1', 'x-ultreia-scope': webScope() } }).then((response) => response.ok).finally(() => { webRefreshPromise = null; });
  }
  return webRefreshPromise;
}

async function webApi(path, options = {}, allowRefresh = true) {
  const response = await fetch(`${WEB_API_BASE}${path}`, { ...options, credentials: 'include', headers: { 'content-type': 'application/json', 'x-ultreia-web': '1', 'x-ultreia-scope': webScope(), ...(options.headers || {}) } });
  if (response.status === 401 && allowRefresh && !path.includes('/session/refresh') && await webRefresh()) return webApi(path, options, false);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(body.status || 'request_failed'); error.status = body.status || 'request_failed'; error.httpStatus = response.status; throw error; }
  return body;
}

function webShell(title, content) {
  const main = document.querySelector('[data-web-app]');
  if (!main) return null;
  main.innerHTML = `<section class="web-auth-shell"><div class="web-auth-card"><p class="section-label">Ultreia.app</p><h1 class="web-auth-title">${title}</h1>${content}</div></section>`;
  return main;
}

function renderLogin(role) {
  const isAdmin = role === 'admin';
  const title = isAdmin ? tx('adminLogin') : tx('providerLogin');
  webShell(title, `<form class="web-auth-form" data-auth-form><label for="auth-email">${tx('email')}</label><input id="auth-email" name="email" type="email" autocomplete="email" required><button class="web-auth-button" type="submit">${tx('send')}</button>${isAdmin ? `<label class="web-scope-option"><input type="checkbox" name="localTest"> <span>${tx('localTest')}</span><small>${tx('localTestHint')}</small></label>` : ''}</form><p class="web-auth-message" data-auth-message aria-live="polite"></p><p class="web-auth-back"><a href="/">${tx('back')}</a></p>`);
  document.querySelector('[data-auth-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const scope = isAdmin && form.get('localTest') === 'on' ? 'local_test' : 'production';
    window.sessionStorage.setItem(WEB_SCOPE_KEY, scope);
    const message = document.querySelector('[data-auth-message]');
    message.textContent = '';
    try {
      const result = await webApi('/auth/magic-link/request', { method: 'POST', body: JSON.stringify({ email: form.get('email'), role, preferredLocale: currentWebLanguage() }) }, false);
      message.textContent = result.diagnosticId ? `${tx('sent')} ${result.diagnosticId}` : tx('sent');
    } catch (error) {
      message.textContent = error.status === 'mail_provider_not_configured' ? tx('mailMissing') : error.status === 'mail_provider_failed' ? tx('mailFailed') : tx('requested');
    }
  });
}

async function renderVerify() {
  webShell(tx('verify'), '<p class="web-auth-message" data-verify-message aria-live="polite"></p>');
  const message = document.querySelector('[data-verify-message]');
  const token = new URL(window.location.href).searchParams.get('token');
  window.history.replaceState({}, document.title, '/auth/verify');
  if (!token) { message.textContent = new URL(window.location.href).searchParams.get('denied') ? tx('denied') : tx('requested'); return; }
  try {
    const result = await webApi('/auth/magic-link/verify', { method: 'POST', body: JSON.stringify({ token }) }, false);
    message.textContent = tx('success');
    const roles = result.user?.roles || [];
    window.location.replace(roles.includes('admin') ? '/admin/' : roles.includes('provider') ? '/provider/' : '/auth/verify?denied=1');
  } catch (error) { message.textContent = error.status === 'local_test_not_authorized' ? tx('denied') : tx('requested'); }
}

function escapeProviderHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
const providerDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function providerOfferForm(offer, needs) {
  const weekly = offer?.availability?.weekly || {};
  const price = offer?.price || { type: 'free', currency: 'EUR' };
  const hours = providerDays.map((day) => `<label class="provider-hours-row"><span>${day}</span><input name="hours-open-${day}" data-hours-open="${day}" type="time" value="${escapeProviderHtml(weekly[day]?.[0]?.open || '')}"><input name="hours-close-${day}" data-hours-close="${day}" type="time" value="${escapeProviderHtml(weekly[day]?.[0]?.close || '')}"></label>`).join('');
  const selected = new Set(offer?.needKeys || []);
  return `<form class="provider-form provider-offer-form" data-offer-form data-offer-id="${offer?.id || ''}">
    <div class="provider-form-grid"><label>${pt('title')}<input name="title" required maxlength="120" value="${escapeProviderHtml(offer?.title || '')}"></label><label>${pt('priceType')}<select name="priceType"><option value="free" ${price.type === 'free' ? 'selected' : ''}>free</option><option value="fixed" ${price.type === 'fixed' ? 'selected' : ''}>fixed</option><option value="from" ${price.type === 'from' ? 'selected' : ''}>from</option><option value="range" ${price.type === 'range' ? 'selected' : ''}>range</option><option value="donativo" ${price.type === 'donativo' ? 'selected' : ''}>donativo</option><option value="on_request" ${price.type === 'on_request' ? 'selected' : ''}>on request</option></select></label></div>
    <label>${pt('description')}<textarea name="description" required maxlength="1000">${escapeProviderHtml(offer?.description || '')}</textarea></label>
    <fieldset><legend>${pt('needs')}</legend><div class="provider-need-grid">${needs.map((need) => `<label><input type="checkbox" name="needKeys" value="${escapeProviderHtml(need.key)}" ${selected.has(need.key) ? 'checked' : ''}> ${escapeProviderHtml(need.label)}</label>`).join('')}</div></fieldset>
    <div class="provider-form-grid"><label>${pt('amount')}<input name="amount" type="number" min="0" step="0.01" value="${escapeProviderHtml(price.amount ?? '')}"></label><label>${pt('min')}<input name="min" type="number" min="0" step="0.01" value="${escapeProviderHtml(price.min ?? '')}"></label><label>${pt('max')}<input name="max" type="number" min="0" step="0.01" value="${escapeProviderHtml(price.max ?? '')}"></label><label>${pt('currency')}<input name="currency" maxlength="3" value="${escapeProviderHtml(price.currency || 'EUR')}"></label></div>
    <fieldset><legend>${pt('hours')}</legend><div class="provider-hours-grid">${hours}</div></fieldset>
    <label>${pt('radius')}<input name="radiusMeters" type="number" min="50" max="1000" step="50" value="${escapeProviderHtml(offer?.radiusMeters || 250)}"></label>
    <p class="web-auth-message" data-offer-message aria-live="polite"></p><button class="web-auth-button" type="submit">${offer ? pt('editOffer') : pt('createOffer')}</button>${offer ? `<button class="web-auth-button secondary" data-cancel-offer type="button">${pt('cancel')}</button>` : ''}
  </form>`;
}

async function renderProviderStart() {
  const state = { profile: null, offers: [], needs: [], locationDraft: null, editingOffer: null };
  const load = async () => {
    const [profileResult, needsResult, offersResult] = await Promise.all([webApi('/provider/profile'), webApi(`/needs?locale=${currentWebLanguage()}`), webApi('/provider/offers')]);
    state.profile = profileResult.profile; state.needs = needsResult.items || []; state.offers = offersResult.items || [];
  };
  const render = () => {
    const profile = state.profile || {};
    const steps = `<div class="provider-stepper"><span class="${profile.businessName ? 'is-done' : 'is-current'}">1. ${pt('providerStep')}</span><span class="${profile.location ? 'is-done' : profile.businessName ? 'is-current' : ''}">2. ${pt('locationStep')}</span><span class="${profile.status === 'active' ? 'is-current' : ''}">3. ${pt('offerStep')}</span></div>`;
    const profileForm = `<section class="provider-panel"><p class="section-label">1. ${pt('providerStep')}</p><h2>${pt('businessName')}</h2><form class="provider-form" data-profile-form><label>${pt('businessName')}<input name="businessName" required maxlength="120" value="${escapeProviderHtml(profile.businessName)}"></label><label>${pt('sourceLocale')}<select name="sourceLocale"><option value="de" ${profile.sourceLocale === 'de' ? 'selected' : ''}>DE</option><option value="en" ${profile.sourceLocale === 'en' ? 'selected' : ''}>EN</option><option value="es" ${profile.sourceLocale === 'es' ? 'selected' : ''}>ES</option></select></label><label>${pt('phone')}<input name="phone" value="${escapeProviderHtml(profile.phone)}"></label><label>${pt('website')}<input name="website" type="url" value="${escapeProviderHtml(profile.website)}"></label><p>${escapeProviderHtml(profile.contactEmail || '')}</p><p class="web-auth-message" data-profile-message aria-live="polite"></p><button class="web-auth-button" type="submit">${pt('save')}</button></form></section>`;
    const location = state.locationDraft || profile.location;
    const locationForm = `<section class="provider-panel"><p class="section-label">2. ${pt('locationStep')}</p><h2>${pt('locationSearch')}</h2><form class="provider-form" data-location-form><label>${pt('locationSearch')}<input name="locationSearch" autocomplete="off" required><div class="provider-suggestions" data-suggestions></div></label><p class="provider-location-help">${pt('locationAdjust')}</p><div class="provider-map-preview" data-map-preview>${location ? `<span class="provider-map-marker">+</span><strong>${escapeProviderHtml(location.formattedAddress)}</strong><small>${Number(location.latitude).toFixed(6)}, ${Number(location.longitude).toFixed(6)}</small>` : '<span>Google Place</span>'}</div>${location ? `<div class="provider-form-grid"><label>Latitude<input name="finalLatitude" type="number" step="0.000001" value="${location.latitude}"></label><label>Longitude<input name="finalLongitude" type="number" step="0.000001" value="${location.longitude}"></label></div>` : ''}<p class="web-auth-message" data-location-message aria-live="polite"></p><button class="web-auth-button" data-save-location type="button" ${location ? '' : 'disabled'}>${pt('saveLocation')}</button></form></section>`;
    const offerSection = profile.status === 'active' && profile.location ? `<section class="provider-panel"><p class="section-label">3. ${pt('offerStep')}</p><h2>${state.editingOffer ? pt('editOffer') : pt('offerStep')}</h2>${state.editingOffer || state.offers.length === 0 ? providerOfferForm(state.editingOffer, state.needs) : ''}<div class="provider-offer-list">${state.offers.length === 0 ? `<p>${pt('noOffers')}</p>` : state.offers.map((offer) => `<article class="provider-offer-card"><div><strong>${escapeProviderHtml(offer.title)}</strong><span class="scope-badge">${escapeProviderHtml(pt(offer.status) || offer.status)}</span><p>${escapeProviderHtml(offer.description)}</p><small>${escapeProviderHtml(offer.needKeys.join(', '))} · ${offer.radiusMeters} m</small></div><div class="provider-actions"><button class="web-auth-button secondary" data-offer-action="edit" data-offer-id="${offer.id}" type="button">${pt('editOffer')}</button>${offer.status === 'active' ? `<button class="web-auth-button secondary" data-offer-action="pause" data-offer-id="${offer.id}" type="button">${pt('pause')}</button>` : `<button class="web-auth-button secondary" data-offer-action="resume" data-offer-id="${offer.id}" type="button">${pt('resume')}</button>`}<button class="web-auth-button secondary" data-offer-action="confirm" data-offer-id="${offer.id}" type="button">${pt('confirm')}</button></div></article>`).join('')}</div>${state.offers.length > 0 && !state.editingOffer ? `<button class="web-auth-button" data-new-offer type="button">${pt('createOffer')}</button>` : ''}<p class="web-auth-message" data-dashboard-message aria-live="polite"></p></section>` : `<section class="provider-panel"><p class="section-label">3. ${pt('offerStep')}</p><p>${pt('providerError')}</p></section>`;
    webShell(tx('provider'), `${steps}<div class="provider-account"><strong>${escapeProviderHtml(profile.displayName || profile.contactEmail || '')}</strong><span>${escapeProviderHtml(profile.contactEmail || '')}</span><span class="scope-badge">${escapeProviderHtml(webScope())}</span><button class="web-auth-button secondary" data-logout type="button">${tx('logout')}</button></div>${profile.businessName ? profileForm : profileForm}${locationForm}${offerSection}`);
    bind();
  };
  const bind = () => {
    document.querySelector('[data-profile-form]')?.addEventListener('submit', async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const message = document.querySelector('[data-profile-message]'); try { await webApi('/provider/profile', { method: 'PUT', body: JSON.stringify({ businessName: form.get('businessName'), sourceLocale: form.get('sourceLocale'), phone: form.get('phone'), website: form.get('website') }) }); await load(); render(); } catch { message.textContent = pt('providerError'); } });
    const locationInput = document.querySelector('[name="locationSearch"]');
    let locationSessionToken = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    let locationTimer;
    locationInput?.addEventListener('input', () => { window.clearTimeout(locationTimer); locationTimer = window.setTimeout(async () => { const input = locationInput.value.trim(); if (input.length < 3) return; try { const result = await webApi('/provider/location/autocomplete', { method: 'POST', body: JSON.stringify({ input, locale: currentWebLanguage(), sessionToken: locationSessionToken }) }); document.querySelector('[data-suggestions]').innerHTML = (result.suggestions || []).map((item) => `<button type="button" class="provider-suggestion" data-place-id="${escapeProviderHtml(item.placeId)}"><strong>${escapeProviderHtml(item.mainText || item.text)}</strong><small>${escapeProviderHtml(item.secondaryText)}</small></button>`).join(''); } catch (error) { document.querySelector('[data-location-message]').textContent = error.status === 'google_places_not_configured' ? pt('googleMissing') : pt('providerError'); } }, 250); });
    document.querySelector('[data-suggestions]')?.addEventListener('click', async (event) => { const button = event.target.closest('[data-place-id]'); if (!button) return; try { const result = await webApi('/provider/location/validate', { method: 'POST', body: JSON.stringify({ googlePlaceId: button.dataset.placeId, sourceLocale: currentWebLanguage(), sessionToken: locationSessionToken }) }); state.locationDraft = result.location; render(); } catch { document.querySelector('[data-location-message]').textContent = pt('providerError'); } });
    document.querySelector('[data-save-location]')?.addEventListener('click', async () => { if (!state.locationDraft && !state.profile?.location) return; const location = state.locationDraft || state.profile.location; const latitude = document.querySelector('[name="finalLatitude"]')?.value; const longitude = document.querySelector('[name="finalLongitude"]')?.value; const message = document.querySelector('[data-location-message]'); try { await webApi('/provider/location', { method: 'PUT', body: JSON.stringify({ googlePlaceId: location.googlePlaceId, finalLatitude: latitude ? Number(latitude) : undefined, finalLongitude: longitude ? Number(longitude) : undefined, sourceLocale: currentWebLanguage() }) }); state.locationDraft = null; await load(); render(); } catch { message.textContent = pt('providerError'); } });
    document.querySelector('[data-offer-form]')?.addEventListener('submit', async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const weekly = Object.fromEntries(providerDays.map((day) => { const open = form.get(`hours-open-${day}`); return [day, open ? [{ open, close: form.get(`hours-close-${day}`) }] : []]; })); const priceType = form.get('priceType'); const price = { type: priceType, currency: String(form.get('currency') || 'EUR').toUpperCase() }; if (['fixed', 'from'].includes(priceType)) price.amount = Number(form.get('amount')); if (priceType === 'range') { price.min = Number(form.get('min')); price.max = Number(form.get('max')); } const body = { title: form.get('title'), description: form.get('description'), sourceLocale: currentWebLanguage(), needKeys: form.getAll('needKeys'), price, availability: { weekly, exceptions: [] }, radiusMeters: Number(form.get('radiusMeters')), activate: true }; const id = event.currentTarget.dataset.offerId; const message = document.querySelector('[data-offer-message]') || document.querySelector('[data-dashboard-message]'); try { await webApi(id ? `/provider/offers/${id}` : '/provider/offers', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) }); state.editingOffer = null; await load(); render(); } catch { if (message) message.textContent = pt('providerError'); } });
    document.querySelector('[data-cancel-offer]')?.addEventListener('click', () => { state.editingOffer = null; render(); });
    document.querySelector('[data-new-offer]')?.addEventListener('click', () => { state.editingOffer = {}; render(); });
    document.querySelectorAll('[data-offer-action]').forEach((button) => button.addEventListener('click', async () => { const id = button.dataset.offerId; if (button.dataset.offerAction === 'edit') { state.editingOffer = state.offers.find((offer) => offer.id === id); render(); return; } try { await webApi(`/provider/offers/${id}/${button.dataset.offerAction}`, { method: 'POST', body: '{}' }); await load(); render(); } catch { const message = document.querySelector('[data-dashboard-message]'); if (message) message.textContent = pt('providerError'); } }));
    document.querySelector('[data-logout]')?.addEventListener('click', async () => { await webApi('/auth/logout', { method: 'POST' }, false).catch(() => {}); window.location.replace('/provider/login/'); });
  };
  try { await load(); render(); } catch { window.location.replace('/provider/login/'); }
}

async function renderStart(role) {
  if (role === 'provider') return renderProviderStart();
  const title = tx('admin');
  webShell(title, `<p class="web-auth-message" data-start-message>${tx('verify')}</p><div class="web-account" data-account></div><button class="web-auth-button" data-logout type="button">${tx('logout')}</button>`);
  try { const result = await webApi('/auth/me'); if (!result.user?.roles?.includes(role)) { document.querySelector('[data-start-message]').textContent = tx('denied'); return; } document.querySelector('[data-start-message]').textContent = tx('adminPending'); document.querySelector('[data-account]').innerHTML = `<strong>${escapeProviderHtml(result.user.displayName || result.user.email)}</strong><br>${escapeProviderHtml(result.user.email)}<br>${tx('role')}: ${escapeProviderHtml(result.user.roles.join(', '))}<br>${tx('scope')}: <span class="scope-badge">${escapeProviderHtml(result.scope)}</span>`; } catch { window.location.replace(`/${role}/login/`); return; }
  document.querySelector('[data-logout]')?.addEventListener('click', async () => { await webApi('/auth/logout', { method: 'POST' }, false).catch(() => {}); window.location.replace(`/${role}/login/`); });
}

function initializeWebAuth() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/provider/login') renderLogin('provider');
  if (path === '/admin/login') renderLogin('admin');
  if (path === '/auth/verify') renderVerify();
  if (path === '/provider') renderStart('provider');
  if (path === '/admin') renderStart('admin');
}

document.querySelectorAll('[data-language-button]').forEach((button) => {
  button.addEventListener('click', () => window.setTimeout(() => window.location.reload(), 0));
});

initializeWebAuth();
