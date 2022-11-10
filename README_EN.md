<p align="left"><a href="https://github.com/tw93/Pake">中文</a> | <strong>English</strong></p>
<p align="center">
  <img src=https://gw.alipayobjects.com/zos/k/fa/logo-modified.png width=138/>
  <h1 align="center">Pake</h1>
  <div align="left">A simple way to package a web page with Rust to create Mac App, using Tauri as underlying layer, detailed development tutorial can be seen at the bottom, welcome to <a href=https://github.com/tw93/Pake/discussions>Discussions</a> to see if there have anything you interesting.</div>
  <div align="left">Now supporting WeRead、Twitter、Youtube、Google Translate、Reference、Flomo、Witeboard、YuQue、RunCode、Vercel、V2EX、DevTools.</div>
</p>

## Features

🏂 **Small**：Nearly 40 times smaller than the Electron shell package, less than 3M ([Data](https://static.tw93.fun/img/pakedata.png)).  
😂 **Fast**：Using the Rust Tauri, the performance experience is much lighter and faster than JS, memory is much smaller.  
🩴 **Special**：Not just packaged, with shortcut pass-through, immersive windows, minimalist customization of products.  
🐶 **Toy**：Just a very simple little toy, a way to play with Rust instead of the old idea of shelling the web.  

## Download

<table>
    <tr>
        <td>WeRead <a href="https://github.com/tw93/Pake/releases/latest/download/WeRead.dmg">Download</a></td>
        <td>Twitter <a href="https://github.com/tw93/Pake/releases/latest/download/Twitter.dmg">Download</a></td>
    </tr>
    <tr>
        <td><img src=https://cdn.fliggy.com/upic/17dC9I.jpg width=600/></td>
        <td><img src=https://cdn.fliggy.com/upic/mc41xq.jpg width=600/></td>
    </tr>
    <tr>
        <td>YouTube <a href="https://github.com/tw93/Pake/releases/latest/download/YouTube.dmg">Download</a></td>
        <td>Reference <a href="https://github.com/tw93/Pake/releases/latest/download/Reference.dmg">Download</a></td>
    </tr>
    <tr>
        <td><img src=https://cdn.fliggy.com/upic/Ea5ZRw.png width=600/></td>
        <td><img src=https://cdn.fliggy.com/upic/KFsZIY.png width=600/></td>
    </tr>
    <tr>
        <td>RunCode <a href="https://github.com/tw93/Pake/releases/latest/download/RunCode.dmg">Download</a></td>
        <td>Google Translate <a href="https://github.com/tw93/Pake/releases/latest/download/GoogleTranslate.dmg">Download</a></td>
    </tr>
    <tr>
        <td><img src=https://cdn.fliggy.com/upic/EB1OYP.jpg width=600/></td>
        <td><img src=https://cdn.fliggy.com/upic/EmjUGy.png width=600/></td>
    </tr>
    <tr>
        <td>Flomo <a href="https://github.com/tw93/Pake/releases/latest/download/Flomo.dmg">Download</a></td>
        <td>YuQue <a href="https://github.com/tw93/Pake/releases/latest/download/YuQue.dmg">Download</a></td>
    </tr>
    <tr>
        <td><img src=https://cdn.fliggy.com/upic/jg9Eeu.jpg width=600/></td>
        <td><img src=https://cdn.fliggy.com/upic/02SZQl.png width=600/></td>
    </tr>
</table>

More common apps can be downloaded from [Releases](https://github.com/tw93/Pake/releases).

## Shortcuts

1. <kbd>⌘</kbd> + <kbd>[</kbd>：Return to the previous page
2. <kbd>⌘</kbd> + <kbd>]</kbd>：Go to the next page
3. <kbd>⌘</kbd> + <kbd>↑</kbd>：Auto scroll to top of page
4. <kbd>⌘</kbd> + <kbd>↓</kbd>：Auto scroll to bottom of page
5. <kbd>⌘</kbd> + <kbd>r</kbd>：Refresh Page
6. <kbd>⌘</kbd> + <kbd>w</kbd>：Hide window, not quite
7. <kbd>⌘</kbd> + <kbd>-</kbd>：Zoom out the page
8. <kbd>⌘</kbd> + <kbd>=</kbd>：Zoom in the Page
9. <kbd>⌘</kbd> + <kbd>0</kbd>：Reset the page zoom

In addition, it supports double clicking the head to switch to full screen, and dragging the head to move the window

## Development

Refer to the [Tauri documentation](https://tauri.app/v1/guides/getting-started/prerequisites#setting-up-macos) to quickly configure your environment before you start, if you want to package Windows or Linux systems, you can refer to [Building](https://tauri.app/v1/guides/building/) Documentation.

```sh
// Install Dependencies
npm i

// Local development
npm run dev

// Pack
npm run build
```

## New pack

1. Modify the `tauri.conf.json` in the `src-tauri` directory to include 5 fields `url, productName, icon, title, identifier`, icon can be selected from the `icons` directory or downloaded from [macOSicons](https://macosicons.com/#/) to match the product.
2. For window property settings, you can modify the `width/height` of the `windows` property in `tauri.conf.json`, whether it is `fullscreen`, whether it is `resizable`, If you want to adapt the immersive header, you can set `transparent` to `true` and then find header element and add the `padding-top` style.
3. `npm run dev` for local debugging; `npm run dev:debug` to open the devtools for container debugging.
4. `npm run build` can be run to package for production.

## Advanced

#### 1. How do I rewrite the style, e.g. to remove ads from the original site, or even redesign it?

First, open devtools debug mode with `npm run dev:debug`. After that, find the name of the style you want to change and verify the effect in devtools, and find the location of the style in `pake.js` with `style.innerHTML`. Finally, add the style you need to override, there are some examples you can copy.

#### 2. How to inject js code, e.g. to implement event listeners, e.g. keyboard shortcuts?

Refer to the event listener in `pake.js` with `document.addEventListener`, and write it directly, it's more of a basic front-end technique here.

#### 3. How to communicate with Pake about events in containers, such as dragging and dropping, scrolling, special clicks on the Web, etc.?

Refer to the communication code in `pake.js` with `postMessage`, write the event listener and then use `window.ipc.postMessage` to pass the event and its parameters, then refer to the container to receive events `window.drag_window` and handle them yourself, for more information, refer to tauri and wry's official documentation.

## Support

- I have two cats, one is called TangYuan, and one is called Coke, If you think Pake makes your life better, you can give my cats <a href="https://miaoyan.app/cats.html?name=Pake" target="_blank">feed canned food 🥩🍤</a>.
- If you like Pake, you can star it in Github. We are more welcome to [recommend Pake](https://twitter.com/intent/tweet?url=https://github.com/tw93/Pake&text=Pake%20-%20A%20simple%20Rust%20packaged%20web%20pages%20to%20generate%20Mac%20App%20tool,%20compared%20to%20traditional%20Electron%20package,%20the%20size%20of%20nearly%2040%20times%20smaller,%20generally%20about%202M,%20the%20underlying%20use%20of%20Tauri,%20performance%20experience%20than%20the%20JS%20framework%20is%20much%20lighter~) to your like-minded friends.
- You can follow my [Twitter](https://twitter.com/HiTw93) to get the latest news of Pake, or join [Telegram](https://t.me/miaoyan) chat group.

## Finally

1. I hope that you will enjoy playing with it and let me know if you have any new ideas.
2. If you find a page that would be great for a Mac App, please let me know and I'll add it to the list.
