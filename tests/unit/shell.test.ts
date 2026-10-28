import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/dir', () => ({ npmDirectory: process.cwd() }));
vi.mock('@/utils/output', () => ({ isMachineMode: vi.fn(() => false) }));
vi.mock('execa', async (importOriginal) => {
  const actual = await importOriginal<typeof import('execa')>();
  return { ...actual, execa: vi.fn(actual.execa) };
});

vi.mock('@/utils/build-workspace', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/utils/build-workspace')>();
  return {
    ...actual,
    preventBuildWorkspaceCleanup: vi.fn(actual.preventBuildWorkspaceCleanup),
  };
});

import { execa } from 'execa';
import { isMachineMode } from '@/utils/output';
import { shellExec } from '@/utils/shell';
import {
  beginBuildCancellation,
  preventBuildWorkspaceCleanup,
} from '@/utils/build-workspace';

const tempDirs: string[] = [];
afterEach(async () => {
  vi.clearAllMocks();
  vi.mocked(isMachineMode).mockReturnValue(false);
  await Promise.all(
    tempDirs
      .splice(0)
      .map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

describe('structured process execution', () => {
  it('passes shell syntax and spaces literally in arguments and cwd', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pake-exec-'));
    tempDirs.push(tempDir);
    const cwd = path.join(tempDir, 'space $(printf substituted)');
    await fs.mkdir(cwd);
    const resultPath = path.join(cwd, 'result.json');
    const values = [
      'two words',
      '$(printf PAKE_SHOULD_STAY_LITERAL)',
      '`printf substituted`',
      'a"b',
      'a&b',
    ];
    await shellExec(
      {
        executable: process.execPath,
        args: [
          '-e',
          'require("fs").writeFileSync(process.argv[1], JSON.stringify({args:process.argv.slice(2),cwd:process.cwd(),env:process.env.PAKE_EXEC_TEST}))',
          resultPath,
          ...values,
        ],
        cwd,
      },
      5000,
      { PAKE_EXEC_TEST: 'value with spaces' },
    );

    const result = JSON.parse(await fs.readFile(resultPath, 'utf8'));
    // Windows may expose the same working directory through its 8.3 alias.
    result.cwd = await fs.realpath(result.cwd);
    expect(result).toEqual({
      args: values,
      cwd: await fs.realpath(cwd),
      env: 'value with spaces',
    });
    expect(vi.mocked(execa).mock.calls[0][2]).toMatchObject({ shell: false });
  });

  it('reserves stdout for the JSON result in machine mode', async () => {
    vi.mocked(isMachineMode).mockReturnValue(true);
    await shellExec({ executable: process.execPath, args: ['-e', ''] });
    expect(vi.mocked(execa).mock.calls[0][2]).toMatchObject({
      cwd: process.cwd(),
      stdin: 'inherit',
      stdout: process.stderr,
      stderr: 'inherit',
    });
  });

  it('reports a real nonzero process exit', async () => {
    await expect(
      shellExec({
        executable: process.execPath,
        args: ['-e', 'process.exit(7)'],
      }),
    ).rejects.toThrow('Exit code: 7');
  });

  it('terminates a process when its timeout expires', async () => {
    await expect(
      shellExec(
        {
          executable: process.execPath,
          args: ['-e', 'setTimeout(() => {}, 10000)'],
        },
        50,
      ),
    ).rejects.toThrow('Command timed out after 50ms');
  });

  it.each([
    [128, 0],
    [1, 1],
  ])(
    'a failed Windows build whose taskkill exits %i keeps the workspace %i times',
    async (taskkillExit, kept) => {
      const actual = await vi.importActual<typeof import('execa')>('execa');
      vi.mocked(execa).mockImplementation(((file: string, ...rest: any[]) =>
        file === 'taskkill'
          ? Promise.reject(
              Object.assign(new Error('taskkill failed'), {
                exitCode: taskkillExit,
              }),
            )
          : (actual.execa as any)(file, ...rest)) as any);
      const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
      Object.defineProperty(process, 'platform', { value: 'win32' });
      const endCancellation = beginBuildCancellation();
      try {
        await expect(
          shellExec({
            executable: process.execPath,
            args: ['-e', 'process.exit(7)'],
          }),
        ).rejects.toThrow('Exit code: 7');
        expect(vi.mocked(execa).mock.calls.map((call) => call[0])).toContain(
          'taskkill',
        );
        expect(preventBuildWorkspaceCleanup).toHaveBeenCalledTimes(kept);
      } finally {
        endCancellation();
        Object.defineProperty(process, 'platform', platform);
        vi.mocked(execa).mockImplementation(actual.execa as any);
      }
    },
  );

  it.skipIf(process.platform === 'win32')(
    'stops compiler descendants before rejecting a timed-out build',
    async () => {
      const directory = await fs.mkdtemp(
        path.join(os.tmpdir(), 'pake-timeout-tree-'),
      );
      tempDirs.push(directory);
      const writes = path.join(directory, 'writes');
      const childPidPath = path.join(directory, 'child-pid');
      const endCancellation = beginBuildCancellation();
      const script = `
      const {spawn} = require('child_process');
      const fs = require('fs');
      const child = spawn(process.execPath, ['-e', 'process.on("SIGTERM",()=>{});setInterval(()=>require("fs").appendFileSync(process.argv[1],"x"),10)', process.argv[1]], {stdio:'ignore'});
      fs.writeFileSync(process.argv[2], String(child.pid));
      setInterval(()=>{},10000);
    `;
      try {
        await expect(
          shellExec(
            {
              executable: process.execPath,
              args: ['-e', script, writes, childPidPath],
            },
            2000,
          ),
        ).rejects.toThrow('Command timed out after 2000ms');
        // Under a loaded full run two node startups can outlast a short
        // timeout, so the child may not have written yet; it must have spawned.
        await fs.access(childPidPath);
        const sizeOf = (file: string) =>
          fs.stat(file).then(
            (stat) => stat.size,
            () => 0,
          );
        const size = await sizeOf(writes);
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(await sizeOf(writes)).toBe(size);
      } finally {
        endCancellation();
        try {
          process.kill(
            Number(await fs.readFile(childPidPath, 'utf8')),
            'SIGKILL',
          );
        } catch {}
      }
    },
    15000,
  );
});
