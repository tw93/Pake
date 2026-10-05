import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Windows password autosave configuration', () => {
  it('applies both enabled and disabled settings to each Windows webview', () => {
    const window = fs.readFileSync('src-tauri/src/app/window.rs', 'utf8');
    expect(window).toMatch(
      /let password_autosave = window_config\.password_autosave_enabled\(\);/,
    );
    expect(window).toMatch(
      /set_password_autosave\(&webview, password_autosave\);/,
    );
    expect(window).not.toMatch(/if window_config\.password_autosave/);
  });

  it('uses the older supported settings interface without changing ordinary autofill', () => {
    const navigation = fs.readFileSync(
      'src-tauri/src/app/navigation.rs',
      'utf8',
    );
    expect(navigation).toMatch(/\.cast::<ICoreWebView2Settings4>\(\)/);
    expect(navigation).toMatch(/\.SetIsPasswordAutosaveEnabled\(enabled\)/);
    expect(navigation).not.toContain('SetIsGeneralAutofillEnabled');
  });
});
