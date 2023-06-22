import dns from 'dns';
import http from 'http';
import { promisify } from 'util';
import logger from '@/options/logger';

const resolve = promisify(dns.resolve);

const ping = async (host: string) => {
  const lookup = promisify(dns.lookup);
  const ip = await lookup(host);
  const start = new Date();

  return new Promise<number>((resolve, reject) => {
    const req = http.get(`http://${ip.address}`, (res) => {
      const delay = new Date().getTime() - start.getTime();
      res.resume();
      resolve(delay);
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
};

async function isChinaDomain(domain: string): Promise<boolean> {
  try {
    const [ip] = await resolve(domain);
    return await isChinaIP(ip, domain);
  } catch (error) {
    logger.info(`${domain} can't be parse!`);
    return false;
  }
}

async function isChinaIP(ip: string, domain: string): Promise<boolean> {
  try {
    const delay = await ping(ip);
    logger.info(`${domain} latency is ${delay} ms`);
    return delay > 500;
  } catch (error) {
    logger.info(`ping ${domain} failed!`);
    return false;
  }
}

export { isChinaDomain, isChinaIP };
