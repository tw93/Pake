Write-Host "Welcome to use Powershell" 
Write-Host "`n======================="
Write-Host "build for windows"
Write-Host "make ture powershell == 7.2.10"
Write-Host "powershell 7.2.10 download url: https://github.com/PowerShell/PowerShell/releases/tag/v7.2.10"
Write-Host "Powershell info in your localhost "
$PSVersionTable
Write-Host "`n=======================`n"

Write-Host "`n======================="
Write-Host "pake parameters is: "
Write-Host "url: " $env:URL
Write-Host "name: " $env:NAME
Write-Host "icon: " $env:ICON
Write-Host "height: " $env:HEIGHT
Write-Host "width: " $env:WIDTH
Write-Host "transparent: " $env:TRANSPARENT
# Write-Host "fullscreen: " $env:FULLSCREEN
Write-Host "resize: " $env:RESIZE
Write-Host "is multi arch? only for Mac: " $env:MULTI_ARCH
Write-Host "targets type? only for Linux: " $env:TARGETS
Write-Host "===========================`n"


Set-Location node_modules/pake-cli
# init params
${Params}=" && node cli.js $env:URL --name $env:NAME"

# download icon
if ((($null -ne $env:URL) -and ($env:URL -ne ""))){
  if ($IsLinux) {
    curl -L "$env:ICON" -o icon.png
    ${Params}="${Params} --icon icon.png"
  } elseif ($IsMacOS) {
    curl -L "$env:ICON" -o icon.icns
    ${Params}="${Params} --icon icon.icns"
  } elseif ($IsWindows) {
    curl -L "$env:ICON" -o icon.ico
    ${Params}="${Params} --icon icon.ico"
  } else {
    Write-Host "it won't download icon, becase it can't detect you OS system!"
  }
}

# height && weight
${Params}="${Params} --height $env:HEIGHT --width $env:WIDTH"

# transparent
if ("$env:TRANSPARENT" -eq "true") {
  ${Params}="${Params} --transparent"
}

# fullscreen
# if ("$env:FULLSCREEN" -eq "true") {
#   ${Params}="${Params} --fullscreen"
# }

# resize
if ("$env:FULLSCREEN" -eq "true" ) {
  ${Params}="${Params} --resize"
}

# multi-arch only for mac
if (($env:MULTI_ARCH -eq "true") -and ($IsMacOS)) {
  rustup target add aarch64-apple-darwin
  ${Params}="${Params} --multi-arch"
}

# targets type, only for linux
if (($null -ne $env:TARGETS) -and ($env:TARGETS -ne "") -and ($IsLinux)) {
  ${Params}="${Params} --targets $env:TARGETS"
}

Write-Host "Pake parameters is: ${Params}"
Write-Host "compile...."
Invoke-Expression $Params

# output
if (-not(Test-Path output)) {
  New-Item -ItemType Directory -Path "output"
}
Move-Item -Path "$env:NAME.*" -Destination "output/"
Write-Host "Build Success"
Set-Location ../..
