import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const actionSource = fs.readFileSync(
  path.resolve(__dirname, '../../action.yml'),
  'utf8',
);

const buildStep = actionSource.slice(
  actionSource.indexOf('    - name: Build Pake App'),
);
const buildRunScript = buildStep.slice(buildStep.indexOf('      run: |'));

describe('Pake composite action input handling', () => {
  it('keeps action expressions out of the generated Bash script', () => {
    expect(buildRunScript).not.toMatch(/\$\{\{\s*inputs\./);

    const mappings = [
      'INPUT_URL: ${{ inputs.url }}',
      'INPUT_NAME: ${{ inputs.name }}',
      'INPUT_ICON: ${{ inputs.icon }}',
      'INPUT_WIDTH: ${{ inputs.width }}',
      'INPUT_HEIGHT: ${{ inputs.height }}',
      'INPUT_DEBUG: ${{ inputs.debug }}',
      'INPUT_OUTPUT_DIR: ${{ inputs.output-dir }}',
    ];

    for (const mapping of mappings) {
      expect(buildStep).toContain(mapping);
    }
  });

  it('maps the package path from the build step', () => {
    expect(actionSource).toContain(
      'value: ${{ steps.build.outputs.package-path }}',
    );
    expect(buildStep).toContain('id: build');
    expect(buildStep).toContain(
      `printf 'package-path=%s\\n' "$PACKAGE_PATH" >> "$GITHUB_OUTPUT"`,
    );
  });

  it('rejects line breaks before writing the output command', () => {
    expect(buildStep).toContain(
      String.raw`if [[ "$INPUT_OUTPUT_DIR" == *$'\n'* || "$INPUT_OUTPUT_DIR" == *$'\r'* ]]; then`,
    );
    expect(buildStep).toContain(
      String.raw`if [[ "$PACKAGE_PATH" == *$'\n'* || "$PACKAGE_PATH" == *$'\r'* ]]; then`,
    );
  });

  it('uses a unique temporary file for the Rust installer', () => {
    expect(actionSource).toContain('rustup_init="$(mktemp)"');
    expect(actionSource).toContain(`trap 'rm -f "$rustup_init"' EXIT`);
    expect(actionSource).not.toContain('/tmp/rustup-init.sh');
  });
});
