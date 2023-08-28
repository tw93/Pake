const shell = require('shelljs');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

console.log("Welcome to use Pake Cli~");
console.log("\n=======================\n");

console.log("\n=======================");
console.log("pake parameters is: ");
console.log("url: ", process.env.URL);
console.log("name: ", process.env.NAME);
console.log("icon: ", process.env.ICON);
console.log("height: ", process.env.HEIGHT);
console.log("width: ", process.env.WIDTH);
console.log("transparent: ", process.env.TRANSPARENT);
console.log("resize: ", process.env.RESIZE);
console.log("is multi arch? only for Mac: ", process.env.MULTI_ARCH);
console.log("targets type? only for Linux: ", process.env.TARGETS);
console.log("===========================\n");

shell.cd('node_modules/pake-cli');
let params = `node cli.js ${process.env.URL} --name ${process.env.NAME}`;

if (process.env.ICON) {
  const iconPath = path.join(__dirname, 'icon');
  axios({
    method: 'get',
    url: process.env.ICON,
    responseType: 'stream'
  }).then(function (response) {
    response.data.pipe(fs.createWriteStream(iconPath));
    params = `${params} --icon ${iconPath}`;
  });
}

params = `${params} --height ${process.env.HEIGHT} --width ${process.env.WIDTH}`;

if (process.env.TRANSPARENT === 'true') {
  params = `${params} --transparent`;
}

if (process.env.FULLSCREEN === 'true') {
  params = `${params} --resize`;
}

if (process.env.MULTI_ARCH === 'true') {
  shell.exec('rustup target add aarch64-apple-darwin');
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

console.log("Pake parameters is: ", params);
console.log("compile....");
shell.exec(params);

if (!fs.existsSync('output')) {
  fs.mkdirSync('output');
}
shell.mv(`${process.env.NAME}.*`, 'output/');
console.log("Build Success");
shell.cd('../..');
