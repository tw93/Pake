import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '@/options/logger.js';
import dns from 'dns';
import http from 'http';


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


const resolve = promisify(dns.resolve);

async function isChinaDomain(domain: string): Promise<boolean> {
  try {
    // 解析域名为IP地址
    const [ip] = await resolve(domain);
    return await isChinaIP(ip, domain);
  } catch (error) {
    // 域名无法解析，返回false
    logger.info(`${domain} can't be parse, is not in China!`);
    return false;
  }
}

async function isChinaIP(ip: string, domain: string): Promise<boolean> {
    try {
        const delay = await ping(ip);
        logger.info(`${domain} latency is ${delay} ms`);
        // 判断延迟是否超过500ms
        return delay > 500;
    } catch (error) {
        // 命令执行出错，返回false
        logger.info(`ping ${domain} failed!, is not in China!`);
        return false;
    }
}

export { isChinaDomain, isChinaIP };
