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
    const parts = [diagnostic.method, diagnostic.httpStatus ? `HTTP ${diagnostic.httpStatus}` : null, diagnostic.scope ? `scope=${diagnostic.scope}` : null, diagnostic.providerStatus ? `providerStatus=${diagnostic.providerStatus}` : null, diagnostic.offerStatus ? `offerStatus=${diagnostic.offerStatus}` : null, diagnostic.errorCode ? `errorCode=${diagnostic.errorCode}` : null].filter(Boolean);
    return parts.join(' · ');
  }

  function component(key, item, showDiagnostic = false) {
    const value = normalized(item);
    const diagnostic = showDiagnostic ? diagnosticText(value.diagnostic) : '';
    return `<div class="provider-feedback provider-feedback-${value.state}" data-provider-feedback="${escapeHtml(key)}" data-feedback-state="${value.state}" role="${value.state === 'error' ? 'alert' : 'status'}"><span data-provider-feedback-message>${escapeHtml(value.message)}</span><small data-provider-diagnostic${diagnostic ? '' : ' hidden'}>${escapeHtml(diagnostic)}</small></div>`;
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
    if (diagnostic) {
      diagnostic.textContent = text;
      diagnostic.hidden = !text;
    }
  }

  window.UltreiaProviderFeedback = { component, update, states: [...states] };
})();
