import * as Commander from 'commander';
import { normalizeUrl } from './url.js';
import fs from 'fs';

export function validateNumberInput(value: string) {
  const parsedValue = Number(value);
  if (isNaN(parsedValue)) {
    throw new Commander.InvalidArgumentError('The input cannot be a number.');
  }
  return parsedValue;
}

export function validateUrlInput(url: string) {
  if(!fs.existsSync(url)) {
    try {
      return normalizeUrl(url)
    } catch (error) {
      throw new Commander.InvalidArgumentError(error.message);
    }
  } else {
    return url;
  }
}
