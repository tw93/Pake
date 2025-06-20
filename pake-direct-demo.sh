#!/bin/bash

# Pake 移动端直接构建示例脚本
# 展示如何用原生 pake 命令直接构建移动端应用

echo "🚀 Pake 移动端直接构建演示"
echo "================================="

# 设置必要的环境变量
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export NDK_HOME=/opt/homebrew/share/android-commandlinetools/ndk/25.2.9519653

PAKE_CLI="/Users/ecarx/Projects/Pake/dist/cli.js"

echo ""
echo "📱 可用的构建命令："
echo ""

echo "1. 构建 Android 应用："
echo "   node $PAKE_CLI \"https://www.baidu.com\" --name \"BaiduApp\" --platform android --width 390 --height 844"
echo ""

echo "2. 构建 iOS 应用："
echo "   node $PAKE_CLI \"https://www.github.com\" --name \"GitHubApp\" --platform ios --width 390 --height 844"
echo ""

echo "3. 同时构建桌面端和移动端："
echo "   node $PAKE_CLI \"https://www.google.com\" --name \"GoogleApp\" --platform all"
echo ""

echo "4. 只构建桌面端（默认）："
echo "   node $PAKE_CLI \"https://www.example.com\" --name \"ExampleApp\""
echo ""

echo "🎯 快速测试命令："
if [ "$1" = "test" ]; then
    echo "正在构建测试应用..."
    cd /tmp
    rm -rf pake-quick-test
    mkdir pake-quick-test
    cd pake-quick-test

    echo "🔨 构建 Android 版百度搜索..."
    node $PAKE_CLI "https://www.baidu.com" --name "BaiduSearch" --platform android --width 390 --height 844
else
    echo "添加 'test' 参数来运行快速测试："
    echo "   ./pake-direct-demo.sh test"
fi
