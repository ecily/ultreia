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

async function renderStart(role) {
  const title = role === 'admin' ? tx('admin') : tx('provider');
  webShell(title, `<p class="web-auth-message" data-start-message>${tx('verify')}</p><div class="web-account" data-account></div><button class="web-auth-button" data-logout type="button">${tx('logout')}</button>`);
  try {
    const result = await webApi('/auth/me');
    if (!result.user?.roles?.includes(role)) { document.querySelector('[data-start-message]').textContent = tx('denied'); return; }
    document.querySelector('[data-start-message]').textContent = role === 'admin' ? tx('adminPending') : tx('dashboardPending');
    document.querySelector('[data-account]').innerHTML = `<strong>${result.user.displayName || result.user.email}</strong><br>${result.user.email}<br>${tx('role')}: ${result.user.roles.join(', ')}<br>${tx('scope')}: <span class="scope-badge">${result.scope}</span>`;
  } catch { window.location.replace(`/${role}/login/`); return; }
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
