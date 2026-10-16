import { describe, expect, it } from 'vitest';

import {
  applyLinuxDesktopTemplate,
  buildLinuxDesktopContent,
} from '../../bin/helpers/merge';

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

  it('sets StartupWMClass so docks match the running window to the entry', () => {
    const desktopContent = buildLinuxDesktopContent(
      'YouTube',
      undefined,
      'pake-youtube',
    );

    expect(desktopContent).toContain('StartupWMClass=pake-youtube');
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

describe('applyLinuxDesktopTemplate', () => {
  it('renders the Pake entry through the bundler template instead of shipping a second file', () => {
    const linuxBundle: Parameters<typeof applyLinuxDesktopTemplate>[0] = {
      deb: {},
    };
    applyLinuxDesktopTemplate(linuxBundle, 'assets/com.pake.example.desktop');

    expect(linuxBundle.deb.desktopTemplate).toBe(
      'assets/com.pake.example.desktop',
    );
    expect(linuxBundle.rpm?.desktopTemplate).toBe(
      'assets/com.pake.example.desktop',
    );
    expect(linuxBundle.deb.files).toBeUndefined();
    expect(linuxBundle.rpm?.files).toBeUndefined();
  });
});
