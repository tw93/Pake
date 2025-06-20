#!/usr/bin/env node

import chalk from 'chalk';
import { program, Option } from 'commander';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const { green, yellow, blue, red } = chalk;

const logo = `${green(' ____       _')}
${green('|  _ \\ __ _| | _____')}
${green('| |_) / _` | |/ / _ \\')}
${green('|  __/ (_| |   <  __/')}  ${yellow('https://github.com/tw93/pake')}
${green('|_|   \\__,_|_|\\_\\___|  can turn any webpage into a desktop app with Rust.')}
${blue('                     + Now supports mobile platforms! 📱')}
`;

program.addHelpText('beforeAll', logo).usage(`[url] [options]`).showHelpAfterError();

program
  .command('mobile')
  .description('Build mobile applications (Android/iOS)')
  .argument('<platform>', 'Target platform: android, ios, or both')
  .argument('<url>', 'The web URL you want to package')
  .option('--name <string>', 'Application name', 'PakeApp')
  .option('--identifier <string>', 'App identifier (com.example.app)')
  .option('--width <number>', 'Window width for mobile webview', 390)
  .option('--height <number>', 'Window height for mobile webview', 844)
  .option('--icon <string>', 'Application icon path')
  .option('--debug', 'Debug build and more output', false)
  .action(async (platform, url, options) => {
    console.log(blue('🚀 Pake Mobile Builder Starting...'));
    console.log(`Platform: ${platform}`);
    console.log(`URL: ${url}`);
    console.log(`App Name: ${options.name}`);

    const platforms = platform === 'both' ? ['android', 'ios'] : [platform];

    for (const targetPlatform of platforms) {
      if (!['android', 'ios'].includes(targetPlatform)) {
        console.error(red(`❌ 不支持的平台: ${targetPlatform}`));
        console.log('支持的平台: android, ios, both');
        process.exit(1);
      }

      try {
        console.log(green(`📱 开始构建 ${targetPlatform.toUpperCase()} 应用...`));

        // 1. 使用标准 pake 创建基础应用
        console.log('📦 创建基础应用...');
        const pakeCmd = `pake "${url}" --name "${options.name}" --width ${options.width} --height ${options.height}`;
        if (options.icon) {
          pakeCmd += ` --icon "${options.icon}"`;
        }
        execSync(pakeCmd, { stdio: 'inherit' });

        // 2. 修复移动端标识符
        console.log('🔧 配置移动端设置...');
        const configPath = 'src-tauri/tauri.conf.json';
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        // 生成合法的标识符
        const identifier = options.identifier ||
          `com.pake.${options.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        config.identifier = identifier;

        // 移动端优化配置
        config.bundle = config.bundle || {};
        config.bundle.targets = ["app"]; // 移动端使用 app 目标

        if (targetPlatform === 'android') {
          config.bundle.android = {
            minSdkVersion: 24
          };
        } else if (targetPlatform === 'ios') {
          config.bundle.iOS = {
            minimumSystemVersion: "13.0"
          };
        }

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        // 3. 设置环境变量
        process.env.ANDROID_HOME = '/opt/homebrew/share/android-commandlinetools';
        process.env.NDK_HOME = '/opt/homebrew/share/android-commandlinetools/ndk/25.2.9519653';

        // 4. 初始化目标平台
        console.log(`🔄 初始化 ${targetPlatform} 平台...`);
        execSync(`tauri ${targetPlatform} init`, { stdio: 'inherit' });

        // 5. 构建应用
        console.log(`🔨 构建 ${targetPlatform} 应用...`);
        const buildCmd = options.debug ?
          `tauri ${targetPlatform} build --debug` :
          `tauri ${targetPlatform} build`;

        execSync(buildCmd, { stdio: 'inherit' });

        // 6. 显示构建结果
        console.log(green(`✅ ${targetPlatform.toUpperCase()} 构建完成！`));

        const outputDir = `src-tauri/gen/${targetPlatform === 'ios' ? 'apple' : 'android'}`;
        if (fs.existsSync(outputDir)) {
          const findCmd = targetPlatform === 'android' ?
            'find . -name "*.apk" -o -name "*.aab"' :
            'find . -name "*.ipa"';

          try {
            const output = execSync(findCmd, { cwd: outputDir, encoding: 'utf8' });
            if (output.trim()) {
              console.log(blue('📦 生成的文件:'));
              console.log(output);
            }
          } catch (e) {
            console.log(yellow('构建完成，请在输出目录中查找生成的文件'));
          }
        }

      } catch (error) {
        console.error(red(`❌ ${targetPlatform} 构建失败:`));
        console.error(error.message);
        process.exit(1);
      }
    }

    console.log(green('🎉 所有平台构建完成！'));
  });

// 保持原有的桌面端命令
program
  .argument('[url]', 'The web URL you want to package')
  .option('--name <string>', 'Application name')
  .option('--icon <string>', 'Application icon')
  .option('--width <number>', 'Window width', 1200)
  .option('--height <number>', 'Window height', 780)
  .option('--use-local-file', 'Use local file packaging', false)
  .option('--fullscreen', 'Start in full screen', false)
  .option('--hide-title-bar', 'For Mac, hide title bar', false)
  .option('--multi-arch', 'For Mac, both Intel and M1', false)
  .option('--inject <url...>', 'Injection of .js or .css files', [])
  .option('--debug', 'Debug build and more output', false)
  .version('3.1.1-mobile', '-v, --version', 'Output the current version')
  .action(async (url, options) => {
    if (!url) {
      program.help();
      return;
    }

    console.log(green('🖥️ 构建桌面应用...'));

    // 调用原有的 pake 命令
    let cmd = `pake "${url}"`;
    if (options.name) cmd += ` --name "${options.name}"`;
    if (options.icon) cmd += ` --icon "${options.icon}"`;
    if (options.width) cmd += ` --width ${options.width}`;
    if (options.height) cmd += ` --height ${options.height}`;
    if (options.useLocalFile) cmd += ` --use-local-file`;
    if (options.fullscreen) cmd += ` --fullscreen`;
    if (options.hideTitleBar) cmd += ` --hide-title-bar`;
    if (options.multiArch) cmd += ` --multi-arch`;
    if (options.inject?.length) cmd += ` --inject ${options.inject.join(' ')}`;
    if (options.debug) cmd += ` --debug`;

    try {
      execSync(cmd, { stdio: 'inherit' });
      console.log(green('✅ 桌面应用构建完成！'));
    } catch (error) {
      console.error(red('❌ 桌面应用构建失败:'));
      console.error(error.message);
      process.exit(1);
    }
  });

program.parse();
