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
# total package number
export index=1
export total=4

old_name="weread"
old_zh_name="微信阅读"
old_url="weread.qq.com"
package_prefix="com-tw93"

if [[ "$OSTYPE" =~ ^linux ]]; then
  echo "==============="
  echo "Build for Linux"
  echo "==============="
  # for linux, package name may be com.xxx.xxx
  echo "rename package name"
  export desktop_file="src-tauri/assets/${package_prefix}.weread.desktop"
  sed -i "s/\"productName\": \"weread\"/\"productName\": \"${package_prefix}-weread\"/g" src-tauri/tauri.conf.json
fi

if [[ "$OSTYPE" =~ ^darwin ]]; then
  echo "==============="
  echo "Build for MacOS"
  echo "==============="
fi

for app_info in "${app_list[@]}"; do
  array=($app_info)
  package_name=${array[0]}
  package_zh_name=${array[1]}
  url=${array[2]}
  echo "update package name and url"
  # replace package info

  if [[ "$OSTYPE" =~ ^linux ]]; then
    sed -i "s/${old_url}/${url}/g" src-tauri/tauri.conf.json
    sed -i "s/${old_name}/${package_name}/g" src-tauri/tauri.conf.json
  fi

  if [[ "$OSTYPE" =~ ^darwin ]]; then
    sed -i '' "s|${old_url}|${url}|g" src-tauri/tauri.conf.json
    sed -i '' "s|${old_name}|${package_name}|g" src-tauri/tauri.conf.json
  fi
  
  echo "update ico with 32x32 pictue"
  cp "src-tauri/png/${package_name}_32.png" "src-tauri/icons/icon.ico"

  if [[ "$OSTYPE" =~ ^linux ]]; then
    echo "update desktop"
    old_desktop="src-tauri/assets/${package_prefix}-${old_name}.desktop"
    new_desktop="src-tauri/assets/${package_prefix}-${package_name}.desktop"
    mv ${old_desktop}  ${new_desktop}
    sed -i "s/${old_zh_name}/${package_zh_name}/g" ${new_desktop}
    sed -i "s/${old_name}/${package_name}/g" ${new_desktop}
  fi

  # update package info
  old_zh_name=${package_zh_name}
  old_name=${package_name}
  old_url=${url}

  echo "building package ${index}/${total}"
  echo "package name is ${package_name} (${package_zh_name})"
  npm run tauri build
  echo "package build success!"
  index=$(($index+1))
done