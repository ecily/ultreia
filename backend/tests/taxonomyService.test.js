import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getNeedCategory,
  getNeedCategoryLabel,
  getNeedCategoryOptions,
  isValidNeedCategory,
  listNeedCategories,
  normalizeLocale,
} from '../src/services/taxonomyService.js';

const requiredMvpNeedKeys = [
  'sleep',
  'eat',
  'water',
  'grocery',
  'pharmacy',
  'medical',
  'cash',
  'stamp',
  'gear',
  'laundry',
  'sightseeing',
  'quiet_place',
  'transport',
];

describe('taxonomyService', () => {
  it('lists canonical MVP NeedCategory keys from shared taxonomy', () => {
    const keys = new Set(listNeedCategories().map((category) => category.key));

    for (const key of requiredMvpNeedKeys) {
      assert.equal(keys.has(key), true, `${key} should be present`);
    }
  });

  it('rejects legacy NeedCategory keys and keeps quiet_place canonical', () => {
    assert.equal(isValidNeedCategory('food'), false);
    assert.equal(isValidNeedCategory('medical_help'), false);
    assert.equal(isValidNeedCategory('quiet place'), false);
    assert.equal(isValidNeedCategory('quiet_place'), true);
    assert.equal(getNeedCategory('quiet_place')?.key, 'quiet_place');
  });

  it('returns localized labels for de, en, and es', () => {
    assert.equal(getNeedCategoryLabel('sleep', 'de'), 'Schlafen');
    assert.equal(getNeedCategoryLabel('sleep', 'en'), 'Sleep');
    assert.equal(getNeedCategoryLabel('sleep', 'es'), 'Dormir');
  });

  it('falls back to English for unsupported locales and null for unknown keys', () => {
    assert.equal(normalizeLocale('fr'), 'en');
    assert.equal(normalizeLocale('de-DE'), 'de');
    assert.equal(getNeedCategoryLabel('sleep', 'fr'), 'Sleep');
    assert.equal(getNeedCategoryLabel('missing', 'de'), null);
  });

  it('returns localized need options without duplicating category data', () => {
    const options = getNeedCategoryOptions('de');
    const sleep = options.find((option) => option.key === 'sleep');

    assert.equal(options.length, listNeedCategories().length);
    assert.deepEqual(sleep, { key: 'sleep', label: 'Schlafen' });
  });
});
