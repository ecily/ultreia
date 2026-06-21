import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_LANGUAGES = ['de', 'en', 'es'];
const here = dirname(fileURLToPath(import.meta.url));

const files = {
  languages: 'languages.json',
  needCategories: 'needCategories.json',
  placeTypes: 'placeTypes.json',
  contentTypes: 'contentTypes.json',
  trustLabels: 'trustLabels.json',
  pushSuitability: 'pushSuitability.json',
};

function fail(message) {
  console.error(`taxonomy validation error: ${message}`);
  process.exit(1);
}

async function readJson(name, file) {
  let raw;
  try {
    raw = await readFile(join(here, file), 'utf8');
  } catch (error) {
    fail(`${file} cannot be read: ${error.message}`);
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) fail(`${file} must contain a JSON array`);
    return parsed;
  } catch (error) {
    fail(`${file} is not valid JSON: ${error.message}`);
  }
}

function requireLocalizedMap(file, objectId, fieldName, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${file}:${objectId} missing ${fieldName} object`);
  }

  for (const language of REQUIRED_LANGUAGES) {
    if (typeof value[language] !== 'string' || value[language].trim() === '') {
      fail(`${file}:${objectId} missing ${fieldName}.${language}`);
    }
  }
}

function requireUnique(items, file, idField) {
  const seen = new Set();
  for (const item of items) {
    const id = item?.[idField];
    if (typeof id !== 'string' || id.trim() === '') {
      fail(`${file} item missing ${idField}`);
    }
    if (seen.has(id)) fail(`${file} duplicate ${idField}: ${id}`);
    seen.add(id);
  }
  return seen;
}

function validateLocalizedItems(items, file, idField) {
  for (const item of items) {
    const id = item[idField];
    if (item.labels !== undefined) requireLocalizedMap(file, id, 'labels', item.labels);
    if (item.description !== undefined) requireLocalizedMap(file, id, 'description', item.description);
    if (item.shortDescription !== undefined) {
      requireLocalizedMap(file, id, 'shortDescription', item.shortDescription);
    }
  }
}

function requireReference(allowed, file, objectId, fieldName, value) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${file}:${objectId} missing ${fieldName}`);
  }
  if (!allowed.has(value)) {
    fail(`${file}:${objectId} ${fieldName} references unknown key: ${value}`);
  }
}

const data = {};
for (const [name, file] of Object.entries(files)) {
  data[name] = await readJson(name, file);
}

const languageCodes = requireUnique(data.languages, files.languages, 'code');
for (const language of REQUIRED_LANGUAGES) {
  if (!languageCodes.has(language)) fail(`${files.languages} missing language: ${language}`);
}

for (const language of data.languages) {
  if (typeof language.label !== 'string' || language.label.trim() === '') {
    fail(`${files.languages}:${language.code} missing label`);
  }
  if (typeof language.nativeLabel !== 'string' || language.nativeLabel.trim() === '') {
    fail(`${files.languages}:${language.code} missing nativeLabel`);
  }
}

validateLocalizedItems(data.languages, files.languages, 'code');

const pushSuitabilityKeys = requireUnique(data.pushSuitability, files.pushSuitability, 'key');
const needCategoryKeys = requireUnique(data.needCategories, files.needCategories, 'key');
requireUnique(data.placeTypes, files.placeTypes, 'key');
requireUnique(data.contentTypes, files.contentTypes, 'key');
requireUnique(data.trustLabels, files.trustLabels, 'key');

validateLocalizedItems(data.pushSuitability, files.pushSuitability, 'key');
validateLocalizedItems(data.needCategories, files.needCategories, 'key');
validateLocalizedItems(data.placeTypes, files.placeTypes, 'key');
validateLocalizedItems(data.contentTypes, files.contentTypes, 'key');
validateLocalizedItems(data.trustLabels, files.trustLabels, 'key');

for (const item of data.needCategories) {
  requireReference(pushSuitabilityKeys, files.needCategories, item.key, 'pushSuitability', item.pushSuitability);
}

for (const item of data.placeTypes) {
  if (!Array.isArray(item.relatedNeeds) || item.relatedNeeds.length === 0) {
    fail(`${files.placeTypes}:${item.key} missing relatedNeeds`);
  }
  for (const need of item.relatedNeeds) {
    requireReference(needCategoryKeys, files.placeTypes, item.key, 'relatedNeeds', need);
  }
  requireReference(
    pushSuitabilityKeys,
    files.placeTypes,
    item.key,
    'defaultPushSuitability',
    item.defaultPushSuitability
  );
}

console.log('taxonomy validation ok');
