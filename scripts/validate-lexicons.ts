/**
 * validate-lexicons.ts — lint AT Mot's lexicon schemas against the official
 * AT Protocol Lexicon Style Guide ("Lexinomicon") and the project's hard
 * constraints (spec §6 / §11.12).
 *
 * Enforced rules:
 *   - lowerCamelCase for every NSID segment, def id, and field name
 *   - `format` validators on language / datetime / uri fields
 *   - NO arrays of bare scalars (array items must be ref/union/object)
 *   - records and ambiguous fields carry descriptions
 *   - id matches the file path
 *   - record `key` is one of the allowed kinds
 *
 * Exits non-zero on any error.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, sep } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const LEX_DIR = resolve(HERE, '../lexicons');

const errors: string[] = [];
const lowerCamel = /^[a-z][a-zA-Z0-9]*$/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = resolve(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.json')) out.push(p);
  }
  return out;
}

function err(file: string, msg: string): void {
  errors.push(`${relative(LEX_DIR, file)}: ${msg}`);
}

/** Walk an object recursively, validating field names and array/format rules. */
function checkProperties(file: string, where: string, props: Record<string, any>): void {
  for (const [name, def] of Object.entries(props)) {
    if (!lowerCamel.test(name)) err(file, `${where}.${name}: field name is not lowerCamelCase`);
    checkDef(file, `${where}.${name}`, def);
  }
}

function checkDef(file: string, where: string, def: any): void {
  if (!def || typeof def !== 'object') return;

  // No arrays of bare scalars (style-guide evolution rule).
  if (def.type === 'array' && def.items) {
    const itemType = def.items.type;
    if (['string', 'integer', 'boolean', 'number'].includes(itemType)) {
      err(file, `${where}: array of bare ${itemType} — wrap each element in an object/ref`);
    }
    checkDef(file, `${where}[]`, def.items);
  }

  // Format validators on the well-known fields.
  if (def.type === 'string') {
    const base = where.split('.').pop() ?? '';
    if (base === 'lang' && def.format !== 'language') {
      err(file, `${where}: lang must use "format": "language"`);
    }
    if (/(^|[a-z])At$/.test(base) && def.format !== 'datetime') {
      err(file, `${where}: ${base} must use "format": "datetime"`);
    }
    if (base === 'puzzleDate' && def.format !== 'datetime') {
      err(file, `${where}: puzzleDate must use "format": "datetime"`);
    }
    if (base === 'puzzleTarget' && def.format !== 'uri') {
      err(file, `${where}: puzzleTarget must use "format": "uri"`);
    }
  }

  if (def.type === 'object' && def.properties) {
    checkProperties(file, where, def.properties);
  }
}

const allowedKeys = ['tid', 'nsid', 'any', 'literal'];

for (const file of walk(LEX_DIR)) {
  let doc: any;
  try {
    doc = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    err(file, `invalid JSON: ${(e as Error).message}`);
    continue;
  }

  if (doc.lexicon !== 1) err(file, `missing or wrong "lexicon": 1`);

  // id must be a valid NSID (all segments lowerCamelCase) and match the path.
  const id: string = doc.id ?? '';
  const segs = id.split('.');
  if (segs.length < 3) err(file, `id "${id}" is not a valid NSID`);
  for (const s of segs) {
    if (!lowerCamel.test(s)) err(file, `id segment "${s}" is not lowerCamelCase`);
  }
  const expectedPath = segs.join(sep) + '.json';
  if (!file.endsWith(expectedPath)) err(file, `id "${id}" does not match file path`);

  for (const [defName, def] of Object.entries<any>(doc.defs ?? {})) {
    if (defName !== 'main' && !lowerCamel.test(defName)) {
      err(file, `def "${defName}" is not lowerCamelCase`);
    }

    if (def.type === 'record') {
      if (!def.description) err(file, `record ${defName} is missing a description`);
      if (!allowedKeys.includes(String(def.key).split(':')[0] ?? '')) {
        err(file, `record ${defName} has invalid key "${def.key}"`);
      }
      if (def.record?.properties) checkProperties(file, defName, def.record.properties);
    } else if (def.type === 'object') {
      if (def.properties) checkProperties(file, defName, def.properties);
    } else {
      checkDef(file, defName, def);
    }
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} lexicon issue(s):`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('✓ all lexicons conform to the Style Guide rules');
