import { describe, expect, it } from 'vitest';

import { buildLinuxDesktopContent } from '../../bin/helpers/merge';

describe('buildLinuxDesktopContent', () => {
  it('uses the Tauri main binary name for freedesktop icon lookup', () => {
    const desktopContent = buildLinuxDesktopContent(
      'Example App',
      undefined,
      'pake-example-app',
    );

    expect(desktopContent).toContain('Exec=pake-example-app');
    expect(desktopContent).toContain('Icon=pake-example-app');
    expect(desktopContent).not.toContain('Icon=example-app_512');
  });

  it('keeps the localized Chinese name when title contains Chinese text', () => {
    const desktopContent = buildLinuxDesktopContent(
      'MiaoYan',
      '妙言',
      'pake-miaoyan',
    );

    expect(desktopContent).toContain('Name=MiaoYan');
    expect(desktopContent).toContain('Name[zh_CN]=妙言');
  });
});
