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

set identifier_prefix="com.tw93"



:: total package number
set /A index=1
for /f %%a in (' find /c /v "" ^<"app.csv" ') do set /A total=%%a
:: ignore first header line
set /A total=total-1


:: for windows, we need replace package name to title
:: .\script\sd.exe "\"productName\": \"weread\"" "\"productName\": \"WeRead\"" src-tauri\tauri.conf.json

for /f "skip=1 tokens=1-4 delims=," %%i in (app.csv) do (
  setlocal enabledelayedexpansion
  set name=%%i
  set title=%%j
  set name_zh=%%k
  set url=%%l
  @echo on

  :: replace url
  :: clear url with regex
  .\script\sd.exe "\"url\": \"(.*?)\"," "\"url\": \"\"," src-tauri/tauri.conf.json
  :: replace url with no regex
  .\script\sd.exe -s "\"url\": \"\","  "\"url\": \"!url!\"," src-tauri/tauri.conf.json

  ::replace  pacakge name
  :: clear package_name with regex
  .\script\sd.exe "\"productName\": \"(.*?)\"," "\"productName\": \"\"," src-tauri/tauri.conf.json
  :: replace package_name with no regex
  .\script\sd.exe -s "\"productName\": \"\"," "\"productName\": \"!title!\"," src-tauri/tauri.conf.json

  :: replace icon
  ::clear icon path with regex
  .\script\sd.exe "\"icon\": \[\"(.*?)\"\]," "\"icon\": [\"\"]," src-tauri/tauri.windows.conf.json
  :: replace icon path with no regex
  .\script\sd.exe -s "\"icon\": [\"\"]," "\"icon\": [\"icons/!name!_256.ico\", \"!name!_32.ico\"]," src-tauri/tauri.windows.conf.json

  :: replace identifier
  :: clear identifier with regex
  .\script\sd.exe "\"identifier\": \"(.*?)\"," "\"identifier\": \"\"," src-tauri/tauri.windows.conf.json
  :: replace identifier with not regex
  .\script\sd.exe -s "\"identifier\": \"\"," "\"identifier\": \"!identifier_prefix!.!name!\"," src-tauri/tauri.windows.conf.json

  :: replace icon resources
  :: clear resources with regex
  .\script\sd.exe "\"resources\": \[\"(.*?)\"\]" "\"resources\": \[\"\"\]" src-tauri/tauri.windows.conf.json
  :: replace resources with no regex
  .\script\sd.exe -s "\"resources\": [\"\"]" "\"resources\": [\"!name!_32.ico\"]" src-tauri/tauri.windows.conf.json

  if not exist src-tauri\png\!name!_32.ico (
    copy src-tauri\png\icon_32.ico src-tauri\png\!name!_32.ico
  )

  if not exist src-tauri\png\!name!_256.ico (
    copy src-tauri\png\icon_256.ico src-tauri\png\!name!_256.ico
  )
  echo.
  
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
