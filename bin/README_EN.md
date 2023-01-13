## Install

```bash
npm install -g pake-cli
```

If the installation fails and you are prompted that you do not have permission, please see this [website](https://gist.github.com/Giancarlos/d087f8a9e6516716da98ad0c0f5a8f58) .

Also make sure that you're using a correct Node.js version `>=16 as 16.18.1`. If you're using [nvm](https://github.com/nvm-sh/nvm) for Node.js version management you may run `nvm use` from the root folder of the project and the correct version will be picked up. Other Node.js version management tools, such as [fnm](https://github.com/Schniz/fnm) and [tj/n](https://github.com/tj/n), should also have similar feature.

**try not to use `sudo` permissions**, If you must use sudo, you need install rust in you system environment. For Mac, you can use brew to install it. For Linux like Ubuntu, you need apt to install it. In addition, Ubuntu can run the following commands before starting, depending on the previous needs.

```bash
sudo apt install libdbus-1-dev libgtk-3-dev libsoup2.4-dev libjavascriptcoregtk-4.0-dev libwebkit2gtk-4.0-dev
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
