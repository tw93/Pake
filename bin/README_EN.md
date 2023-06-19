## Install

Ensure the version of your installed Node.js is greater than `16.0` such as `16.8`. Do not use `sudo` to install. If you encountered permission issues/problems while installing using npm, see [How to fix npm throwing error without sudo](https://stackoverflow.com/questions/16151018/how-to-fix-npm-throwing-error-without-sudo).

```bash
npm install -g pake-cli
```

## Notes for Windows & Linux users

- **VERY IMPORTANT**: Check out [the Tauri prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites) before proceeding.
- For Windows users who had been installed `Win10 SDK (10.0.19041.0)` and `Visual Studio build tool 2022(>=17.2)`, you may need to install these additionally:

  1. Microsoft Visual C++ 2015-2022 Redistributable (x64)
  2. Microsoft Visual C++ 2015-2022 Redistributable (x86)
  3. Microsoft Visual C++ 2012 Redistributable (x86) (optional)
  4. Microsoft Visual C++ 2013 Redistributable (x86) (optional)
  5. Microsoft Visual C++ 2008 Redistributable (x86) (optional)

- For Ubuntu users, run the following commands to install the required libraries before compiling:

  ```bash
  sudo apt install libdbus-1-dev \
      libsoup2.4-dev \
      libjavascriptcoregtk-4.0-dev \
      libwebkit2gtk-4.0-dev \
      build-essential \
      curl \
      wget \
      libssl-dev \
      libgtk-3-dev \
      libayatana-appindicator3-dev \
      librsvg2-dev \
      gnome-video-effects \
      gnome-video-effects-extra
  ```

## Usage

```bash
pake url [options]
```

The packaged application will be placed in the current working directory by default. Since the environment needs to be configured for the first packaging, it will take some time. Please wait patiently.

> **Note**:
> The Rust environment is required for packaging. If you have not installed Rust, you will be prompted to confirm the installation. If the installation fails or times out, you can [install](https://www.rust-lang.org/tools/install) by yourself.

### url

The url🔗 is the link to the website you want to package. Required.

### [options]

We provide some options for customization. When packaging, the corresponding arguments can be passed to configure your app.

#### [name]

The name of your application. We will prompt you to enter this if you do not provide it in this phase. Input must be in English.

```shell
--name <value>
# or
-n <value>
```

#### [icon]

The application icon. Supports local and remote files. By default, it is the brand icon of Pake. For customizing the icon of your product, go to [icon icons](https://icon-icons.com) or [macOSicons](https://macosicons.com/#/) to download it.

- macOS must be `.icns`
- Windows must be `.ico`
- Linux must be `.png`

```shell
--icon <path>
# or
-i <path>
```

#### [height]

The height of the packaged application window. The default is `780px`.

```shell
--height <number>
# or
-h <number>
```

#### [width]

The width of the packaged application window. The default is `1200px`.

```shell
--width <number>
# or
-w <number>
```

#### [transparent]

Whether to enable the immersive header. The default is `false`. Use the command below to enable this feature.

```shell
--transparent
```

#### [fullscreen]

Indicates if the window should be full screen on application launch. The default is `false`.
Use the command below to enable this feature.

```shell
--fullscreen
```

#### [resize]

Indicates if the window can be resized. The default value is `true`.
Use the command below to disable this feature.

```shell
--no-resizable
#or
-r
```

#### [multi-arch]

Package results support both Intel and m1 chips, only for MacOS. The default is `false`.

```shell
--targets xxx
```

##### Preparation

- Note: After enabling this option, you need to use rustup on the rust official website to install rust, brew installation is not supported.
- For intel chip users, you need to install the arm64 cross-platform package to make the installation package support the m1 chip, and use the following command to install.

```shell
rustup target add aarch64-apple-darwin
```

- For M1 chip users, you need to install the x86 cross-platform package to make the installation package support the interl chip, and use the following command to install.

```shell
rustup target add x86_64-apple-darwin
```

##### Instructions

```shell
--multi-arch
# or
-m
```

#### [targets]

Select the output package format, support deb/appimage/all, if all is selected, deb and appimage will be packaged at the same time, this option only supports Linux, the default is `all`.

#### [user-agent]

Custom browser user agent, default is empty.

```shell
--user-agent <value>
```

#### [show-menu]

Display the menu bar, not display it by default, enter the following command and it will be displayed. MacOS users are recommended to enable.

```shell
--show-menu
```

#### [show-system-tray]

Display the notification tray, not display it by default, entering the following command will display.

```shell
--show-system-tray <value>
```

#### [system-tray-icon]

The notification tray icon is only valid when the notification tray is displayed. The icon must be a 32x32~256x256 pixel image in .ico or .png format.

```shell
--system-tray-icon <value>
```

#### [copy-iter-file]

Recursive copy, when the url is a local file path, if this option is enabled, the folder where the url path file is located and all sub-files are copied to the pake static folder, which is not enabled by default

```shell
--copy-iter-file
```
