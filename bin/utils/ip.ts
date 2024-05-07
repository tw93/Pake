import dns from 'dns';
import http from 'http';
import { promisify } from 'util';

import logger from '@/options/logger';

const resolve = promisify(dns.resolve);

const ping = async (host: string) => {
  const lookup = promisify(dns.lookup);
  const ip = await lookup(host);
  const start = new Date();

  // Prevent timeouts from affecting user experience.
  const requestPromise = new Promise<number>((resolve, reject) => {
    const req = http.get(`http://${ip.address}`, res => {
      const delay = new Date().getTime() - start.getTime();
      res.resume();
      resolve(delay);
    });

    req.on('error', err => {
      reject(err);
    });
  });

  const timeoutPromise = new Promise<number>((_, reject) => {
    setTimeout(() => {
      reject(new Error('Request timed out after 3 seconds'));
    }, 1000);
  });

  return Promise.race([requestPromise, timeoutPromise]);
};

async function isChinaDomain(domain: string): Promise<boolean> {
  try {
    const [ip] = await resolve(domain);
    return await isChinaIP(ip, domain);
  } catch (error) {
    logger.debug(`${domain} can't be parse!`);
    return true;
  }
}

async function isChinaIP(ip: string, domain: string): Promise<boolean> {
  try {
    const delay = await ping(ip);
    logger.debug(`${domain} latency is ${delay} ms`);
    return delay > 500;
  } catch (error) {
    logger.debug(`ping ${domain} failed!`);
    return true;
  }
}

export { isChinaDomain, isChinaIP };
