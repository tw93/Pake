chcp 65001 | Out-Null

if (-not (Test-Path node_modules)) {
  npm i
}

if (-not (Test-Path output)) {
  New-Item -ItemType Directory -Path output
}

if (-not (Test-Path output\windows)) {
  New-Item -ItemType Directory -Path output\windows
}

Write-Host "`n======================="
Write-Host "build for windows"
Write-Host "=======================`n"

$identifier_prefix = "com.tw93"

# total package number
$index = 1
$total = (Get-Content ./app.csv | Measure-Object -Line).Lines
$common_conf_path = "src-tauri/tauri.conf.json"
$windows_conf_path = "src-tauri/tauri.windows.conf.json"

# ignore first header line
$total = $total - 1

# for windows, we need replace package name to title
# .\script\sd.exe "\"productName\": \"weread\"" "\"productName\": \"WeRead\"" src-tauri\tauri.conf.json
ForEach ($line in (Get-Content -Path .\app.csv | Select-Object -Skip 1)) {
    $name, $title, $name_zh, $url = $line.Split(",")
    Write-Host "building package ${index}/${total}"
    Write-Host "package name is ${name} ${name_zh}"
    Write-Host "=========================="
    Write-Host "building Args is:"
    Write-Host "name = ${name}"
    Write-Host "title = ${title}"
    Write-Host "name_zh = ${name_zh}"
    Write-Host "url = ${url}"
    Write-Host "=========================="
    # -- replace url --
    # clear url with regex
    (Get-Content -Path $common_conf_path -Raw) -replace '"url":\s*"[^"]*"', '"url": ""' | Set-Content -Path $common_conf_path
    # replace url with no regex
    .\script\sd.exe -s '"url": ""'  "`"url`": `"${url}`"" $common_conf_path

    # replace package name
    # clear package_name with regex
    .\script\sd.exe "`"productName`":\s`"(.*?)`"" '"productName": ""' $common_conf_path
    # replace package_name with no regex
    .\script\sd.exe -s '"productName": ""' "`"productName`": `"$title`"" $common_conf_path

    # -- replace icon -- 
    # clear icon path with regex
    (Get-Content -Path $windows_conf_path -Raw) -replace '(?s)"icon":\s*\[[^\]]*\]', '"icon": []' | Set-Content -Path $windows_conf_path
    # replace icon path with no regex
    .\script\sd.exe -s '"icon": []' "`"icon`": [`"png/${name}_256.ico`", `"png/${name}_32.ico`"]" $windows_conf_path

    # -- replace identifier --
    # clear identifier with regex
    (Get-Content -Path $windows_conf_path -Raw) -replace '"identifier":\s*"[^"]*"', '"identifier": ""' | Set-Content -Path $windows_conf_path
    # -- replace identifier with no regex --
    .\script\sd.exe -s '"identifier": ""' "`"identifier`": `"${identifier_prefix}.${name}`"" $windows_conf_path

    # -- replace icon resources --
    # clear resources with regex
    (Get-Content -Path $windows_conf_path -Raw) -replace '(?s)"resources":\s*\[[^\]]*\]', '"resources": []' | Set-Content -Path $windows_conf_path
    # replace resources with no regex
    .\script\sd.exe -s '"resources": []' "`"resources`": [`"png/${name}_32.ico`"]" $windows_conf_path

    if (-not (Test-Path "src-tauri\png\${name}_32.ico")) {
      Copy-Item "src-tauri\png\icon_32.ico" "src-tauri\png\${name}_32.ico"
    }

    if (-not (Test-Path "src-tauri\png\${name}_256.ico")) {
      Copy-Item "src-tauri\png\icon_256.ico" "src-tauri\png\${name}_256.ico"
    }
  
    # build package
    Write-Host "npm run build:windows"
    npm run tauri build -- --target x86_64-pc-windows-msvc
    Move-Item -Path "src-tauri\target\x86_64-pc-windows-msvc\release\bundle\msi\*.msi" -Destination "output\windows\${title}_x64.msi"
    #rm cache
    Remove-Item -Path "src-tauri\target\x86_64-pc-windows-msvc\release\*.exe" -Recurse -Force
    Remove-Item -Path "src-tauri\target\x86_64-pc-windows-msvc\release\resources\*.ico" -Recurse -Force
    Remove-Item -Path "src-tauri\target\x86_64-pc-windows-msvc\release\png\*.ico" -Recurse -Force
    Remove-Item -Path "src-tauri\target\x86_64-pc-windows-msvc\release\wix\*.*" -Recurse -Force
    Remove-Item -Path "src-tauri\target\x86_64-pc-windows-msvc\release\app.*" -Force
    Remove-Item -Path "src-tauri\target\x86_64-pc-windows-msvc\release\resources" -Recurse -Force
    Remove-Item -Path "src-tauri\target\x86_64-pc-windows-msvc\release\png" -Recurse -Force
    Remove-Item -Path "src-tauri\target\x86_64-pc-windows-msvc\release\wix" -Recurse -Force
    Write-Host "package build success!"
    Write-Host ""
    $index++
    # strip blank line for common_conf_path
    $lines = Get-Content ${common_conf_path}
    $lastNonEmptyLineIndex = ($lines.Count - 1)
    while ($lastNonEmptyLineIndex -ge 0 -and -not $lines[$lastNonEmptyLineIndex].Trim()) {
        $lastNonEmptyLineIndex--
    }
    if ($lastNonEmptyLineIndex -lt ($lines.Count - 1)) {
        $lines = $lines[0..$lastNonEmptyLineIndex]
    }
    Set-Content -Path ${common_conf_path} -Value $lines

    # strip blank line for windows conf_path
    $lines = Get-Content ${windows_conf_path}
    $lastNonEmptyLineIndex = ($lines.Count - 1)
    while ($lastNonEmptyLineIndex -ge 0 -and -not $lines[$lastNonEmptyLineIndex].Trim()) {
        $lastNonEmptyLineIndex--
    }
    if ($lastNonEmptyLineIndex -lt ($lines.Count - 1)) {
        $lines = $lines[0..$lastNonEmptyLineIndex]
    }
    Set-Content -Path ${windows_conf_path} -Value $lines
}

Write-Host "output dir is output\windows"
