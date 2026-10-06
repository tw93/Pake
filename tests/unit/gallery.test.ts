import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import schema from '../../gallery/schema.json';

const APPS_DIR = path.resolve(__dirname, '../../gallery/apps');

type Schema = Record<string, any>;

// A small validator for the JSON Schema keywords gallery/schema.json uses, so
// the schema file stays the single source of truth without a new dependency.
// Unknown keywords fail loudly instead of being silently ignored.
const KNOWN_KEYWORDS = new Set([
  '$schema',
  '$id',
  '$ref',
  'title',
  'description',
  'definitions',
  'type',
  'properties',
  'required',
  'additionalProperties',
  'minProperties',
  'enum',
  'pattern',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'items',
  'minItems',
  'uniqueItems',
]);

function resolveRef(ref: string): Schema {
  const match = /^#\/definitions\/([A-Za-z0-9_-]+)$/.exec(ref);
  if (!match) throw new Error(`unsupported $ref ${ref}`);
  return (schema as Schema).definitions[match[1]];
}

function typeOf(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number';
  }
  return typeof value;
}

function validate(value: unknown, node: Schema, at = '$'): string[] {
  for (const key of Object.keys(node)) {
    if (!KNOWN_KEYWORDS.has(key)) {
      throw new Error(`validator does not support keyword "${key}" at ${at}`);
    }
  }
  if (node.$ref) return validate(value, resolveRef(node.$ref), at);

  const errors: string[] = [];
  const actual = typeOf(value);
  if (node.type) {
    const ok =
      actual === node.type || (node.type === 'number' && actual === 'integer');
    if (!ok) return [`${at}: expected ${node.type}, got ${actual}`];
  }
  if (node.enum && !node.enum.includes(value)) {
    errors.push(`${at}: ${JSON.stringify(value)} is not one of ${node.enum}`);
  }
  if (typeof value === 'string') {
    if (node.pattern && !new RegExp(node.pattern).test(value)) {
      errors.push(`${at}: "${value}" does not match ${node.pattern}`);
    }
    if (node.minLength !== undefined && value.length < node.minLength) {
      errors.push(`${at}: shorter than ${node.minLength}`);
    }
    if (node.maxLength !== undefined && value.length > node.maxLength) {
      errors.push(`${at}: longer than ${node.maxLength}`);
    }
  }
  if (typeof value === 'number') {
    if (node.minimum !== undefined && value < node.minimum) {
      errors.push(`${at}: below ${node.minimum}`);
    }
    if (node.maximum !== undefined && value > node.maximum) {
      errors.push(`${at}: above ${node.maximum}`);
    }
  }
  if (Array.isArray(value)) {
    if (node.minItems !== undefined && value.length < node.minItems) {
      errors.push(`${at}: fewer than ${node.minItems} items`);
    }
    if (node.uniqueItems && new Set(value).size !== value.length) {
      errors.push(`${at}: items are not unique`);
    }
    if (node.items) {
      value.forEach((item, i) =>
        errors.push(...validate(item, node.items, `${at}[${i}]`)),
      );
    }
  }
  if (actual === 'object') {
    const obj = value as Record<string, unknown>;
    const props: Schema = node.properties ?? {};
    for (const key of node.required ?? []) {
      if (!(key in obj)) errors.push(`${at}: missing "${key}"`);
    }
    if (
      node.minProperties !== undefined &&
      Object.keys(obj).length < node.minProperties
    ) {
      errors.push(`${at}: fewer than ${node.minProperties} properties`);
    }
    for (const [key, child] of Object.entries(obj)) {
      if (props[key]) {
        errors.push(...validate(child, props[key], `${at}.${key}`));
      } else if (node.additionalProperties === false) {
        errors.push(`${at}: unknown field "${key}"`);
      }
    }
  }
  return errors;
}

const recipeFiles = fs
  .readdirSync(APPS_DIR)
  .filter((file) => file.endsWith('.json'))
  .sort();

const recipes = recipeFiles.map((file) => ({
  file,
  recipe: JSON.parse(fs.readFileSync(path.join(APPS_DIR, file), 'utf8')),
}));

const validRecipe = {
  id: 'example',
  version: 1,
  name: { en: 'Example', 'zh-Hans': '示例' },
  url: 'https://example.com/',
  category: 'reading',
  description: { en: 'An example site', 'zh-Hans': '一个示例网站' },
  icon: 'https://example.com/apple-touch-icon.png',
};

describe('gallery schema validator', () => {
  it('accepts a minimal recipe', () => {
    expect(validate(validRecipe, schema)).toEqual([]);
  });

  it.each([
    ['a missing locale', { name: { en: 'Example' } }, 'missing "zh-Hans"'],
    ['an uppercase id', { id: 'Example' }, 'does not match'],
    ['an http url', { url: 'http://example.com/' }, 'does not match'],
    ['an unknown category', { category: 'games' }, 'is not one of'],
    ['a fractional version', { version: 1.5 }, 'expected integer'],
    ['an unknown window field', { window: { title: 'x' } }, 'unknown field'],
    ['an out-of-range zoom', { window: { zoom: 400 } }, 'above 200'],
    ['an inject path', { inject_css: '../evil.css' }, 'does not match'],
    ['an unknown top-level field', { homepage: 'x' }, 'unknown field'],
  ])('rejects %s', (_, patch, message) => {
    const errors = validate({ ...validRecipe, ...patch }, schema);
    expect(errors.join('\n')).toContain(message);
  });
});

describe('gallery recipes', () => {
  it('has recipes to check', () => {
    expect(recipes.length).toBeGreaterThan(0);
  });

  it.each(recipes)('$file matches the schema', ({ recipe }) => {
    expect(validate(recipe, schema)).toEqual([]);
  });

  it.each(recipes)('$file is named after its id', ({ file, recipe }) => {
    expect(file).toBe(`${recipe.id}.json`);
  });

  it('uses unique ids and names', () => {
    const ids = recipes.map(({ recipe }) => recipe.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const locale of ['en', 'zh-Hans']) {
      const names = recipes.map(({ recipe }) =>
        recipe.name[locale].toLowerCase(),
      );
      expect(new Set(names).size, locale).toBe(names.length);
    }
  });

  // The apps match an address to a recipe by host, so a second recipe on the
  // same host would never be found.
  it('uses one recipe per site host', () => {
    const hosts = recipes.map(({ recipe }) =>
      new URL(recipe.url).hostname.replace(/^www\./, ''),
    );
    expect(new Set(hosts).size).toBe(hosts.length);
  });

  it.each(recipes)('$file uses https urls', ({ recipe }) => {
    expect(new URL(recipe.url).protocol).toBe('https:');
    expect(new URL(recipe.icon).protocol).toBe('https:');
  });

  it.each(recipes)('$file has text in both locales', ({ recipe }) => {
    for (const field of ['name', 'description']) {
      for (const locale of ['en', 'zh-Hans']) {
        const text: string = recipe[field][locale];
        expect(text.trim(), `${field}.${locale}`).toBe(text);
        expect(text.length, `${field}.${locale}`).toBeGreaterThan(0);
        expect(text, `${field}.${locale}`).not.toMatch(/[—→↓]/);
        if (field === 'description') {
          expect(text, `${field}.${locale}`).not.toMatch(/[.。]$/);
        }
      }
    }
  });

  it.each(recipes)('$file points at inject files that exist', ({ recipe }) => {
    for (const field of ['inject_css', 'inject_js']) {
      if (recipe[field] === undefined) continue;
      expect(
        fs.existsSync(path.join(APPS_DIR, recipe[field])),
        `${recipe.id}.${field}`,
      ).toBe(true);
    }
  });

  it('has no inject file that no recipe uses', () => {
    const used = new Set(
      recipes.flatMap(({ recipe }) =>
        [recipe.inject_css, recipe.inject_js].filter(Boolean),
      ),
    );
    const extra = fs
      .readdirSync(APPS_DIR)
      .filter((file) => !file.endsWith('.json') && !used.has(file));
    expect(extra).toEqual([]);
  });
});
