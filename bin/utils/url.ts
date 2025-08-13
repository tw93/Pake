import * as psl from 'psl';

// Extracts the domain from a given URL.
export function getDomain(inputUrl: string): string | null {
  try {
    const url = new URL(inputUrl);
    // Use PSL to parse domain names.
    const parsed = psl.parse(url.hostname);

    // If domain is available, split it and return the SLD.
    if ('domain' in parsed && parsed.domain) {
      return parsed.domain.split('.')[0];
    } else {
      return null;
    }
  } catch (error) {
    return null;
  }
}

// Appends 'https://' protocol to the URL if not present.
export function appendProtocol(inputUrl: string): string {
  try {
    new URL(inputUrl);
    return inputUrl;
  } catch {
    return `https://${inputUrl}`;
  }
}

// Normalizes the URL by ensuring it has a protocol and is valid.
export function normalizeUrl(urlToNormalize: string): string {
  const urlWithProtocol = appendProtocol(urlToNormalize);
  try {
    new URL(urlWithProtocol);
    return urlWithProtocol;
  } catch (err) {
    throw new Error(
      `Your url "${urlWithProtocol}" is invalid: ${(err as Error).message}`,
    );
  }
}
