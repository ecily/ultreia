import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('./provider-feedback.js', import.meta.url), 'utf8');

function feedback() {
  const window = {};
  vm.runInNewContext(source, { window });
  return window.UltreiaProviderFeedback;
}

describe('provider feedback component', () => {
  it('renders all supported feedback states and safe technical diagnostics', () => {
    const component = feedback();
    assert.deepEqual(Array.from(component.states).sort(), ['error', 'idle', 'saving', 'success']);
    const html = component.component('profile', { state: 'success', message: 'Anbieterdaten gespeichert.', diagnostic: { method: 'PUT /api/provider/profile', httpStatus: 200, scope: 'local_test', providerStatus: 'pending' } }, true);
    assert.match(html, /data-feedback-state="success"/);
    assert.match(html, /Anbieterdaten gespeichert\./);
    assert.match(html, /PUT \/api\/provider\/profile · HTTP 200 · scope=local_test · providerStatus=pending/);
    assert.doesNotMatch(html, /<script|onerror=/i);
  });

  it('falls back to idle for unknown states and hides diagnostics when disabled', () => {
    const html = feedback().component('location', { state: 'unknown', message: '<invalid>' }, false);
    assert.match(html, /data-feedback-state="idle"/);
    assert.match(html, /&lt;invalid&gt;/);
    assert.match(html, /data-provider-diagnostic hidden/);
  });
});
