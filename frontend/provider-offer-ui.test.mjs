import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('./provider-offer-ui.js', import.meta.url), 'utf8');
const authSource = await readFile(new URL('./web-auth.js', import.meta.url), 'utf8');
const styleSource = await readFile(new URL('./provider.css', import.meta.url), 'utf8');
const window = {};
vm.runInNewContext(source, { window, structuredClone });
const ui = window.UltreiaProviderOfferUi;

describe('provider offer UI helpers', () => {
  const needs = [
    { key: 'eat', label: 'Essen', criticality: 'core' },
    { key: 'laundry', label: 'Wäsche', criticality: 'secondary' },
    { key: 'water', label: 'Wasser', criticality: 'core' },
  ];

  it('filters the central need data and keeps multi-selection input independent', () => {
    assert.deepEqual(ui.filterNeeds(needs, 'wäs'), [needs[1]]);
    assert.deepEqual(ui.popularNeeds(needs, 2), [needs[0], needs[1]]);
    assert.deepEqual(Array.from(ui.groupNeeds(needs).map((group) => group.group)), ['core', 'secondary']);
  });

  it('supports progressive price fields and opening-time presets', () => {
    assert.equal(JSON.stringify(ui.priceVisibility('free')), JSON.stringify({ amount: false, range: false, currency: false }));
    assert.equal(JSON.stringify(ui.priceVisibility('fixed')), JSON.stringify({ amount: true, range: false, currency: true }));
    assert.equal(JSON.stringify(ui.priceVisibility('range')), JSON.stringify({ amount: false, range: true, currency: true }));
    const weekdays = ui.presetWeekly('weekdays');
    assert.equal(weekdays.monday[0].open, '08:00');
    assert.equal(JSON.stringify(weekdays.saturday), '[]');
    assert.equal(ui.detectHoursPreset(weekdays), 'weekdays');
    assert.equal(ui.hasOpeningWindow(weekdays), true);
  });

  it('derives setup and onboarding state from backend-shaped data', () => {
    const profile = { businessName: 'Herberge', location: { formattedAddress: 'Gratwein' } };
    assert.equal(ui.isProviderSetupReady(profile), true);
    assert.equal(ui.isOnboardingComplete(profile, []), false);
    assert.equal(ui.isOnboardingComplete(profile, [{ id: 'offer-1' }]), true);
    assert.equal(ui.providerViewState(profile, []), 'dashboard_empty');
    assert.equal(ui.providerViewState(profile, [{ id: 'offer-1' }, { id: 'offer-2' }]), 'dashboard');
    assert.equal(ui.providerViewState({ businessName: 'Herberge' }, []), 'onboarding');
    assert.equal(ui.isProviderSetupReady({ businessName: 'Herberge' }), false);
  });

  it('keeps all need labels available for a compact expandable summary', () => {
    assert.equal(JSON.stringify(ui.summarizeNeedLabels(['A', 'B', 'C'])), JSON.stringify({ visible: ['A', 'B', 'C'], hidden: [] }));
    assert.equal(JSON.stringify(ui.summarizeNeedLabels(['A', 'B', 'C', 'D', 'E'])), JSON.stringify({ visible: ['A', 'B', 'C'], hidden: ['D', 'E'] }));
  });

  it('validates offer sections before submission', () => {
    assert.equal(ui.validateOfferDraft({ title: '', description: 'Long enough', needKeys: ['eat'], price: { type: 'free' }, availability: { weekly: {} }, radiusMeters: 250 }).field, 'title');
    assert.equal(ui.validateOfferDraft({ title: 'Offer', description: 'Long enough', needKeys: [], price: { type: 'free' }, availability: { weekly: {} }, radiusMeters: 250 }).field, 'needKeys');
    assert.equal(ui.validateOfferDraft({ title: 'Offer', description: 'Long enough', needKeys: ['eat'], price: { type: 'free' }, availability: { weekly: {} }, radiusMeters: 250 }).field, 'hours');
    assert.equal(ui.validateOfferDraft({ title: 'Offer', description: 'Long enough', needKeys: ['eat'], price: { type: 'free' }, availability: { weekly: { monday: [{ open: '08:00', close: '18:00' }] } }, radiusMeters: 1200 }).field, 'radiusMeters');
  });

  it('keeps the editor responsive and translates the new workflow', () => {
    assert.match(styleSource, /provider-offer-editor-layout/);
    assert.match(styleSource, /web-auth-card:has\(\.provider-panel\).*1100px/);
    assert.match(styleSource, /overflow-wrap: normal; word-break: normal/);
    assert.match(styleSource, /@media \(max-width: 900px\).*provider-offer-card.*grid-template-columns: minmax\(0, 1fr\)/);
    assert.match(styleSource, /@media \(max-width: 760px\).*grid-template-columns: 1fr/s);
    for (const key of ['offerIntro', 'priceFree', 'availabilityIntro', 'radiusHelp', 'saveChanges']) assert.ok((authSource.match(new RegExp(`${key}:`, 'g')) || []).length >= 3, `${key} must exist in DE/EN/ES`);
    assert.match(authSource, /data-offer-form novalidate/);
    assert.equal((authSource.match(/<textarea name="description"/g) || []).length, 1, 'the offer editor must have one description control');
    assert.equal((authSource.match(/<select/g) || []).length, (authSource.match(/<\/select>/g) || []).length, 'every generated select must close');
    assert.match(authSource, /if \(response\.status === 401[\s\S]*?webRefresh\(\)/);
    assert.match(authSource, /catch \{ window\.location\.replace\(`\/\$\{role\}\/login\//);
    assert.match(authSource, /providerOffersOverview/);
    assert.match(authSource, /function providerProfileLocationSummary\(profile\)/);
    assert.match(authSource, /data-edit-profile-location/);
    assert.match(authSource, /providerViewState\(state\.profile, state\.offers\)/);
    assert.match(authSource, /editingSetup/);
    assert.match(authSource, /data-cancel-offer/);
    assert.match(authSource, /function offerTodaySummary\(offer\)/);
    assert.match(authSource, /provider-offer-status status-\$\{escapeProviderHtml\(status\)\}/);
    assert.match(authSource, /class="web-auth-button" data-offer-action="edit"/);
    assert.match(authSource, /<details class="provider-offer-diagnostics">/);
    assert.match(authSource, /providerMoney\(price\.amount, price\.currency\)/);
    assert.match(authSource, /error\.status === 'access_not_available'/);
    assert.match(authSource, /lastConfirmedAt/);
    assert.match(authSource, /confirmationDueAt/);
    assert.match(authSource, /offer\.status === 'active'/);
    assert.match(authSource, /data-admin-panel/);
    assert.match(authSource, /data-photo-input/);
    assert.match(authSource, /data-photo-pending/);
    assert.match(authSource, /webApiUpload/);
    assert.match(authSource, /xhr\.upload\.onprogress/);
    assert.match(authSource, /lengthComputable/);
    assert.match(authSource, /status = 'processing'/);
    assert.match(authSource, /startExistingOfferPhotoUpload/);
    assert.match(authSource, /provider-photo-spinner/);
    assert.match(authSource, /data-photo-state-label/);
    assert.match(authSource, /data-photo-count/);
    assert.match(authSource, /data-retry-photo/);
    assert.doesNotMatch(authSource, /photoUploading\}\s+\$\{file\.name\}/);
    assert.match(authSource, /data-photo-remove/);
    assert.match(authSource, /data-photo-move/);
    assert.match(authSource, /draggable="true"/);
    assert.match(authSource, /data-photo-drag-handle/);
    assert.match(authSource, /is-drop-target/);
    assert.match(authSource, /dataTransfer\.setData\('text\/plain'/);
    assert.match(authSource, /catch \(error\) \{\n          await load\(\)\.catch/);
    assert.match(styleSource, /provider-photo-drag-handle/);
    assert.match(authSource, /querySelectorAll\('\[data-photo-list\] > \[data-photo-id\]'\)/);
    assert.match(authSource, /provider-offer-thumbnail/);
    assert.match(authSource, /captureProviderOfferEditorContext/);
    assert.match(authSource, /restoreProviderOfferEditorContext/);
    assert.match(authSource, /focus\(\{ preventScroll: true \}\)/);
    assert.match(authSource, /window\.scrollTo\(context\.left, context\.top\)/);
    assert.match(authSource, /button type="button" class="provider-inline-button" data-photo-move/);
    assert.match(authSource, /target\?\.focus\(\{ preventScroll: true \}\)/);
    assert.match(styleSource, /provider-photo-picker/);
    for (const key of ['photosHint', 'photoUpload', 'photoUploaded', 'photoUploadError', 'noPhotos', 'photoUploading', 'photoRetry', 'photoRetryAction', 'photoSelected', 'photoNumber', 'photoCount', 'titleImage', 'photoWait', 'photoUploadTimeout', 'photoUploadUnavailable', 'photoTransferComplete', 'photoProcessing', 'photoTransferError', 'photoProcessingError', 'photoReorderSaving', 'photoReorderSaved', 'photoReorderError']) assert.ok((authSource.match(new RegExp(`${key}:`, 'g')) || []).length >= 3, `${key} must exist in DE/EN/ES`);
  });
});
