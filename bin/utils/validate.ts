import * as Commander from 'commander';
import { normalizeUrl } from './url.js';

export function validateNumberInput(value: string) {
  const parsedValue = Number(value);
  if (isNaN(parsedValue)) {
    throw new Commander.InvalidArgumentError('Not a number.');
  }
  return parsedValue;
}

export function validateUrlInput(url: string) {
    try {
      return normalizeUrl(url)
    } catch (error) {
      throw new Commander.InvalidArgumentError(error.message);
    }
}
