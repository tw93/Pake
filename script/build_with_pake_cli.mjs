import shelljs from 'shelljs';
import axios from 'axios';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';

const { exec, cd, mv } = shelljs;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Welcome to use pake-cli to build app~');
console.log('Node.js info in your localhost ', process.version);
console.log('\n=======================\n');
console.log('Pake parameters is: ');
console.log('url: ', process.env.URL);
console.log('name: ', process.env.NAME);
console.log('icon: ', process.env.ICON);
console.log('height: ', process.env.HEIGHT);
console.log('width: ', process.env.WIDTH);
console.log('transparent: ', process.env.TRANSPARENT);
console.log('resize: ', process.env.RESIZE);
console.log('is multi arch? only for Mac: ', process.env.MULTI_ARCH);
console.log('targets type? only for Linux: ', process.env.TARGETS);
console.log('===========================\n');

cd('node_modules/pake-cli');
let params = `node cli.js ${process.env.URL} --name ${process.env.NAME}`;

// Download Icons
if (process.env.ICON && process.env.ICON !== '') {
  let iconFile;
  switch (os.type()) {
    case 'Linux':
      iconFile = 'icon.png';
      break;
    case 'Darwin':
      iconFile = 'icon.icns';
      break;
    case 'Windows_NT':
      iconFile = 'icon.ico';
      break;
    default:
      console.log("Unable to detect your OS system, won't download the icon!");
      return;
  }

  axios
    .get(process.env.ICON, { responseType: 'arraybuffer' })
    .then(response => {
      fs.writeFileSync(iconFile, response.data);
      params = `${params} --icon ${iconFile}`;
    })
    .catch(error => {
      console.error('Error occurred during icon download: ', error);
    });
} else {
  console.log("Won't download the icon as ICON environment variable is not defined!");
}

params = `${params} --height ${process.env.HEIGHT} --width ${process.env.WIDTH}`;

if (process.env.TRANSPARENT === 'true') {
  params = `${params} --transparent`;
}

if (process.env.FULLSCREEN === 'true') {
  params = `${params} --resize`;
}

if (process.env.MULTI_ARCH === 'true') {
  exec('rustup target add aarch64-apple-darwin');
  params = `${params} --multi-arch`;
}

if (process.env.TARGETS) {
  params = `${params} --targets ${process.env.TARGETS}`;
}

if (process.platform === 'win32') {
  params = `${params} --show-system-tray`;
}

if (process.platform === 'linux') {
  params = `${params} --show-system-tray`;
}

if (process.platform === 'darwin') {
  params = `${params} --show-menu`;
}

console.log('Pake parameters is: ', params);
console.log('Compile....');
exec(params);

if (!fs.existsSync('output')) {
  fs.mkdirSync('output');
}
mv(`${process.env.NAME}.*`, 'output/');
console.log('Build Success');
cd('../..');
