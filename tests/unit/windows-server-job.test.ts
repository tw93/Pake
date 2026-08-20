import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'src-tauri', 'src', 'local_server.rs'),
  'utf8',
);

describe('Windows managed server Job Object', () => {
  it('starts suspended and resumes only after Job assignment', () => {
    expect(source).toContain('CREATE_NO_WINDOW | CREATE_SUSPENDED');

    const jobStart = source.indexOf('fn create_kill_on_close_job');
    const jobEnd = source.indexOf('fn spawn_server', jobStart);
    const jobSetup = source.slice(jobStart, jobEnd);
    expect(jobSetup.indexOf('AssignProcessToJobObject')).toBeGreaterThan(-1);
    expect(jobSetup.indexOf('resume_process_threads(child)?')).toBeGreaterThan(
      jobSetup.indexOf('AssignProcessToJobObject'),
    );
  });
});
