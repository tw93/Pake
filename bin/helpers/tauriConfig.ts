import crypto from 'crypto';

export function getIdentifier(name: string, url: string) {
  const hash = crypto.createHash('md5');
  hash.update(url);
  const postFixHash = hash.digest('hex').substring(0, 6);
  return `pake-${postFixHash}`;
}
