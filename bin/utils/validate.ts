import fs from 'fs';
import { InvalidArgumentError } from 'commander';
import { normalizeUrl } from './url';

export function validateNumberInput(value: string) {
  const parsedValue = Number(value);
  if (isNaN(parsedValue)) {
    throw new InvalidArgumentError('Not a number.');
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
