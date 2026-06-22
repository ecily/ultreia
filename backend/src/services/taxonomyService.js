import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_LOCALE = 'en';
const here = dirname(fileURLToPath(import.meta.url));
const taxonomyDir = join(here, '../../../shared/taxonomy');

function readTaxonomyJson(fileName) {
  return JSON.parse(readFileSync(join(taxonomyDir, fileName), 'utf8'));
}

const languages = readTaxonomyJson('languages.json');
const needCategories = readTaxonomyJson('needCategories.json');
const supportedLocales = new Set(languages.map((language) => language.code));
const needCategoriesByKey = new Map(needCategories.map((category) => [category.key, category]));

function cloneCategory(category) {
  return structuredClone(category);
}

export function normalizeLocale(locale) {
  if (typeof locale !== 'string' || locale.trim() === '') return DEFAULT_LOCALE;

  const primaryLocale = locale.trim().toLowerCase().split(/[-_]/)[0];
  return supportedLocales.has(primaryLocale) ? primaryLocale : DEFAULT_LOCALE;
}

export function listNeedCategories() {
  return needCategories.map(cloneCategory);
}

export function getNeedCategory(key) {
  const category = needCategoriesByKey.get(key);
  return category ? cloneCategory(category) : null;
}

export function isValidNeedCategory(key) {
  return needCategoriesByKey.has(key);
}

export function getNeedCategoryLabel(key, locale = DEFAULT_LOCALE) {
  const category = getNeedCategory(key);
  if (!category) return null;

  const normalizedLocale = normalizeLocale(locale);
  return category.labels[normalizedLocale] || category.labels[DEFAULT_LOCALE] || key;
}

export function getNeedCategoryOptions(locale = DEFAULT_LOCALE) {
  const normalizedLocale = normalizeLocale(locale);

  return needCategories.map((category) => ({
    key: category.key,
    label: category.labels[normalizedLocale] || category.labels[DEFAULT_LOCALE] || category.key,
  }));
}
