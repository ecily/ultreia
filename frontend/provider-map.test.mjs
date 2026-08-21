import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('./provider-map.js', import.meta.url), 'utf8');
const authSource = await readFile(new URL('./web-auth.js', import.meta.url), 'utf8');
const window = {};
vm.runInNewContext(source, { window, Math });
const map = window.UltreiaProviderMap;

describe('provider map modes', () => {
  const labels = { markerMoved: 'Marker moved', markerUnchanged: 'Google position unchanged', markerTooFar: 'Too far' };

  it('keeps dashboard maps informational and edit maps draggable', () => {
    assert.equal(map.mapUiState({ editable: false, adjustmentMeters: 0, labels }).showAdjustment, false);
    assert.match(source, /draggable: editable/);
    assert.match(source, /editable \? '<span data-map-adjustment>/);
  });

  it('handles unchanged, accepted and over-limit edit feedback', () => {
    assert.equal(map.mapUiState({ editable: true, adjustmentMeters: 0, labels }).text, 'Google position unchanged');
    assert.equal(map.mapUiState({ editable: true, adjustmentMeters: 8.4, labels }).text, 'Marker moved: 8 m');
    assert.equal(map.mapUiState({ editable: true, adjustmentMeters: 25, labels }).tooFar, false);
    assert.equal(map.mapUiState({ editable: true, adjustmentMeters: 25.1, accepted: false, labels }).tooFar, true);
    assert.equal(map.mapUiState({ editable: true, adjustmentMeters: 25.1, accepted: false, labels }).text, 'Too far');
  });

  it('uses the persisted final position after reload', () => {
    const points = map.mapCoordinates({ latitude: 47, longitude: 15, finalLocation: { latitude: 47.0001, longitude: 15.0001 } });
    assert.equal(JSON.stringify(points.final), JSON.stringify({ lat: 47.0001, lng: 15.0001 }));
  });

  it('contains all new map copy in German, English and Spanish', () => {
    for (const key of ['markerUnchanged', 'markerTooFar', 'locationAdjust', 'mapLabel']) assert.ok((authSource.match(new RegExp(`${key}:`, 'g')) || []).length >= 3, `${key} must exist in DE/EN/ES`);
  });
});
