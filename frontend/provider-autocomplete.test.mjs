import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('./provider-autocomplete.js', import.meta.url), 'utf8');

function controller(options) {
  const window = { crypto: { randomUUID: () => 'test-session' }, setTimeout, clearTimeout, AbortController };
  vm.runInNewContext(source, { window });
  return window.UltreiaProviderAutocomplete.create(options);
}

function tick() { return new Promise((resolve) => setTimeout(resolve, 10)); }

describe('provider autocomplete controller', () => {
  it('keeps full input and ignores a slower stale response', async () => {
    const calls = [];
    const results = [];
    const deferred = [];
    const autocomplete = controller({
      delayMs: 0,
      fetchSuggestions: ({ input }) => { calls.push(input); return new Promise((resolve) => deferred.push(resolve)); },
      onResults: (items) => results.push(items),
      onError: () => assert.fail('unexpected autocomplete error'),
    });

    autocomplete.schedule('8111 Gratwein-Straßengel', 'de');
    await tick();
    autocomplete.schedule('8111 Gratwein-Straßengel, Hauptplatz 12', 'de');
    await tick();
    assert.deepEqual(calls, ['8111 Gratwein-Straßengel', '8111 Gratwein-Straßengel, Hauptplatz 12']);
    deferred[0](['old']);
    deferred[1](['new']);
    await tick();
    assert.deepEqual(results, [['new']]);
  });

  it('does not request below the minimum input length', async () => {
    let calls = 0;
    const autocomplete = controller({ delayMs: 0, fetchSuggestions: async () => { calls += 1; return []; }, onResults: () => {}, onError: () => {} });
    autocomplete.schedule('81', 'de');
    await tick();
    assert.equal(calls, 0);
  });
});
