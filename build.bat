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

set old_name=weread
set old_zh_name=微信阅读
set old_url=weread.qq.com

for /f "tokens=1-3 delims=," %%i in (app.csv) do (
  setlocal enabledelayedexpansion
  set name=%%i
  set name_zh=%%j
  set url=%%k
  @echo on

  ::echo name is !name! !name_zh!  !url!
  :: replace url
  .\sd.exe !old_url! !url! src-tauri\tauri.conf.json
  ::replace pacakge name
  .\sd.exe !old_name! !name! src-tauri\tauri.conf.json
  echo update ico with 32x32 pictue
  echo .\sd.exe !old_name! !name! src-tauri\src\main.rs
  .\sd.exe !old_name! !name! src-tauri\src\main.rs
  ::copy src-tauri\png\!name!_32.ico src-tauri\icons\icon.ico
  echo.
  ::update package info
  set old_zh_name=!name_zh!
  set old_name=!name!
  set old_url=!url!
  ::build package
  echo building package !index!/!total!
  echo package name is !name! !name_zh!
  echo npm run build:windows
  @echo off 
  call npm run tauri build -- --target x86_64-pc-windows-msvc
  move src-tauri\target\x86_64-pc-windows-msvc\release\bundle\msi\*.msi output\windows

  @echo on
  echo package build success!
  echo.
  echo.

  set /A index=index+1
  @echo off 

)
echo "output dir is output\windows"
