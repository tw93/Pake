#!/bin/bash

if [ ! -d "node_modules" ]; then
    npm i
fi


if [ ! -d "output" ]; then
    mkdir output
fi

if [[ "$OSTYPE" =~ ^linux ]]; then
  if [ ! -d "output/linux" ]; then
      mkdir output/linux
  fi
fi


if [[ "$OSTYPE" =~ ^darwin ]]; then
  if [ ! -d "output/macos" ]; then
      mkdir output/macos
  fi
fi




# total package number
export total=`sed -n '$=' app.csv`
export index=1

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

while read line
do
  package_name=$(echo ${line} | cut -d , -f 1)
  package_zh_name=$(echo ${line} | cut -d , -f 2)
  url=$(echo ${line} | cut -d , -f 3)
  echo "update package name and url"
  # replace package info

  if [[ "$OSTYPE" =~ ^linux ]]; then
    sed -i "s/${old_url}/${url}/g" src-tauri/tauri.conf.json
    sed -i "s/${old_name}/${package_name}/g" src-tauri/tauri.conf.json
    echo "update ico with 32x32 pictue"
    sed -i "s/${old_name}/${package_name}/g" src-tauri/src/main.rs

  fi

  if [[ "$OSTYPE" =~ ^darwin ]]; then
    sed -i '' "s|${old_url}|${url}|g" src-tauri/tauri.conf.json
    sed -i '' "s|${old_name}|${package_name}|g" src-tauri/tauri.conf.json
    echo "update ico with 32x32 pictue"
    sed -i "s|${old_name}|${package_name}|g" src-tauri/src/main.rs
  fi
  
  # echo "update ico with 32x32 pictue"
  # cp "src-tauri/png/${package_name}_32.ico" "src-tauri/icons/icon.ico"

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

  if [[ "$OSTYPE" =~ ^linux ]]; then
    mv src-tauri/target/release/bundle/deb/*.deb output/linux
  fi

  if [[ "$OSTYPE" =~ ^darwin ]]; then
    # mv src-tauri/target/release/bundle/deb/*.deb output/linux
    echo ""
  fi
done < app.csv

echo "build all package success!"
if [[ "$OSTYPE" =~ ^linux ]]; then
  echo "result file in output/linux"
fi

if [[ "$OSTYPE" =~ ^darwin ]]; then
  echo "result file in output/macos"
fi