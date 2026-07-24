#!/usr/bin/env bash

set -euo pipefail

version="4.8.1"
root_url="https://download.qt.io/official_releases/qt-installer-framework/$version"
install_root="$RUNNER_TEMP/QtIFW"

case "$RUNNER_OS" in
  Windows)
    file="QtInstallerFramework-windows-x64-4.8.1.exe"
    expected="b0a7c6816dfaff7d571c9e5350fc08952f12022be87a28f6d8d36a78428c6210"
    ;;
  macOS)
    file="QtInstallerFramework-macOS-x64-4.8.1.dmg"
    expected="f63b46c8e5b9c9fe5e42999bd94886cc827b0a951012b3c55d31c60576734bcd"
    ;;
  Linux)
    file="QtInstallerFramework-linux-x64-4.8.1.run"
    expected="4b6f61a81b6560b27e40d5a25584685a8407642ac5430ba91e503f9b31986797"
    ;;
  *)
    echo "Unsupported QtIFW build platform: $RUNNER_OS" >&2
    exit 1
    ;;
esac

installer="$RUNNER_TEMP/$file"
curl --fail --location --retry 3 --output "$installer" "$root_url/$file"
if [[ "$RUNNER_OS" == "macOS" ]]; then
  actual="$(shasum -a 256 "$installer" | awk '{print $1}')"
  test "$actual" = "$expected"
else
  echo "$expected  $installer" | sha256sum -c -
fi

if [[ "$RUNNER_OS" == "Linux" ]]; then
  sudo apt-get update -qq
  sudo apt-get install -y --no-install-recommends \
    libxkbcommon-x11-0 \
    libxcb-cursor0 \
    libxcb-icccm4 \
    libxcb-image0 \
    libxcb-keysyms1 \
    libxcb-randr0 \
    libxcb-render-util0 \
    libxcb-shape0 \
    libxcb-sync1 \
    libxcb-xfixes0 \
    libxcb-xinerama0
fi

if [[ "$RUNNER_OS" == "macOS" ]]; then
  mount_point="$RUNNER_TEMP/qtifw-mount"
  mkdir -p "$mount_point"
  hdiutil attach "$installer" -nobrowse -readonly -mountpoint "$mount_point"
  trap 'hdiutil detach "$mount_point" || true' EXIT
  executable="$(find "$mount_point" -path '*/Contents/MacOS/*' -type f | head -n 1)"
  test -n "$executable"
else
  chmod +x "$installer"
  executable="$installer"
fi

"$executable" --root "$install_root" --accept-licenses --default-answer \
  --confirm-command install org.qtproject.ifw.binaries

suffix=""
if [[ "$RUNNER_OS" == "Windows" ]]; then
  suffix=".exe"
fi
binary_creator="$(find "$RUNNER_TEMP" -name "binarycreator$suffix" -type f | head -n 1)"
test -n "$binary_creator"
echo "QTIFW_BIN=$(dirname "$binary_creator")" >> "$GITHUB_ENV"
