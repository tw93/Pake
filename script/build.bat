@echo off
chcp 65001

if not exist node_modules (
  call npm i
)

if not exist output (
  mkdir output
)


if not exist output\windows (
  mkdir output\windows
)

echo.
echo =======================
echo "build for windows"
echo =======================
echo.

:: total package number
set /A index=1
for /f %%a in (' find /c /v "" ^<"app.csv" ') do set /A total=%%a
:: ignore first header line
set /A total=total-1

set old_name=weread
set old_title=WeRead
set old_zh_name=微信阅读
set old_url=https://weread.qq.com/

:: set init name,  we will recovery code to init when build finish.
set init_name=%old_name%
set init_title=%old_title%
set init_zh_name=%old_zh_name%
set init_url=%old_url%

:: for windows, we need replace package name to title
:: .\script\sd.exe "\"productName\": \"weread\"" "\"productName\": \"WeRead\"" src-tauri\tauri.conf.json

for /f "skip=1 tokens=1-4 delims=," %%i in (app.csv) do (
  setlocal enabledelayedexpansion
  set name=%%i
  set title=%%j
  set name_zh=%%k
  set url=%%l
  @echo on

  ::echo name is !name! !name_zh!  !url!
  :: replace url
  .\script\sd.exe -s !old_url! !url! src-tauri\pake.json
  ::replace  pacakge name
  .\script\sd.exe !old_title! !title! src-tauri\tauri.conf.json
  .\script\sd.exe !old_name! !name! src-tauri\tauri.windows.conf.json

  echo.
  ::update package info
  set old_zh_name=!name_zh!
  set old_name=!name!
  set old_title=!title!
  set old_url=!url!
  ::build package
  echo building package !index!/!total!
  echo package name is !name! !name_zh!
  echo npm run build:windows
  @echo off
  call npm run tauri build -- --target x86_64-pc-windows-msvc
  move src-tauri\target\x86_64-pc-windows-msvc\release\bundle\msi\*.msi output\windows\!title!_x64.msi
  ::rm cache
  del /q /f /s src-tauri\target\x86_64-pc-windows-msvc\release\*.exe
  del /q /f /s src-tauri\target\x86_64-pc-windows-msvc\release\resources\*.ico
  del /q /f /s src-tauri\target\x86_64-pc-windows-msvc\release\png\*.ico
  del /q /f /s src-tauri\target\x86_64-pc-windows-msvc\release\wix\*.*
  del /q /f /s src-tauri\target\x86_64-pc-windows-msvc\release\app.*
  rd /s /q src-tauri\target\x86_64-pc-windows-msvc\release\resources
  rd /s /q src-tauri\target\x86_64-pc-windows-msvc\release\png
  rd /s /q src-tauri\target\x86_64-pc-windows-msvc\release\wix
  @echo on
  echo package build success!
  echo.
  echo.

  set /A index=index+1
  @echo off

)

:: for windows, we need replace package name to lower again
:: .\script\sd.exe "\"productName\": \"WeRead\"" "\"productName\": \"weread\"" src-tauri\tauri.conf.json
echo "output dir is output\windows"

::recovery code
.\script\sd.exe %url% %init_url% src-tauri\tauri.conf.json
.\script\sd.exe %title% %init_title% src-tauri\tauri.conf.json
.\script\sd.exe %name% %init_name% src-tauri\tauri.windows.conf.json