import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DEFAULT_ENV_FILE = fileURLToPath(new URL('../../.env', import.meta.url));

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.length < 2) return trimmed;

  const first = trimmed.at(0);
  const last = trimmed.at(-1);
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

export function loadLocalEnvFile(filePath = DEFAULT_ENV_FILE, targetEnv = process.env) {
  if (!existsSync(filePath)) return { loaded: false };

  const raw = readFileSync(filePath, 'utf8');
  let count = 0;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;

    const key = trimmed.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (targetEnv[key] !== undefined) continue;

    targetEnv[key] = unquote(trimmed.slice(separator + 1));
    count += 1;
  }

  return { loaded: true, count };
}
