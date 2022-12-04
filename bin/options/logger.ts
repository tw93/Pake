import log from 'loglevel';
import chalk from 'chalk';

const logger = {
  info(...msg: any[]) {
    log.info(...msg.map((m) => chalk.blue.bold(m)));
  },
  debug(...msg: any[]) {
    log.debug(...msg);
  },
  error(...msg: any[]) {
    log.error(...msg.map((m) => chalk.red.bold(m)));
  },
  warn(...msg: any[]) {
    log.info(...msg.map((m) => chalk.yellow.bold(m)));
  },
  success(...msg: any[]) {
    log.info(...msg.map((m) => chalk.green.bold(m)));
  }
};

export default logger;
