/** Node module-resolution hooks: maps '@/' to src/, and swaps react + the Supabase-backed API for test doubles. */
import { pathToFileURL, fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, '../../src');
const local = (name) => ({ url: pathToFileURL(path.join(here, name)).href, shortCircuit: true });

export async function resolve(specifier, context, next) {
  if (specifier === 'react') return local('react-shim.mjs');
  if (specifier === '@/lib/design-system') return local('fake-api.mjs');
  if (specifier.startsWith('@/')) {
    const base = path.join(SRC, specifier.slice(2));
    for (const candidate of [base, `${base}.js`, `${base}.jsx`]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return { url: pathToFileURL(candidate).href, shortCircuit: true };
    }
  }
  return next(specifier, context);
}
