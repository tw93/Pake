## Install

Please ensure that Node version>=16, such as 16.8, do not use sudo for installation:

```bash
npm install -g pake-cli
```

If the npm report has no permission, you can refer to [How to fix npm throwing error without sudo](https://stackoverflow.com/questions/16151018/how-to-fix-npm-throwing-error-without-sudo).

## Windows and Linux user considerations

- Check out the dependency guide provided by tauri [link](https://tauri.app/v1/guides/getting-started/prerequisites)(**very important**).
- For windows(at least installed `Win10 SDK (10.0.19041.0)` and `Visual Studio build tool 2022(>=17.2)`),additional installation is required:

  1. Microsoft Visual C++ 2015-2022 Redistributable (x64)
  2. Microsoft Visual C++ 2015-2022 Redistributable (x86)
  3. Microsoft Visual C++ 2012 Redistributable (x86) (optional)
  4. Microsoft Visual C++ 2013 Redistributable (x86) (optional)
  5. Microsoft Visual C++ 2008 Redistributable (x86) (optional)

- In addition, Ubuntu can run the following command before starting to install the required dependencies in the early stage.

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

After the packaging, the application defaults to the current working directory. Since the environment needs to be configured for the first packaging, it will take some time. Please wait patiently.

Note: The Rust environment is required for packaging. If you do not have Rust, you will be prompted to confirm the installation. If the installation fails or times out, you can [install](https://www.rust-lang.org/tools/install) it yourself.

### url

The url🔗 is the webpage link you need to package, Must be provided.

### [options]

Some specific options are provided. When packaging, corresponding parameters can be passed to achieve customized effects.

#### [name]

The application name, if not specified when entering, will prompt you to enter, input must be English.

```shell
--name <value>
```

#### [icon]

The application icon, support local and remote files, the default is brand icon of Pake. Customized product icon can go to [icon icons](https://icon-icons.com) Or [macOSicons](https://macosicons.com/#/) download it.

- MacOS must be `.icns`
- Windows must be `.ico`
- Linux must be `.png`

```shell
--icon <path>
```

#### [height]

The height of the packaged application window. The default is `780px`.

```shell
--height <number>
```

#### [width]

The width of the packaged application window. The default is `1200px`.

```shell
--width <number>
```

#### [transparent]

Whether to enable the immersive header. The default is `false`.

```shell
--transparent
```

#### [resize]

Whether the size can be dragged. The default value is `true`.

```shell
--no-resizable
```

#### [fullscreen]

Whether to open the full screen after opening the application. The default is `false`.

```shell
--fullscreen <value>
```
