import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import log from 'loglevel';
import chalk from 'chalk';

const { green, yellow, blue, red } = chalk;

export async function buildMobileApp(url: string, options: any, skipDesktopBuild: boolean = false) {
  const platforms = options.platform === 'all' ? ['android', 'ios'] :
                   options.platform === 'desktop' ? [] : [options.platform];

  if (platforms.length === 0) {
    // 桌面端构建，返回 false 表示使用原有流程
    return false;
  }

  console.log(blue('📱 Pake Mobile Builder Starting...'));
  console.log(`Platform(s): ${platforms.join(', ')}`);
  console.log(`URL: ${url}`);
  console.log(`App Name: ${options.name || 'PakeApp'}`);

  // 设置移动端环境变量
  process.env.ANDROID_HOME = '/opt/homebrew/share/android-commandlinetools';
  process.env.NDK_HOME = '/opt/homebrew/share/android-commandlinetools/ndk/25.2.9519653';

  for (const targetPlatform of platforms) {
    if (!['android', 'ios'].includes(targetPlatform)) {
      console.error(red(`❌ 不支持的平台: ${targetPlatform}`));
      console.log('支持的平台: desktop, android, ios, all');
      process.exit(1);
    }

    try {
      console.log(green(`📱 开始构建 ${targetPlatform.toUpperCase()} 应用...`));

      // 等待桌面端构建完成，确保 src-tauri 目录存在
      let configPath = 'src-tauri/tauri.conf.json';
      let waitCount = 0;
      while (!fs.existsSync(configPath) && waitCount < 30) {
        console.log('⏳ 等待项目初始化完成...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        waitCount++;
      }

      if (!fs.existsSync(configPath)) {
        throw new Error('项目初始化超时，未找到 tauri.conf.json 文件');
      }

      // 检查并修复配置文件中的标识符
      console.log('🔧 配置移动端设置...');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

      // 修复移动端标识符
      if (config.identifier && /^\d/.test(config.identifier.split('.').pop())) {
        const appName = (options.name || 'PakeApp').toLowerCase().replace(/[^a-z0-9]/g, '');
        config.identifier = `com.pake.${appName}`;
        log.info(`修复标识符: ${config.identifier}`);
      }

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

      // 初始化目标平台
      console.log(`🔄 初始化 ${targetPlatform} 平台...`);
      try {
        execSync(`tauri ${targetPlatform} init`, { stdio: 'inherit' });
      } catch (error) {
        log.warn(`平台初始化警告: ${error.message}`);
      }

      // 构建应用
      console.log(`🔨 构建 ${targetPlatform} 应用...`);
      const buildCmd = options.debug ?
        `tauri ${targetPlatform} build --debug` :
        `tauri ${targetPlatform} build`;

      execSync(buildCmd, { stdio: 'inherit' });

      // 显示构建结果
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

  console.log(green('🎉 所有移动端平台构建完成！'));
  return true; // 表示已处理移动端构建
}
