import fs from 'fs';
import { InvalidArgumentError } from 'commander';
import { normalizeUrl } from './url';

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

function validateIntegerRange(
  value: string,
  name: string,
  min: number,
  max: number,
) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new InvalidArgumentError(
      `${name} must be an integer between ${min} and ${max}.`,
    );
  }
  return parsed;
}

export function validateServerPort(value: string) {
  return validateIntegerRange(value, 'Port', 1, 65535);
}

export function validateServerTimeout(value: string) {
  return validateIntegerRange(value, 'Timeout', 1, 3600);
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
