import fsExtra from 'fs-extra';
import { DEFAULT_PAKE_OPTIONS as DEFAULT } from '../defaults';
import { PakeError } from '../utils/error';
import { PakeCliOptions } from '../types';

/**
 * `--config <path>` support: a declarative JSON manifest whose fields mirror
 * the CLI options (camelCase), plus `url`. Precedence is CLI flag > config
 * file > default, resolved in bin/cli.ts via commander's option-value source.
 * The published schema lives in schema/pake.schema.json.
 */

export interface LoadedConfigFile {
  url?: string;
  options: Partial<PakeCliOptions>;
}

// Invocation concerns, not app manifest fields; pass these as CLI flags.
const REJECTED_KEYS = new Set(['config', 'json', 'version']);

// Optional CLI options that have no entry in DEFAULT_PAKE_OPTIONS.
const EXTRA_STRING_KEYS = new Set(['name', 'title', 'identifier']);

type ExpectedType = 'string' | 'number' | 'boolean' | 'string[]';

// Numeric fields share the CLI flag ranges (see cli-program.ts validators),
// so a config file cannot smuggle a value the same flag would reject.
const NUMBER_RANGES: Record<string, { min: number; max?: number }> = {
  width: { min: 0 },
  height: { min: 0 },
  minWidth: { min: 0 },
  minHeight: { min: 0 },
  zoom: { min: 50, max: 200 },
};

function expectedTypeFor(key: string): ExpectedType | null {
  if (key === 'inject') return 'string[]';
  if (key === 'hideOnClose') return 'boolean';
  if (EXTRA_STRING_KEYS.has(key)) return 'string';
  const defaultValue = (DEFAULT as unknown as Record<string, unknown>)[key];
  const type = typeof defaultValue;
  if (type === 'string' || type === 'number' || type === 'boolean') {
    return type;
  }
  return null;
}

function matchesType(value: unknown, type: ExpectedType): boolean {
  if (type === 'string[]') {
    return Array.isArray(value) && value.every((v) => typeof v === 'string');
  }
  return typeof value === type;
}

export async function loadConfigFile(
  configPath: string,
  validKeys: Set<string>,
): Promise<LoadedConfigFile> {
  if (!(await fsExtra.pathExists(configPath))) {
    throw new PakeError(`Config file not found: ${configPath}`, {
      code: 'INVALID_INPUT',
      hint: 'Pass a path to a JSON file matching schema/pake.schema.json.',
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await fsExtra.readFile(configPath, 'utf8'));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new PakeError(`Config file is not valid JSON: ${detail}`, {
      code: 'INVALID_INPUT',
      hint: `Fix the JSON syntax in ${configPath}.`,
    });
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new PakeError('Config file must contain a JSON object.', {
      code: 'INVALID_INPUT',
      hint: 'See schema/pake.schema.json for the expected shape.',
    });
  }

  const result: LoadedConfigFile = { options: {} };

  for (const [key, value] of Object.entries(parsed)) {
    if (key === '$schema') continue;

    if (key === 'url') {
      if (typeof value !== 'string') {
        throw new PakeError('Config field "url" must be a string.', {
          code: 'INVALID_INPUT',
          hint: 'Use a web URL or a local file/directory path.',
        });
      }
      result.url = value;
      continue;
    }

    if (REJECTED_KEYS.has(key)) {
      throw new PakeError(
        `Config field "${key}" is not allowed in a config file.`,
        {
          code: 'INVALID_INPUT',
          hint: `Pass --${key} on the command line instead.`,
        },
      );
    }

    if (!validKeys.has(key)) {
      throw new PakeError(`Unknown config field "${key}".`, {
        code: 'INVALID_INPUT',
        hint: 'Field names are camelCase CLI option names; see schema/pake.schema.json.',
      });
    }

    const expected = expectedTypeFor(key);
    if (expected && !matchesType(value, expected)) {
      throw new PakeError(
        `Config field "${key}" must be of type ${expected}.`,
        {
          code: 'INVALID_INPUT',
          hint: 'See schema/pake.schema.json for field types.',
        },
      );
    }
    if (typeof value === 'number') {
      const range = NUMBER_RANGES[key];
      const min = range?.min ?? 0;
      const max = range?.max;
      if (
        !Number.isFinite(value) ||
        value < min ||
        (max !== undefined && value > max)
      ) {
        const bounds = max !== undefined ? `${min}-${max}` : `>= ${min}`;
        throw new PakeError(
          `Config field "${key}" must be a finite number (${bounds}).`,
          {
            code: 'INVALID_INPUT',
            hint: 'See schema/pake.schema.json for field ranges.',
          },
        );
      }
    }

    if (!expected && (typeof value === 'object' || value === null)) {
      throw new PakeError(
        `Config field "${key}" must be a string, number, or boolean.`,
        {
          code: 'INVALID_INPUT',
          hint: 'See schema/pake.schema.json for field types.',
        },
      );
    }

    (result.options as Record<string, unknown>)[key] = value;
  }

  return result;
}
