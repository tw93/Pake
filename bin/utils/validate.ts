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

export function validateUrlInput(url: string) {
  const isFile = fs.existsSync(url);

  if (!isFile) {
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
