import fs from 'fs';
import path from 'path';
import { PakeError } from './error';
import { InvalidArgumentError } from 'commander';
import { normalizeUrl } from './url';
import { PakeCliOptions } from '../types';

export function validateNumberInput(value: string) {
  if (value.trim() === '') {
    throw new InvalidArgumentError('Not a number.');
  }
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    throw new InvalidArgumentError('Not a number.');
  }
  if (parsedValue < 0) {
    throw new InvalidArgumentError('Must not be negative.');
  }
  return parsedValue;
}

// Path-shaped input (./x, ../x, /x, ~/x, C:\x). A missing path must fail
// loudly: appending https:// to "./typo" would otherwise produce a valid URL
// like https://./typo and a silently broken app (worst case for agents).
const PATH_LIKE_PATTERN = /^(\.{1,2}[\\/]|[\\/]|~[\\/]|[a-zA-Z]:[\\/])/;

export function validateUrlInput(url: string) {
  const isFile = fs.existsSync(url);

  if (!isFile) {
    if (PATH_LIKE_PATTERN.test(url)) {
      throw new InvalidArgumentError(
        `Local path "${url}" does not exist. Check the path, or pass a web URL instead.`,
      );
    }
    try {
      return normalizeUrl(url);
    } catch (error) {
      if (error instanceof Error) {
        throw new InvalidArgumentError(error.message);
      }
      throw error;
    }
  }

  return url;
}

export function validateDownloadDirInput(value: string): string {
  if (value === '') return value;
  const homeRelative = value.startsWith('~/') ? value.slice(2) : null;
  const invalidHomePath =
    homeRelative !== null &&
    (path.isAbsolute(homeRelative) ||
      (process.platform === 'win32' &&
        /^(?:[a-zA-Z]:|[\\/])/.test(homeRelative)));
  if (
    invalidHomePath ||
    value.includes('\0') ||
    !(path.isAbsolute(value) || value === '~' || value.startsWith('~/')) ||
    (process.platform === 'win32' &&
      value !== '~' &&
      !value.startsWith('~/') &&
      !/^(?:[a-zA-Z]:[\\/]|[\\/]{2}[^\\/]+[\\/][^\\/]+)/.test(value))
  ) {
    throw new PakeError('Invalid download directory.', {
      code: 'INVALID_INPUT',
      hint: 'Use an absolute path or a quoted ~/path; relative paths are not supported.',
    });
  }
  return value;
}

/**
 * Validates that mutually exclusive CLI options are not used together.
 * Throws PakeError with INVALID_INPUT code if conflicts are detected.
 */
export function validateMutuallyExclusiveFlags(
  options: Partial<PakeCliOptions>,
): void {
  // --fullscreen conflicts with explicit size settings (width, height, min-width, min-height)
  if (options.fullscreen) {
    if (options.width !== undefined && options.width !== 1200) {
      throw new PakeError(
        '"--fullscreen" and "--width" cannot be used together.',
        {
          code: 'INVALID_INPUT',
          hint: 'Remove "--width" or use "--maximize" for adaptive sizing instead.',
        },
      );
    }
    if (options.height !== undefined && options.height !== 780) {
      throw new PakeError(
        '"--fullscreen" and "--height" cannot be used together.',
        {
          code: 'INVALID_INPUT',
          hint: 'Remove "--height" or use "--maximize" for adaptive sizing instead.',
        },
      );
    }
    if (options.minWidth !== undefined && options.minWidth !== 0) {
      throw new PakeError(
        '"--fullscreen" and "--min-width" cannot be used together.',
        {
          code: 'INVALID_INPUT',
          hint: 'Remove "--min-width" since fullscreen ignores size constraints.',
        },
      );
    }
    if (options.minHeight !== undefined && options.minHeight !== 0) {
      throw new PakeError(
        '"--fullscreen" and "--min-height" cannot be used together.',
        {
          code: 'INVALID_INPUT',
          hint: 'Remove "--min-height" since fullscreen ignores size constraints.',
        },
      );
    }
    // --fullscreen and --maximize are both window fill modes
    if (options.maximize) {
      throw new PakeError(
        '"--fullscreen" and "--maximize" cannot be used together.',
        {
          code: 'INVALID_INPUT',
          hint: 'Use only "--fullscreen" to start the app in fullscreen mode.',
        },
      );
    }
  }

  // --start-to-tray conflicts with --maximize (can't maximize hidden window)
  if (options.startToTray && options.maximize) {
    throw new PakeError(
      '"--start-to-tray" and "--maximize" cannot be used together.',
      {
        code: 'INVALID_INPUT',
        hint: 'Remove "--maximize" since the window starts hidden to tray.',
      },
    );
  }
}

