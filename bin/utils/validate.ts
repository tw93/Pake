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

const SSRF_BLOCKED = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.)/;

export function validateUrlInput(url: string) {
  const isFile = fs.existsSync(url);

  if (!isFile) {
    try {
      const normalized = normalizeUrl(url);
      const parsed = new URL(normalized);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new InvalidArgumentError('URL scheme must be http or https.');
      }
      if (SSRF_BLOCKED.test(parsed.hostname)) {
        throw new InvalidArgumentError('URL points to a blocked internal address.');
      }
      return normalized;
    } catch (error) {
      if (error instanceof InvalidArgumentError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new InvalidArgumentError(error.message);
      }
      throw error;
    }
  }

  return url;
}
