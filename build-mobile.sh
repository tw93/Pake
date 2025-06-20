#!/bin/bash

# Pake 移动端编译脚本
# 使用方法: ./build-mobile.sh [android|ios] [app-name] [url]

set -e

PLATFORM=$1
APP_NAME=$2
URL=$3

if [ -z "$PLATFORM" ] || [ -z "$APP_NAME" ] || [ -z "$URL" ]; then
    echo "使用方法: $0 [android|ios] [app-name] [url]"
    echo "示例: $0 android MyApp https://www.google.com"
    exit 1
fi

echo "🚀 开始构建 $PLATFORM 应用: $APP_NAME"
echo "📱 目标网站: $URL"

# 设置环境变量
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export NDK_HOME=/opt/homebrew/share/android-commandlinetools/ndk/25.2.9519653

# 清理之前的构建
echo "🧹 清理之前的构建..."
rm -rf dist/ src-tauri/target/

# 使用 pake 生成基础应用
echo "📦 使用 Pake 生成基础应用..."
pake "$URL" --name "$APP_NAME" --width 390 --height 844

# 修复移动端标识符
echo "🔧 修复移动端配置..."
IDENTIFIER="com.pake.$(echo $APP_NAME | tr '[:upper:]' '[:lower:]')"
sed -i '' "s/\"identifier\": \"[^\"]*\"/\"identifier\": \"$IDENTIFIER\"/" src-tauri/tauri.conf.json

# 初始化移动端平台
echo "🔄 初始化 $PLATFORM 平台..."
if [ "$PLATFORM" = "android" ]; then
    tauri android init
    echo "🔨 构建 Android APK..."
    tauri android build
    echo "✅ Android APK 构建完成！"
    find src-tauri/gen/android -name "*.apk" -o -name "*.aab"
elif [ "$PLATFORM" = "ios" ]; then
    tauri ios init
    echo "🔨 构建 iOS 应用..."
    tauri ios build
    echo "✅ iOS 应用构建完成！"
    find src-tauri/gen/apple -name "*.ipa"
else
    echo "❌ 不支持的平台: $PLATFORM"
    echo "支持的平台: android, ios"
    exit 1
fi

echo "🎉 $PLATFORM 应用构建完成！"
