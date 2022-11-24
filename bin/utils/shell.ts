import shelljs from "shelljs";

export function shellExec(command: string) {
  return new Promise<number>((resolve, reject) => {
    shelljs.exec(command, { async: true, silent: false }, (code) => {
      if (code === 0) {
        resolve(0);
      } else {
        reject(new Error(`${code}`));
      }
    });
  });
}
