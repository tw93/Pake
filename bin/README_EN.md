## Install

```bash
npm install -g pake-cli
```

If the installation fails and you are prompted that you do not have permission, please see this [website](https://gist.github.com/Giancarlos/d087f8a9e6516716da98ad0c0f5a8f58) , attention! **try not to use sudo permissions**.

## Usage

```bash
pake url [options]
```

After the packaging, the application defaults to the current working directory. Since the environment needs to be configured for the first packaging, it will take some time. Please wait patiently.

Note: The Rust environment is required for packaging. If you do not have Rust, you will be prompted to confirm the installation. If the installation fails or times out, you can [install](https://www.rust-lang.org/tools/install) it yourself.

Note: Currently only Macos are supported, and other platforms will be supported later.

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

应用 icon，支持本地/远程文件，默认为 Pake 自带图标。

- MacOS must be `.icns`
- Windows must be `.ico`
- Linux must be `.png`

```shell
--icon <path>
```

#### [height]

The height of the packaged application window. The default is `800px`.

```shell
--height <number>
```

#### [width]

The width of the packaged application window. The default is `1280px`.

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
