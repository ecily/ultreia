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

const scopeText = {
  de: { scopeProduction: 'Produktiv', scopeLocalTest: 'Lokaler Test', switchScope: 'Bereich wechseln', testBanner: 'TESTDATEN - NICHT PRODUKTIV', scopeSwitchError: 'Der Bereich konnte nicht gewechselt werden.' },
  en: { scopeProduction: 'Production', scopeLocalTest: 'Local test', switchScope: 'Switch area', testBanner: 'TEST DATA - NOT PRODUCTION', scopeSwitchError: 'The area could not be changed.' },
  es: { scopeProduction: 'Producción', scopeLocalTest: 'Prueba local', switchScope: 'Cambiar ámbito', testBanner: 'DATOS DE PRUEBA - NO PRODUCTIVO', scopeSwitchError: 'No se pudo cambiar el ámbito.' },
};

const providerText = {
  de: {
    providerStep: 'Anbieter', locationStep: 'Standort', offerStep: 'Erstes Angebot', businessName: 'Betriebsname', sourceLocale: 'Quellsprache', phone: 'Telefon (optional)', website: 'Website (optional)', continue: 'Weiter', saving: 'Wird gespeichert …', profileSaved: 'Anbieterdaten gespeichert.', locationSaved: 'Standort übernommen.', locationSelected: 'Standort ausgewählt.', offerPublished: 'Angebot veröffentlicht.', offerSaved: 'Angebot gespeichert.', offerPaused: 'Angebot pausiert.', offerResumed: 'Angebot wieder aktiviert.', offerConfirmed: 'Angebot für weitere 30 Tage bestätigt.', profileError: 'Anbieterdaten konnten nicht gespeichert werden.', locationError: 'Standort konnte nicht gespeichert werden.', offerPublishError: 'Angebot konnte nicht veröffentlicht werden.', offerSaveError: 'Angebot konnte nicht gespeichert werden.', offerActionError: 'Angebot konnte nicht aktualisiert werden.', googleMissing: 'Google Places ist noch nicht konfiguriert.', locationSearch: 'Adresse oder Ort suchen', locationAdjust: 'Marker-Korrektur bis 25 m möglich.', needs: 'Needs', title: 'Titel', description: 'Beschreibung', price: 'Preis', priceType: 'Preisart', amount: 'Betrag', min: 'Von', max: 'Bis', currency: 'Währung', hours: 'Öffnungszeiten', radius: 'Radius (Meter)', saveLocation: 'Standort übernehmen & weiter', publishOffer: 'Angebot veröffentlichen', editOffer: 'Angebot bearbeiten', cancel: 'Abbrechen', active: 'Aktiv', pending: 'Ausstehend', incomplete: 'Unvollständig', complete: 'Vollständig', confirmed: 'Bestätigt', missing: 'Fehlt', draft: 'Entwurf', paused: 'Pausiert', expired: 'Abgelaufen', blocked: 'Gesperrt', pause: 'Pausieren', resume: 'Reaktivieren', confirm: 'Bestätigen', noOffers: 'Noch kein Angebot angelegt.', offerLocked: 'Anbieter und Standort müssen zuerst abgeschlossen werden.', businessNameRequired: 'Betriebsname fehlt.', locationRequired: 'Bitte zuerst einen Google-Standort auswählen.', needRequired: 'Mindestens ein Need muss ausgewählt werden.', priceInvalid: 'Bitte prüfe die Preisangabe.', hoursInvalid: 'Mindestens ein gültiges Öffnungszeitfenster ist erforderlich.', radiusInvalid: 'Der Radius muss zwischen 50 und 1000 m liegen.', websiteInvalid: 'Bitte gib eine gültige Website ein.', technical: 'Technik'
  },
  en: {
    providerStep: 'Provider', locationStep: 'Location', offerStep: 'First offer', businessName: 'Business name', sourceLocale: 'Source language', phone: 'Phone (optional)', website: 'Website (optional)', continue: 'Continue', saving: 'Saving …', profileSaved: 'Provider details saved.', locationSaved: 'Location accepted.', locationSelected: 'Location selected.', offerPublished: 'Offer published.', offerSaved: 'Offer saved.', offerPaused: 'Offer paused.', offerResumed: 'Offer reactivated.', offerConfirmed: 'Offer confirmed for another 30 days.', profileError: 'Provider details could not be saved.', locationError: 'Location could not be saved.', offerPublishError: 'Offer could not be published.', offerSaveError: 'Offer could not be saved.', offerActionError: 'Offer could not be updated.', googleMissing: 'Google Places is not configured yet.', locationSearch: 'Search address or place', locationAdjust: 'You can adjust the marker by up to 25 m.', needs: 'Needs', title: 'Title', description: 'Description', price: 'Price', priceType: 'Price type', amount: 'Amount', min: 'From', max: 'To', currency: 'Currency', hours: 'Opening hours', radius: 'Radius (metres)', saveLocation: 'Accept location & continue', publishOffer: 'Publish offer', editOffer: 'Edit offer', cancel: 'Cancel', active: 'Active', pending: 'Pending', incomplete: 'Incomplete', complete: 'Complete', confirmed: 'Confirmed', missing: 'Missing', draft: 'Draft', paused: 'Paused', expired: 'Expired', blocked: 'Blocked', pause: 'Pause', resume: 'Reactivate', confirm: 'Confirm', noOffers: 'No offer yet.', offerLocked: 'Complete the provider and location steps first.', businessNameRequired: 'Business name is required.', locationRequired: 'Select a Google location first.', needRequired: 'Select at least one need.', priceInvalid: 'Please check the price.', hoursInvalid: 'At least one valid opening window is required.', radiusInvalid: 'The radius must be between 50 and 1000 metres.', websiteInvalid: 'Enter a valid website.', technical: 'Technical'
  },
  es: {
    providerStep: 'Proveedor', locationStep: 'Ubicación', offerStep: 'Primera oferta', businessName: 'Nombre del negocio', sourceLocale: 'Idioma original', phone: 'Teléfono (opcional)', website: 'Sitio web (opcional)', continue: 'Continuar', saving: 'Guardando …', profileSaved: 'Datos del proveedor guardados.', locationSaved: 'Ubicación aceptada.', locationSelected: 'Ubicación seleccionada.', offerPublished: 'Oferta publicada.', offerSaved: 'Oferta guardada.', offerPaused: 'Oferta pausada.', offerResumed: 'Oferta reactivada.', offerConfirmed: 'Oferta confirmada durante otros 30 días.', profileError: 'No se pudieron guardar los datos del proveedor.', locationError: 'No se pudo guardar la ubicación.', offerPublishError: 'No se pudo publicar la oferta.', offerSaveError: 'No se pudo guardar la oferta.', offerActionError: 'No se pudo actualizar la oferta.', googleMissing: 'Google Places aún no está configurado.', locationSearch: 'Buscar dirección o lugar', locationAdjust: 'Puedes ajustar el marcador hasta 25 m.', needs: 'Necesidades', title: 'Título', description: 'Descripción', price: 'Precio', priceType: 'Tipo de precio', amount: 'Importe', min: 'Desde', max: 'Hasta', currency: 'Moneda', hours: 'Horario', radius: 'Radio (metros)', saveLocation: 'Aceptar ubicación y continuar', publishOffer: 'Publicar oferta', editOffer: 'Editar oferta', cancel: 'Cancelar', active: 'Activa', pending: 'Pendiente', incomplete: 'Incompleto', complete: 'Completo', confirmed: 'Confirmada', missing: 'Falta', draft: 'Borrador', paused: 'Pausada', expired: 'Caducada', blocked: 'Bloqueada', pause: 'Pausar', resume: 'Reactivar', confirm: 'Confirmar', noOffers: 'Todavía no hay ofertas.', offerLocked: 'Completa primero los pasos de proveedor y ubicación.', businessNameRequired: 'Falta el nombre del negocio.', locationRequired: 'Selecciona primero una ubicación de Google.', needRequired: 'Selecciona al menos una necesidad.', priceInvalid: 'Revisa el precio.', hoursInvalid: 'Se necesita al menos un horario válido.', radiusInvalid: 'El radio debe estar entre 50 y 1000 m.', websiteInvalid: 'Introduce un sitio web válido.', technical: 'Técnica'
  },
};

providerText.de.providerStatus = 'Providerstatus';
providerText.en.providerStatus = 'Provider status';
providerText.es.providerStatus = 'Estado del proveedor';
providerText.de.offerTitleRequired = 'Titel fehlt.';
providerText.en.offerTitleRequired = 'Offer title is required.';
providerText.es.offerTitleRequired = 'Falta el título de la oferta.';
providerText.de.offerDescriptionRequired = 'Beschreibung fehlt.';
providerText.en.offerDescriptionRequired = 'Offer description is required.';
providerText.es.offerDescriptionRequired = 'Falta la descripción de la oferta.';

function pt(key) { return providerText[currentWebLanguage()][key] || providerText.en[key] || key; }

function feedbackItem(state, key) { return state.feedback[key] || { state: 'idle', message: '', diagnostic: null }; }

function providerFeedback(state, key) {
  return window.UltreiaProviderFeedback.component(key, feedbackItem(state, key), state.account?.scope === 'local_test' && state.account?.localTestAuthorized === true);
}

function setProviderFeedback(state, key, nextState, message, diagnostic = null) {
  state.feedback[key] = { state: nextState, message, diagnostic };
  window.UltreiaProviderFeedback.update(key, state.feedback[key], state.account?.scope === 'local_test' && state.account?.localTestAuthorized === true);
}

function setFormBusy(form, busy) {
  form?.querySelectorAll('button').forEach((button) => { button.disabled = busy; });
  if (form) form.dataset.saving = String(busy);
}

function clearFieldErrors(form) {
  form?.querySelectorAll('[aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));
  form?.querySelectorAll('[data-field-error]').forEach((error) => { error.textContent = ''; });
}

function setFieldError(form, field, message) {
  const target = form?.querySelector(`[name="${field}"]`) || (field === 'price' ? form?.querySelector('[name="priceType"]') : null) || (field === 'hours' ? form?.querySelector('input[type="time"]') : null);
  if (target) { target.setAttribute('aria-invalid', 'true'); target.focus(); }
  const error = form?.querySelector(`[data-field-error="${field}"]`);
  if (error) error.textContent = message;
}

const providerErrorMap = {
  'title is required': ['title', 'offerTitleRequired'],
  'title is invalid': ['title', 'offerTitleRequired'],
  'description is required': ['description', 'offerDescriptionRequired'],
  'description is invalid': ['description', 'offerDescriptionRequired'],
  'businessName is required': ['businessName', 'businessNameRequired'],
  'businessName is invalid': ['businessName', 'businessNameRequired'],
  'website is invalid': ['website', 'websiteInvalid'],
  'googlePlaceId is required': ['locationSearch', 'locationRequired'],
  google_place_invalid: ['locationSearch', 'locationRequired'],
  'needKeys is required': ['needKeys', 'needRequired'],
  'price is invalid': ['price', 'priceInvalid'],
  'price.currency is invalid': ['currency', 'priceInvalid'],
  'availability is required': ['hours', 'hoursInvalid'],
  'availability is invalid': ['hours', 'hoursInvalid'],
  'availability must contain an opening window': ['hours', 'hoursInvalid'],
  'radiusMeters is invalid': ['radiusMeters', 'radiusInvalid'],
};

function providerErrorDetails(error, fallbackKey) {
  const code = error.detail || error.status;
  const mapped = providerErrorMap[code];
  return { field: mapped?.[0] || null, message: mapped ? pt(mapped[1]) : pt(fallbackKey), code };
}

function diagnostic(method, scope, result, profile = null, offer = null, error = null) {
  return { method, httpStatus: result?._httpStatus || error?.httpStatus, scope, providerStatus: profile?.status, offerStatus: offer?.status, errorCode: error ? (error.detail || error.status) : null };
}

function currentWebLanguage() {
  return supportedLanguages.includes(window.localStorage.getItem(storageKey)) ? window.localStorage.getItem(storageKey) : getInitialLanguage();
}

function tx(key) { return webText[currentWebLanguage()][key] || scopeText[currentWebLanguage()][key]; }

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
  if (!response.ok) { const error = new Error(body.status || 'request_failed'); error.status = body.status || 'request_failed'; error.detail = body.error || null; error.httpStatus = response.status; throw error; }
  return { ...body, _httpStatus: response.status };
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
    <div class="provider-form-grid"><label>${pt('title')}<input name="title" required maxlength="120" value="${escapeProviderHtml(offer?.title || '')}"><span class="provider-field-error" data-field-error="title"></span></label><label>${pt('priceType')}<select name="priceType"><option value="free" ${price.type === 'free' ? 'selected' : ''}>free</option><option value="fixed" ${price.type === 'fixed' ? 'selected' : ''}>fixed</option><option value="from" ${price.type === 'from' ? 'selected' : ''}>from</option><option value="range" ${price.type === 'range' ? 'selected' : ''}>range</option><span class="provider-field-error" data-field-error="price"></span></label></div>
    <label>${pt('description')}<textarea name="description" required maxlength="1000">${escapeProviderHtml(offer?.description || '')}</textarea><span class="provider-field-error" data-field-error="description"></span></label>
    <fieldset><legend>${pt('needs')}</legend><div class="provider-need-grid">${needs.map((need) => `<label><input type="checkbox" name="needKeys" value="${escapeProviderHtml(need.key)}" ${selected.has(need.key) ? 'checked' : ''}> ${escapeProviderHtml(need.label)}</label>`).join('')}</div><span class="provider-field-error" data-field-error="needKeys"></span></fieldset>
    <div class="provider-form-grid"><label>${pt('amount')}<input name="amount" type="number" min="0" step="0.01" value="${escapeProviderHtml(price.amount ?? '')}"></label><label>${pt('min')}<input name="min" type="number" min="0" step="0.01" value="${escapeProviderHtml(price.min ?? '')}"></label><label>${pt('max')}<input name="max" type="number" min="0" step="0.01" value="${escapeProviderHtml(price.max ?? '')}"></label><label>${pt('currency')}<input name="currency" maxlength="3" value="${escapeProviderHtml(price.currency || 'EUR')}"><span class="provider-field-error" data-field-error="currency"></span></label></div>
    <fieldset><legend>${pt('hours')}</legend><div class="provider-hours-grid">${hours}</div><span class="provider-field-error" data-field-error="hours"></span></fieldset>
    <label>${pt('radius')}<input name="radiusMeters" type="number" min="50" max="1000" step="50" value="${escapeProviderHtml(offer?.radiusMeters || 250)}"><span class="provider-field-error" data-field-error="radiusMeters"></span></label>
    <button class="web-auth-button" type="submit">${offer ? pt('editOffer') : pt('publishOffer')}</button>${offer ? `<button class="web-auth-button secondary" data-cancel-offer type="button">${pt('cancel')}</button>` : ''}
  </form>`;
}

async function renderProviderStart() {
  const state = { account: null, profile: null, offers: [], needs: [], locationDraft: null, editingOffer: null, feedback: { profile: { state: 'idle' }, location: { state: 'idle' }, offer: { state: 'idle' } } };
  const load = async () => {
    const accountResult = await webApi('/auth/me');
    window.sessionStorage.setItem(WEB_SCOPE_KEY, accountResult.scope || 'production');
    state.account = accountResult;
    const [profileResult, needsResult, offersResult] = await Promise.all([webApi('/provider/profile'), webApi(`/needs?locale=${currentWebLanguage()}`), webApi('/provider/offers')]);
    state.profile = profileResult.profile; state.needs = needsResult.items || []; state.offers = offersResult.items || [];
  };
  const render = () => {
    const profile = state.profile || {};
    const scope = state.account?.scope || webScope();
    const steps = `<div class="provider-stepper"><span class="${profile.businessName ? 'is-done' : 'is-current'}">${profile.businessName ? '✓ ' : ''}1. ${pt('providerStep')}</span><span class="${profile.location ? 'is-done' : profile.businessName ? 'is-current' : ''}">${profile.location ? '✓ ' : ''}2. ${pt('locationStep')}</span><span class="${profile.status === 'active' ? 'is-current' : ''}">${profile.status === 'active' ? '' : '3. '}${pt('offerStep')}</span></div>`;
    const statusPanel = `<div class="provider-status-panel"><div><span>${pt('businessName')}</span><strong>${profile.businessName ? pt('complete') : pt('incomplete')}</strong></div><div><span>${pt('locationStep')}</span><strong>${profile.location ? pt('confirmed') : pt('missing')}</strong></div><div><span>${pt('providerStatus')}</span><strong>${escapeProviderHtml(pt(profile.status || 'pending'))}</strong></div></div>`;
    const profileForm = `<section class="provider-panel"><p class="section-label">1. ${pt('providerStep')}</p><h2>${pt('businessName')}</h2><form class="provider-form" data-profile-form><label>${pt('businessName')}<input name="businessName" required maxlength="120" value="${escapeProviderHtml(profile.businessName)}"><span class="provider-field-error" data-field-error="businessName"></span></label><label>${pt('sourceLocale')}<select name="sourceLocale"><option value="de" ${profile.sourceLocale === 'de' ? 'selected' : ''}>DE</option><option value="en" ${profile.sourceLocale === 'en' ? 'selected' : ''}>EN</option><option value="es" ${profile.sourceLocale === 'es' ? 'selected' : ''}>ES</option></select></label><label>${pt('phone')}<input name="phone" value="${escapeProviderHtml(profile.phone)}"></label><label>${pt('website')}<input name="website" type="url" value="${escapeProviderHtml(profile.website)}"><span class="provider-field-error" data-field-error="website"></span></label><p>${escapeProviderHtml(profile.contactEmail || '')}</p>${providerFeedback(state, 'profile')}<button class="web-auth-button" type="submit">${pt('continue')}</button></form></section>`;
    const location = state.locationDraft || profile.location;
    const locationForm = `<section class="provider-panel"><p class="section-label">2. ${pt('locationStep')}</p><h2>${pt('locationSearch')}</h2><form class="provider-form" data-location-form><label>${pt('locationSearch')}<input name="locationSearch" autocomplete="off" required><span class="provider-field-error" data-field-error="locationSearch"></span><div class="provider-suggestions" data-suggestions></div></label><p class="provider-location-help">${pt('locationAdjust')}</p><div class="provider-map-preview" data-map-preview>${location ? `<span class="provider-map-marker">+</span><strong>${escapeProviderHtml(location.formattedAddress)}</strong><small>${Number(location.latitude).toFixed(6)}, ${Number(location.longitude).toFixed(6)}</small>` : '<span>Google Place</span>'}</div>${location ? `<div class="provider-form-grid"><label>Latitude<input name="finalLatitude" type="number" step="0.000001" value="${location.latitude}"></label><label>Longitude<input name="finalLongitude" type="number" step="0.000001" value="${location.longitude}"></label></div>` : ''}${providerFeedback(state, 'location')}<button class="web-auth-button" data-save-location type="button" ${location ? '' : 'disabled'}>${pt('saveLocation')}</button></form></section>`;
    const offerSection = profile.status === 'active' && profile.location ? `<section class="provider-panel"><p class="section-label">3. ${pt('offerStep')}</p><h2>${state.editingOffer ? pt('editOffer') : pt('offerStep')}</h2>${providerFeedback(state, 'offer')}${state.editingOffer || state.offers.length === 0 ? providerOfferForm(state.editingOffer, state.needs) : ''}<div class="provider-offer-list">${state.offers.length === 0 ? `<p>${pt('noOffers')}</p>` : state.offers.map((offer) => `<article class="provider-offer-card"><div><strong>${escapeProviderHtml(offer.title)}</strong><span class="scope-badge">${escapeProviderHtml(pt(offer.status) || offer.status)}</span><p>${escapeProviderHtml(offer.description)}</p><small>${escapeProviderHtml(offer.needKeys.join(', '))} · ${offer.radiusMeters} m</small></div><div class="provider-actions"><button class="web-auth-button secondary" data-offer-action="edit" data-offer-id="${offer.id}" type="button">${pt('editOffer')}</button>${offer.status === 'active' ? `<button class="web-auth-button secondary" data-offer-action="pause" data-offer-id="${offer.id}" type="button">${pt('pause')}</button>` : `<button class="web-auth-button secondary" data-offer-action="resume" data-offer-id="${offer.id}" type="button">${pt('resume')}</button>`}<button class="web-auth-button secondary" data-offer-action="confirm" data-offer-id="${offer.id}" type="button">${pt('confirm')}</button></div></article>`).join('')}</div>${state.offers.length > 0 && !state.editingOffer ? `<button class="web-auth-button" data-new-offer type="button">${pt('publishOffer')}</button>` : ''}</section>` : `<section class="provider-panel"><p class="section-label">3. ${pt('offerStep')}</p><p>${pt('offerLocked')}</p></section>`;
    const scopeSwitcher = state.account?.localTestAuthorized ? `<div class="provider-scope-switch"><span>${tx('switchScope')}</span><button class="web-auth-button secondary" data-scope-switch="production" type="button" ${scope === 'production' ? 'disabled' : ''}>${tx('scopeProduction')}</button><button class="web-auth-button secondary" data-scope-switch="local_test" type="button" ${scope === 'local_test' ? 'disabled' : ''}>${tx('scopeLocalTest')}</button></div>` : '';
    const testBanner = scope === 'local_test' ? `<div class="provider-test-banner" role="status">${tx('testBanner')}</div>` : '';
    webShell(tx('provider'), `${testBanner}${steps}<div class="provider-account"><strong>${escapeProviderHtml(profile.displayName || profile.contactEmail || '')}</strong><span>${escapeProviderHtml(profile.contactEmail || '')}</span><span class="scope-badge">${escapeProviderHtml(scope)}</span>${scopeSwitcher}<button class="web-auth-button secondary" data-logout type="button">${tx('logout')}</button></div>${statusPanel}${profileForm}${locationForm}${offerSection}`);
    bind();
  };
  const bind = () => {
    document.querySelectorAll('[data-scope-switch]').forEach((button) => button.addEventListener('click', async () => { try { await webApi('/auth/session/switch-scope', { method: 'POST', body: JSON.stringify({ scope: button.dataset.scopeSwitch }) }); window.sessionStorage.setItem(WEB_SCOPE_KEY, button.dataset.scopeSwitch); window.location.reload(); } catch { const message = document.querySelector('[data-dashboard-message]') || document.querySelector('[data-location-message]'); if (message) message.textContent = tx('scopeSwitchError'); } }));
    document.querySelector('[data-profile-form]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formElement = event.currentTarget;
      clearFieldErrors(formElement);
      const form = new FormData(formElement);
      const businessName = String(form.get('businessName') || '').trim();
      const website = String(form.get('website') || '').trim();
      if (businessName.length < 2) { setFieldError(formElement, 'businessName', pt('businessNameRequired')); return; }
      if (website && !/^https?:\/\/[^\s]+$/i.test(website)) { setFieldError(formElement, 'website', pt('websiteInvalid')); return; }
      const scope = state.account?.scope || webScope();
      setProviderFeedback(state, 'profile', 'saving', pt('saving'));
      setFormBusy(formElement, true);
      try {
        const result = await webApi('/provider/profile', { method: 'PUT', body: JSON.stringify({ businessName, sourceLocale: form.get('sourceLocale'), phone: form.get('phone'), website }) });
        state.feedback.profile = { state: 'success', message: pt('profileSaved'), diagnostic: diagnostic('PUT /api/provider/profile', scope, result, result.profile) };
        await load();
        render();
        document.querySelector('[name="locationSearch"]')?.focus();
      } catch (error) {
        const details = providerErrorDetails(error, 'profileError');
        setFieldError(formElement, details.field, details.message);
        setProviderFeedback(state, 'profile', 'error', details.message, diagnostic('PUT /api/provider/profile', scope, null, null, null, error));
      } finally { setFormBusy(formElement, false); }
    });
    const locationInput = document.querySelector('[name="locationSearch"]');
    const autocomplete = window.UltreiaProviderAutocomplete?.create({
      fetchSuggestions: async ({ input, locale, sessionToken, signal }) => { const result = await webApi('/provider/location/autocomplete', { method: 'POST', signal, body: JSON.stringify({ input, locale, sessionToken }) }); return result.suggestions || []; },
      onResults: (suggestions) => { document.querySelector('[data-suggestions]').innerHTML = suggestions.map((item) => `<button type="button" class="provider-suggestion" data-place-id="${escapeProviderHtml(item.placeId)}"><strong>${escapeProviderHtml(item.mainText || item.text)}</strong><small>${escapeProviderHtml(item.secondaryText)}</small></button>`).join(''); },
      onError: (error) => { const message = error.status === 'google_places_not_configured' ? pt('googleMissing') : pt('locationError'); setProviderFeedback(state, 'location', 'error', message, diagnostic('POST /api/provider/location/autocomplete', state.account?.scope || webScope(), null, null, null, error)); },
    });
    locationInput?.addEventListener('input', () => autocomplete?.schedule(locationInput.value, currentWebLanguage()));
    document.querySelector('[data-suggestions]')?.addEventListener('click', async (event) => { const button = event.target.closest('[data-place-id]'); if (!button) return; autocomplete?.cancel(); const form = document.querySelector('[data-location-form]'); setProviderFeedback(state, 'location', 'saving', pt('saving')); try { const result = await webApi('/provider/location/validate', { method: 'POST', body: JSON.stringify({ googlePlaceId: button.dataset.placeId, sourceLocale: currentWebLanguage(), sessionToken: autocomplete?.sessionToken }) }); state.locationDraft = result.location; state.feedback.location = { state: 'success', message: pt('locationSelected'), diagnostic: diagnostic('POST /api/provider/location/validate', state.account?.scope || webScope(), result, state.profile) }; render(); } catch (error) { const details = providerErrorDetails(error, 'locationError'); setFieldError(form, details.field, details.message); setProviderFeedback(state, 'location', 'error', details.message, diagnostic('POST /api/provider/location/validate', state.account?.scope || webScope(), null, null, null, error)); } });
    document.querySelector('[data-save-location]')?.addEventListener('click', async (event) => { const formElement = event.currentTarget.closest('[data-location-form]'); clearFieldErrors(formElement); if (!state.locationDraft && !state.profile?.location) { setFieldError(formElement, 'locationSearch', pt('locationRequired')); return; } const location = state.locationDraft || state.profile.location; const latitude = document.querySelector('[name="finalLatitude"]')?.value; const longitude = document.querySelector('[name="finalLongitude"]')?.value; const scope = state.account?.scope || webScope(); setProviderFeedback(state, 'location', 'saving', pt('saving')); setFormBusy(formElement, true); try { const result = await webApi('/provider/location', { method: 'PUT', body: JSON.stringify({ googlePlaceId: location.googlePlaceId, finalLatitude: latitude ? Number(latitude) : undefined, finalLongitude: longitude ? Number(longitude) : undefined, sourceLocale: currentWebLanguage(), sessionToken: autocomplete?.sessionToken }) }); state.locationDraft = null; state.feedback.location = { state: 'success', message: pt('locationSaved'), diagnostic: diagnostic('PUT /api/provider/location', scope, result, result.profile) }; await load(); render(); document.querySelector('[data-offer-form]')?.querySelector('[name="title"]')?.focus(); } catch (error) { const details = providerErrorDetails(error, 'locationError'); setFieldError(formElement, details.field, details.message); setProviderFeedback(state, 'location', 'error', details.message, diagnostic('PUT /api/provider/location', scope, null, null, null, error)); } finally { setFormBusy(formElement, false); } });
    document.querySelector('[data-offer-form]')?.addEventListener('submit', async (event) => { event.preventDefault(); const formElement = event.currentTarget; clearFieldErrors(formElement); const form = new FormData(formElement); const weekly = Object.fromEntries(providerDays.map((day) => { const open = form.get(`hours-open-${day}`); return [day, open ? [{ open, close: form.get(`hours-close-${day}`) }] : []]; })); const priceType = form.get('priceType'); const price = { type: priceType, currency: String(form.get('currency') || 'EUR').toUpperCase() }; if (['fixed', 'from'].includes(priceType)) price.amount = Number(form.get('amount')); if (priceType === 'range') { price.min = Number(form.get('min')); price.max = Number(form.get('max')); } const body = { title: String(form.get('title') || '').trim(), description: String(form.get('description') || '').trim(), sourceLocale: currentWebLanguage(), needKeys: form.getAll('needKeys'), price, availability: { weekly, exceptions: [] }, radiusMeters: Number(form.get('radiusMeters')), activate: true }; const validation = body.title.length < 2 ? ['title', pt('offerTitleRequired')] : body.description.length < 2 ? ['description', pt('offerDescriptionRequired')] : body.needKeys.length === 0 ? ['needKeys', pt('needRequired')] : !['free', 'donativo', 'on_request'].includes(priceType) && (!Number.isFinite(price.amount) && priceType !== 'range') ? ['price', pt('priceInvalid')] : priceType === 'range' && (!Number.isFinite(price.min) || !Number.isFinite(price.max) || price.max < price.min) ? ['price', pt('priceInvalid')] : !Object.values(weekly).some((windows) => windows.length && windows[0].open && windows[0].close && windows[0].open !== windows[0].close) ? ['hours', pt('hoursInvalid')] : (!Number.isInteger(body.radiusMeters) || body.radiusMeters < 50 || body.radiusMeters > 1000) ? ['radiusMeters', pt('radiusInvalid')] : null; if (validation) { setFieldError(formElement, validation[0], validation[1]); return; } const scope = state.account?.scope || webScope(); const id = formElement.dataset.offerId; const endpoint = id ? `/provider/offers/${id}` : '/provider/offers'; setProviderFeedback(state, 'offer', 'saving', pt('saving')); setFormBusy(formElement, true); try { const result = await webApi(endpoint, { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) }); const offer = result.offer; state.feedback.offer = { state: 'success', message: body.activate ? pt('offerPublished') : pt('offerSaved'), diagnostic: diagnostic(`${id ? 'PUT' : 'POST'} /api/provider/offers${id ? `/${id}` : ''}`, scope, result, state.profile, offer) }; state.editingOffer = null; await load(); render(); } catch (error) { const details = providerErrorDetails(error, id ? 'offerSaveError' : 'offerPublishError'); setFieldError(formElement, details.field, details.message); setProviderFeedback(state, 'offer', 'error', details.message, diagnostic(`${id ? 'PUT' : 'POST'} /api/provider/offers${id ? `/${id}` : ''}`, scope, null, null, null, error)); } finally { setFormBusy(formElement, false); } });
    document.querySelector('[data-cancel-offer]')?.addEventListener('click', () => { state.editingOffer = null; render(); });
    document.querySelector('[data-new-offer]')?.addEventListener('click', () => { state.editingOffer = {}; render(); });
    document.querySelectorAll('[data-offer-action]').forEach((button) => button.addEventListener('click', async () => { const id = button.dataset.offerId; const action = button.dataset.offerAction; if (action === 'edit') { state.editingOffer = state.offers.find((offer) => offer.id === id); render(); return; } const scope = state.account?.scope || webScope(); setProviderFeedback(state, 'offer', 'saving', pt('saving')); setFormBusy(button.closest('.provider-panel'), true); try { const result = await webApi(`/provider/offers/${id}/${action}`, { method: 'POST', body: '{}' }); const messages = { pause: 'offerPaused', resume: 'offerResumed', confirm: 'offerConfirmed' }; state.feedback.offer = { state: 'success', message: pt(messages[action] || 'offerSaved'), diagnostic: diagnostic(`POST /api/provider/offers/${id}/${action}`, scope, result, state.profile, result.offer) }; await load(); render(); } catch (error) { const details = providerErrorDetails(error, 'offerActionError'); setProviderFeedback(state, 'offer', 'error', details.message, diagnostic(`POST /api/provider/offers/${id}/${action}`, scope, null, null, null, error)); } finally { setFormBusy(button.closest('.provider-panel'), false); } }));
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
