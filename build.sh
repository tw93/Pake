#!/bin/bash

if [ ! -d "node_modules" ]; then
    npm i
fi

# 依次填入app名称，链接
# Fill in the app name and link in turn
app_list=(
  "weread 微信阅读  weread.qq.com"
  "aliyuque 语雀  www.yuque.com"
  "flomo 浮墨 flomoapp.com"
  "weread 微信阅读 weread.qq.com"
)

old_name="weread"
old_zh_name="微信阅读"
old_url="weread.qq.com"
for app_info in "${app_list[@]}"; do
  array=($app_info)
  package_name=${array[0]}
  package_zh_name=${array[1]}
  url=${array[2]}
  echo "update package name and url"
  # replace package info
  sed -i "s/${old_url}/${url}/g" src-tauri/tauri.conf.json
  sed -i "s/${old_name}/${package_name}/g" src-tauri/tauri.conf.json
  
  echo "update ico with 32x32 pictue"
  cp "src-tauri/png/${package_name}_32.png" "src-tauri/icons/icon.ico"

  echo "update desktop"
  mv "src-tauri/assets/com-tw93-${old_name}.desktop" "src-tauri/assets/com-tw93-${package_name}.desktop"
  sed -i "s/${old_zh_name}/${package_zh_name}/g" "src-tauri/assets/com-tw93-${package_name}.desktop"
  sed -i "s/${old_name}/${package_name}/g" "src-tauri/assets/com-tw93-${package_name}.desktop"

  # update package info
  old_zh_name=${package_zh_name}
  old_name=${package_name}
  old_url=${url}

  echo "build deb/appImage package for Linux x86-64"
  echo "package name is ${package_name}"
  npm run build:linux
  echo "package build success!"
done