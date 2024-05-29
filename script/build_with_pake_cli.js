import shelljs from 'shelljs';
import axios from 'axios';
import fs from 'fs';

const { exec, cd, mv } = shelljs;

console.log('Welcome to use pake-cli to build app');
console.log('Node.js info in your localhost ', process.version);
console.log('\n=======================\n');
console.log('Pake parameters is: ');
console.log('url: ', process.env.URL);
console.log('name: ', process.env.NAME);
console.log('icon: ', process.env.ICON);
console.log('height: ', process.env.HEIGHT);
console.log('width: ', process.env.WIDTH);
console.log('hide-title-bar: ', process.env.HIDE_TITLE_BAR);
console.log('resize: ', process.env.RESIZE);
console.log('is multi arch? only for Mac: ', process.env.MULTI_ARCH);
console.log('targets type? only for Linux: ', process.env.TARGETS);
console.log('safe-domain: ', process.env.SAFE_DOMAIN);
console.log('===========================\n');

cd('node_modules/pake-cli');
let params = `node cli.js ${process.env.URL} --name ${process.env.NAME} --height ${process.env.HEIGHT} --width ${process.env.WIDTH}`;

if (process.env.HIDE_TITLE_BAR === 'true') {
  params = `${params} --hide-title-bar`;
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

if (process.env.SAFE_DOMAIN) {
  params = `${params} --safe-domain ${process.env.SAFE_DOMAIN}`;
}

if (process.platform === 'win32' || process.platform === 'linux') {
  params = `${params} --show-system-tray`;
}

const downloadIcon = async iconFile => {
  try {
    const response = await axios.get(process.env.ICON, { responseType: 'arraybuffer' });
    fs.writeFileSync(iconFile, response.data);
    return `${params} --icon ${iconFile}`;
  } catch (error) {
    console.error('Error occurred during icon download: ', error);
  }
};

const main = async () => {
  if (process.env.ICON && process.env.ICON !== '') {
    let iconFile;
    switch (process.platform) {
      case 'linux':
        iconFile = 'icon.png';
        break;
      case 'darwin':
        iconFile = 'icon.icns';
        break;
      case 'win32':
        iconFile = 'icon.ico';
        break;
      default:
        console.log("Unable to detect your OS system, won't download the icon!");
        process.exit(1);
    }

    params = await downloadIcon(iconFile);
  } else {
    console.log("Won't download the icon as ICON environment variable is not defined!");
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
};

main();
