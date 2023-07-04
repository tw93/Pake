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

SHELL_FOLDER=$(cd "$(dirname "$0")" || exit 1; pwd)
PROJECT_FOLDER=`dirname ${SHELL_FOLDER}`
echo "shell folder is ${SHELL_FOLDER}"
echo "project folder is ${PROJECT_FOLDER}"

# total app number, ignore first line
total=$(sed -n '$=' app.csv)
export total=$((total-1))
export index=1

export package_prefix="com-pake"
export identifier_prefix="com.pake"

if [[ "$OSTYPE" =~ ^linux ]]; then
    echo "==============="
    echo "Build for Linux"
    echo "==============="
    export sd=${SHELL_FOLDER}/sd-linux-`arch`
    chmod +x "$sd"
    export desktop_file="src-tauri/assets/*.desktop"
fi

if [[ "$OSTYPE" =~ ^darwin ]]; then
    echo "==============="
    echo "Build for MacOS"
    echo "==============="

    export sd=${SHELL_FOLDER}/sd-apple-x64
    chmod +x "$sd"
fi

tail -n +2 app.csv | while IFS=, read -r -a arr;
do
    package_name=${arr[0]}
    package_title=${arr[1]}
    package_zh_name=${arr[2]}
    url=${arr[3]}

    # replace package info
    # clear url with regex
    $sd "\"url\": \"(.*?)\"," "\"url\": \"\"," src-tauri/pake.json
    # replace url with no regex
    $sd -s "\"url\": \"\","  "\"url\": \"${url}\"," src-tauri/pake.json

    # for apple, need replace title
    if [[ "$OSTYPE" =~ ^darwin ]]; then
        # update icon
        # if icon exists, change icon path
        if [ ! -f "src-tauri/icons/${package_name}.icns" ]; then
            # else, replace icon to default
            echo "warning"
            echo "icon for MacOS not exist, will use default icon to replace it"
            echo "warning"
            cp "src-tauri/icons/icon.icns" "src-tauri/icons/${package_name}.icns"
        fi
        # clear package_name with regex
        $sd "\"productName\": \"(.*?)\"," "\"productName\": \"\"," src-tauri/tauri.conf.json
        # replace package_name with no regex
        $sd -s "\"productName\": \"\"," "\"productName\": \"${package_title}\"," src-tauri/tauri.conf.json
        # clear icon path with regex
        $sd "\"icon\": \[\"(.*?)\"\]," "\"icon\": [\"\"]," src-tauri/tauri.macos.conf.json
        # replace icon path with no regex
        $sd -s "\"icon\": [\"\"]," "\"icon\": [\"icons/${package_name}.icns\"]," src-tauri/tauri.macos.conf.json
        # clear identifier with regex
        $sd "\"identifier\": \"(.*?)\"," "\"identifier\": \"\"," src-tauri/tauri.macos.conf.json
        # replace identifier with not regex
        $sd -s "\"identifier\": \"\"," "\"identifier\": \"${identifier_prefix}.${package_name}\"," src-tauri/tauri.macos.conf.json
    fi

    # echo "update ico with 32x32 picture"
    # cp "src-tauri/png/${package_name}_32.ico" "src-tauri/icons/icon.ico"

    if [[ "$OSTYPE" =~ ^linux ]]; then
        # update icon
        # if icon exists, change icon path
        if [ ! -f "src-tauri/png/${package_name}_512.png" ]; then
            # else, replace icon to default
            echo "warning"
            echo "icon for linux not exist, will use default icon to replace it"
            echo "warning"
            cp "src-tauri/png/icon_512.png" "src-tauri/png/${package_name}_512.png"
        fi
        # -- replace package name -- #
        # clear package_name with regex
        $sd "\"productName\": \"(.*?)\"," "\"productName\": \"\"," src-tauri/tauri.conf.json
        # replace package_name with no regex
        $sd -s "\"productName\": \"\"," "\"productName\": \"${package_prefix}-${package_name}\"," src-tauri/tauri.conf.json

        # -- replace systemTray iconPath -- #
        # clear systemTray iconPath with regex
        $sd "\"iconPath\": \"(.*?)\"," "\"iconPath\": \"\"," src-tauri/tauri.conf.json
        # replace systemTray iconPath with no regex
        $sd -s "\"iconPath\": \"\"," "\"iconPath\": \"png/${package_name}_512.png\"," src-tauri/tauri.conf.json

        # -- replace icon -- #
        # clear icon path with regex
        $sd "\"icon\": \[\"(.*?)\"\]," "\"icon\": [\"\"]," src-tauri/tauri.linux.conf.json
        # replace icon path with no regex
        $sd -s "\"icon\": [\"\"]," "\"icon\": [\"png/${package_name}_512.png\"]," src-tauri/tauri.linux.conf.json

        # -- replace identifier -- #
        # clear identifier with regex
        $sd "\"identifier\": \"(.*?)\"," "\"identifier\": \"\"," src-tauri/tauri.linux.conf.json
        # replace identifier with not regex
        $sd -s "\"identifier\": \"\"," "\"identifier\": \"${identifier_prefix}.${package_name}\"," src-tauri/tauri.linux.conf.json
        echo "update desktop"

        new_desktop="${PROJECT_FOLDER}/src-tauri/assets/${package_prefix}-${package_name}.desktop"
        new_desktop_map_path="/usr/share/applications/${package_prefix}-${package_name}.desktop"
        for file in `ls ${PROJECT_FOLDER}/src-tauri/assets/*.desktop`
        do
            mv "${file}" "${new_desktop}"
            echo mv "${file}" "${new_desktop}"
        done
        # clear desktop file with regex
        $sd "\"files\": \{\"(.*)\"\}" "\"files\": \{\"\"\}" src-tauri/tauri.linux.conf.json
        # replace desktop file with no regex
        $sd -s "\"files\": \{\"\"\}" "\"files\": {\"${new_desktop_map_path}\": \"${new_desktop}\"}" src-tauri/tauri.linux.conf.json
        # clear desktop content with regex
        $sd "Exec=.*" "Exec=" "${new_desktop}"
        $sd "Icon=.*" "Icon=" "${new_desktop}"
        $sd "Name=.*" "Name=" "${new_desktop}"
        $sd "Name\[zh_CN\]=.*" "Name[zh_CN]=" "${new_desktop}"
        # repleace dekstop content with no reg
        $sd -s "Exec=" "Exec=${package_prefix}-${package_name}" "${new_desktop}"
        $sd -s "Icon=" "Icon=${package_prefix}-${package_name}" "${new_desktop}"
        $sd -s "Name=" "Name=${package_title}" "${new_desktop}"
        $sd -s "Name[zh_CN]=" "Name[zh_CN]=${package_zh_name}" "${new_desktop}"
    fi

    echo "building package ${index}/${total}"
    echo "package name is ${package_name} (${package_zh_name})"

    if [[ "$OSTYPE" =~ ^linux ]]; then
        npm run tauri build
        mv src-tauri/target/release/bundle/deb/${package_prefix}-"${package_name}"*.deb output/linux/"${package_title}"_`arch`.deb
        mv src-tauri/target/release/bundle/appimage/${package_prefix}-"${package_name}"*.AppImage output/linux/"${package_title}"_`arch`.AppImage
        echo clear cache
        rm src-tauri/target/release
        rm -rf src-tauri/target/release/bundle

    fi

    if [[ "$OSTYPE" =~ ^darwin ]]; then

        npm run tauri build -- --target universal-apple-darwin
        mv src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg output/macos/"${package_title}".dmg
        echo clear cache
        rm -rf src-tauri/target/universal-apple-darwin
        rm src-tauri/target/aarch64-apple-darwin/release
        rm src-tauri/target/x86_64-apple-darwin/release
    fi

    echo "package build success!"
    index=$((index+1))
done

echo "build all package success!"
echo "you run 'rm src-tauri/assets/*.desktop && git checkout src-tauri' to recovery code"
