import chalk from 'chalk';
import log from 'loglevel';

const logger = {
  info(...msg: any[]) {
    log.info(...msg.map(m => chalk.white(m)));
  },
  debug(...msg: any[]) {
    log.debug(...msg);
  },
  error(...msg: any[]) {
    log.error(...msg.map(m => chalk.red(m)));
  },
  warn(...msg: any[]) {
    log.info(...msg.map(m => chalk.yellow(m)));
  },
  success(...msg: any[]) {
    log.info(...msg.map(m => chalk.green(m)));
  },
};

export default logger;
