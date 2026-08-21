(function initializeProviderFeedback() {
  const states = new Set(['idle', 'saving', 'success', 'error']);

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function normalized(item = {}) {
    return { state: states.has(item.state) ? item.state : 'idle', message: item.message || '', diagnostic: item.diagnostic || null };
  }

  function diagnosticText(diagnostic) {
    if (!diagnostic) return '';
    const parts = [diagnostic.method, diagnostic.httpStatus ? `HTTP ${diagnostic.httpStatus}` : null, diagnostic.scope ? `scope=${diagnostic.scope}` : null, diagnostic.providerStatus ? `providerStatus=${diagnostic.providerStatus}` : null, diagnostic.offerStatus ? `offerStatus=${diagnostic.offerStatus}` : null, diagnostic.cloudinary ? `cloudinary=${diagnostic.cloudinary}` : null, diagnostic.errorCode ? `errorCode=${diagnostic.errorCode}` : null].filter(Boolean);
    return parts.join(' \u00b7 ');
  }

  function diagnosticLabel() {
    const language = typeof document === 'undefined' ? 'en' : document.documentElement.lang;
    return { de: 'Technikdetails', en: 'Technical details', es: 'Detalles t\u00e9cnicos' }[language] || 'Technical details';
  }

  function component(key, item, showDiagnostic = false) {
    const value = normalized(item);
    const diagnostic = showDiagnostic ? diagnosticText(value.diagnostic) : '';
    const diagnosticMarkup = showDiagnostic ? `<details class="provider-feedback-details" data-provider-feedback-details${diagnostic ? '' : ' hidden'}><summary>${diagnosticLabel()}</summary><small data-provider-diagnostic${diagnostic ? '' : ' hidden'}>${escapeHtml(diagnostic)}</small></details>` : '<small data-provider-diagnostic hidden></small>';
    return `<div class="provider-feedback provider-feedback-${value.state}" data-provider-feedback="${escapeHtml(key)}" data-feedback-state="${value.state}" role="${value.state === 'error' ? 'alert' : 'status'}"><span data-provider-feedback-message>${escapeHtml(value.message)}</span>${diagnosticMarkup}</div>`;
  }

  function update(key, item, showDiagnostic = false) {
    const value = normalized(item);
    const element = document.querySelector(`[data-provider-feedback="${key}"]`);
    if (!element) return;
    element.dataset.feedbackState = value.state;
    element.className = `provider-feedback provider-feedback-${value.state}`;
    element.setAttribute('role', value.state === 'error' ? 'alert' : 'status');
    const message = element.querySelector('[data-provider-feedback-message]');
    if (message) message.textContent = value.message;
    const diagnostic = element.querySelector('[data-provider-diagnostic]');
    const text = showDiagnostic ? diagnosticText(value.diagnostic) : '';
    const details = element.querySelector('[data-provider-feedback-details]');
    if (details) details.hidden = !text;
    if (diagnostic) {
      diagnostic.textContent = text;
      diagnostic.hidden = !text;
    }
  }

  window.UltreiaProviderFeedback = { component, update, states: [...states] };
})();
