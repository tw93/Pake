import url from 'url';
import isurl from 'is-url';
import tlds from './tlds.js';

export function getDomain(inputUrl: string) {
  const parsed = url.parse(inputUrl).host;
  var parts = parsed.split('.');
  if (parts[0] === 'www' && parts[1] !== 'com') {
    parts.shift();
  }
  var ln = parts.length,
    i = ln,
    minLength = parts[parts.length - 1].length,
    part;

  // iterate backwards
  while ((part = parts[--i])) {
    // stop when we find a non-TLD part
    if (
      i === 0 || // 'asia.com' (last remaining must be the SLD)
      i < ln - 2 || // TLDs only span 2 levels
      part.length < minLength || // 'www.cn.com' (valid TLD as second-level domain)
      tlds.indexOf(part) < 0 // officialy not a TLD
    ) {
      return part;
    }
  }
}

function appendProtocol(inputUrl: string): string {
  const parsed = url.parse(inputUrl);
  if (!parsed.protocol) {
    const urlWithProtocol = `https://${inputUrl}`;
    return urlWithProtocol;
  }
  return inputUrl;
}

export function normalizeUrl(urlToNormalize: string): string {
  const urlWithProtocol = appendProtocol(urlToNormalize);

  if (isurl(urlWithProtocol)) {
    return urlWithProtocol;
  } else {
    throw new Error(`Your url "${urlWithProtocol}" is invalid`);
  }
}
