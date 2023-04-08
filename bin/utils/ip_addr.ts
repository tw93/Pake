import { exec } from 'child_process';
import { promisify } from 'util';
import dns from 'dns';

const resolve = promisify(dns.resolve);

async function isChinaDomain(domain: string): Promise<boolean> {
  try {
    // 解析域名为IP地址
    const [ip] = await resolve(domain);
    return await isChinaIP(ip);
  } catch (error) {
    // 域名无法解析，返回false
    return false;
  }
}

async function isChinaIP(ip: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    exec(`ping -c 1 -w 1 ${ip}`, (error, stdout, stderr) => {
      if (error) {
        // 命令执行出错，返回false
        resolve(false);
      } else {
        // 解析输出信息，提取延迟值
        const match = stdout.match(/time=(\d+\.\d+) ms/);
        const latency = match ? parseFloat(match[1]) : 0;
        // 判断延迟是否超过100ms
        resolve(latency > 100);
      }
    });
  });
}

export { isChinaDomain, isChinaIP };