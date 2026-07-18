import path from 'path';
import os from 'os';
import fsExtra from 'fs-extra';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getCliProgram } from '@/helpers/cli-program';
import { loadConfigFile } from '@/helpers/config-file';
import { PakeError } from '@/utils/error';
import schema from '../../schema/pake.schema.json';

// Fields that exist as CLI options but are invocation concerns, so they are
// rejected in config files and excluded from the schema.
const CLI_ONLY_KEYS = new Set(['config', 'json', 'version']);
// Fields that exist only in config files, not as CLI options.
const CONFIG_ONLY_KEYS = new Set(['url', '$schema']);

// getCliProgram configures commander's global singleton, so it can only be
// called once per process; cache the derived attribute names.
const CLI_ATTRIBUTE_NAMES = new Set(
  getCliProgram().options.map((o) => o.attributeName()),
);

function cliAttributeNames(): Set<string> {
  return CLI_ATTRIBUTE_NAMES;
}

describe('pake.schema.json stays in sync with the CLI surface', () => {
  it('covers every CLI option except CLI-only invocation flags', () => {
    const schemaKeys = new Set(Object.keys(schema.properties));
    for (const key of cliAttributeNames()) {
      if (CLI_ONLY_KEYS.has(key)) {
        expect(schemaKeys.has(key), `schema must not contain "${key}"`).toBe(
          false,
        );
      } else {
        expect(schemaKeys.has(key), `schema is missing "${key}"`).toBe(true);
      }
    }
  });

  it('contains no field that is not a CLI option', () => {
    const validKeys = cliAttributeNames();
    for (const key of Object.keys(schema.properties)) {
      if (CONFIG_ONLY_KEYS.has(key)) continue;
      expect(
        validKeys.has(key),
        `schema field "${key}" has no CLI option`,
      ).toBe(true);
    }
  });

  it('rejects unknown fields via additionalProperties', () => {
    expect(schema.additionalProperties).toBe(false);
  });
});

describe('loadConfigFile', () => {
  let tmpDir: string;
  const validKeys = cliAttributeNames();

  const writeConfig = async (content: unknown, file = 'app.json') => {
    const configPath = path.join(tmpDir, file);
    await fsExtra.writeFile(
      configPath,
      typeof content === 'string' ? content : JSON.stringify(content),
    );
    return configPath;
  };

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'pake-config-'));
  });

  afterAll(async () => {
    await fsExtra.remove(tmpDir);
  });

  it('loads url and camelCase options', async () => {
    const configPath = await writeConfig({
      $schema: 'https://example.com/pake.schema.json',
      url: 'https://weekly.tw93.fun',
      name: 'Weekly',
      width: 1000,
      hideTitleBar: true,
      inject: ['./patch.css'],
    });

    const loaded = await loadConfigFile(configPath, validKeys);
    expect(loaded.url).toBe('https://weekly.tw93.fun');
    expect(loaded.options).toEqual({
      name: 'Weekly',
      width: 1000,
      hideTitleBar: true,
      inject: ['./patch.css'],
    });
  });

  it('rejects a missing file with INVALID_INPUT', async () => {
    const missing = path.join(tmpDir, 'nope.json');
    await expect(loadConfigFile(missing, validKeys)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
  });

  it('rejects broken JSON with INVALID_INPUT', async () => {
    const configPath = await writeConfig('{ oops', 'broken.json');
    await expect(loadConfigFile(configPath, validKeys)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
  });

  it('rejects unknown fields naming the field', async () => {
    const configPath = await writeConfig({ nmae: 'typo' }, 'typo.json');
    await expect(loadConfigFile(configPath, validKeys)).rejects.toThrow(
      /Unknown config field "nmae"/,
    );
  });

  it('rejects CLI-only invocation fields', async () => {
    const configPath = await writeConfig({ json: true }, 'json-flag.json');
    await expect(loadConfigFile(configPath, validKeys)).rejects.toThrow(
      /not allowed in a config file/,
    );
  });

  it('rejects numbers outside the CLI flag ranges', async () => {
    const zoomPath = await writeConfig({ zoom: 1000 }, 'zoom.json');
    await expect(loadConfigFile(zoomPath, validKeys)).rejects.toThrow(
      /"zoom" must be a finite number \(50-200\)/,
    );
    const widthPath = await writeConfig({ width: -5 }, 'negwidth.json');
    await expect(loadConfigFile(widthPath, validKeys)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
    const okPath = await writeConfig({ zoom: 100, width: 800 }, 'ok.json');
    const loaded = await loadConfigFile(okPath, validKeys);
    expect(loaded.options).toEqual({ zoom: 100, width: 800 });
  });

  it('schema ranges match the loader ranges', () => {
    expect(schema.properties.zoom).toMatchObject({ minimum: 50, maximum: 200 });
    for (const key of ['width', 'height', 'minWidth', 'minHeight'] as const) {
      expect(schema.properties[key]).toMatchObject({ minimum: 0 });
    }
  });

  it('rejects wrong value types naming the expected type', async () => {
    const configPath = await writeConfig({ width: 'wide' }, 'badtype.json');
    const rejection = expect(loadConfigFile(configPath, validKeys)).rejects;
    await rejection.toBeInstanceOf(PakeError);
    const configPath2 = await writeConfig({ inject: 'a.css' }, 'badtype2.json');
    await expect(loadConfigFile(configPath2, validKeys)).rejects.toThrow(
      /"inject" must be of type string\[\]/,
    );
  });
});
