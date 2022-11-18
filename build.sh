#!/bin/bash

if [ ! -d "node_modules" ]; then
    npm i
fi

# 依次填入app名称，链接
# Fill in the app name and link in turn
app_list=(
  "weRead  weread.qq.com"
  "aliyuque  www.yuque.com"
  "flomo  flomoapp.com"
  "weRead  weread.qq.com"
)

old_name="weRead"
old_url="weread.qq.com"
for app_info in "${app_list[@]}"; do
  array=($app_info)
  package_name=${array[0]}
  url=${array[1]}
  echo "update package name and url"
  # replace package info
  sed -i "s/${old_url}/${url}/g" src-tauri/tauri.conf.json
  sed -i "s/${old_name}/${package_name}/g" src-tauri/tauri.conf.json
  
  # update package info
  old_name=${package_name}
  old_url=${url}

  echo "update ico with 32x32 pictue"
  cp "src-tauri/png/${package_name}_32.png" "src-tauri/icons/icon.ico"

  echo "build deb/appImage package for Linux x86-64"
  echo "package name is ${package_name}"
  npm run build:linux
  echo "package build success!"
done