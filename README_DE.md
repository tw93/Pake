<div align="center">
  <img src="https://gw.alipayobjects.com/zos/k/fa/logo-modified.png" width="138" />
  <h1>Pake</h1>
  <p><b>Verwandeln Sie beliebige Webseiten in schlanke, schnelle Desktop-Apps. Unterstützt macOS, Windows und Linux</b></p>
  <p><a href="README.md">English</a> · <a href="README_CN.md">中文</a> · <a href="README_TW.md">繁體</a> · <a href="README_JA.md">日本語</a> · <a href="README_KR.md">한국어</a> · Deutsch · <a href="README_FR.md">Français</a></p>
  <a href="https://twitter.com/HiTw93" target="_blank"><img alt="twitter" src="https://img.shields.io/badge/follow-Tw93-red?style=flat-square&logo=Twitter"></a>
  <a href="https://t.me/+9f9gf4ZrFSQ2OWVl" target="_blank"><img alt="telegram" src="https://img.shields.io/badge/chat-telegram-blueviolet?style=flat-square&logo=Telegram"></a>
  <a href="https://github.com/tw93/Pake/releases" target="_blank"><img alt="GitHub downloads" src="https://img.shields.io/github/downloads/tw93/Pake/total.svg?style=flat-square"></a>
  <a href="https://github.com/tw93/Pake/commits" target="_blank"><img alt="GitHub commit" src="https://img.shields.io/github/commit-activity/m/tw93/Pake?style=flat-square"></a>
  <a href="https://github.com/tw93/Pake/issues?q=is%3Aissue+is%3Aclosed" target="_blank"><img alt="GitHub closed issues" src="https://img.shields.io/github/issues-closed/tw93/Pake.svg?style=flat-square"></a>
</div>

## Features

- 🎐 **Leichtgewichtig**: Das Installationspaket ist fast 20-mal kleiner als bei Electron-Apps, meist unter 10 MB auf der Festplatte
- 🚀 **Schnell**: Entwickelt mit Rust Tauri, deutlich schneller als herkömmliche JS-Frameworks bei geringerem Arbeitsspeicherbedarf
- ⚡ **Einfach zu bedienen**: Paketierung mit einem einzigen CLI-Befehl oder per Online-Build ohne aufwendige Konfiguration
- 📦 **Umfangreich**: Unterstützt Tastenkombinationen, immersive Fenster, Drag & Drop, CSS-Anpassung und Werbeblocker

## Erste Schritte

- **Einsteiger**: Laden Sie fertige [Beliebte Pakete](#beliebte-pakete-herunterladen) herunter oder nutzen Sie den [GitHub Actions Online-Build](docs/github-actions-usage.md) ohne lokale Einrichtung
- **Entwickler**: Installieren Sie das [CLI-Tool](docs/cli-usage.md) für die Ein-Befehl-Paketierung jeder Website mit anpassbaren Icons und Fenstereinstellungen
- **Fortgeschrittene**: Klonen Sie das Projekt für [Eigene Entwicklung](#entwicklung) oder lesen Sie die [Erweiterte Dokumentation](docs/advanced-usage.md) für individuelle Anpassungen
- **Fehlerbehebung**: Häufige Fragen und Lösungen finden Sie in den [FAQ](docs/faq.md)

## Beliebte Pakete herunterladen

<table>
    <tr>
        <td>WeRead
            <a href="https://github.com/tw93/Pake/releases/latest/download/WeRead.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/WeRead_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/WeRead_x86_64.deb">Linux</a>
        </td>
        <td>Twitter
            <a href="https://github.com/tw93/Pake/releases/latest/download/Twitter.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/Twitter_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/Twitter_x86_64.deb">Linux</a>
        </td>
    </tr>
    <tr>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/WeRead.jpg width=600/></td>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/Twitter.jpg width=600/></td>
    </tr>
    <tr>
        <td>Grok
            <a href="https://github.com/tw93/Pake/releases/latest/download/Grok.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/Grok_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/Grok_x86_64.deb">Linux</a>
        </td>
        <td>DeepSeek
            <a href="https://github.com/tw93/Pake/releases/latest/download/DeepSeek.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/DeepSeek_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/DeepSeek_x86_64.deb">Linux</a>
        </td>
    </tr>
    <tr>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/Grok.png width=600/></td>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/DeepSeek.png width=600/></td>
    </tr>
    <tr>
        <td>ChatGPT
            <a href="https://github.com/tw93/Pake/releases/latest/download/ChatGPT.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/ChatGPT_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/ChatGPT_x86_64.deb">Linux</a>
        </td>
        <td>Gemini
            <a href="https://github.com/tw93/Pake/releases/latest/download/Gemini.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/Gemini_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/Gemini_x86_64.deb">Linux</a>
        </td>
    </tr>
    <tr>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/ChatGPT.png width=600/></td>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/Gemini.png width=600/></td>
    </tr>
    <tr>
      <td>YouTube Music
            <a href="https://github.com/tw93/Pake/releases/latest/download/YouTubeMusic.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/YouTubeMusic_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/YouTubeMusic_x86_64.deb">Linux</a>
      </td>
      <td>YouTube
            <a href="https://github.com/tw93/Pake/releases/latest/download/YouTube.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/YouTube_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/YouTube_x86_64.deb">Linux</a>
      </td>
    </tr>
    <tr>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/YouTubeMusic.png width=600 /></td>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/YouTube.jpg width=600 /></td>
    </tr>
    <tr>
        <td>LiZhi
            <a href="https://github.com/tw93/Pake/releases/latest/download/LiZhi.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/LiZhi_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/LiZhi_x86_64.deb">Linux</a>
        </td>
        <td>ProgramMusic
            <a href="https://github.com/tw93/Pake/releases/latest/download/ProgramMusic.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/ProgramMusic_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/ProgramMusic_x86_64.deb">Linux</a>
        </td>
    </tr>
    <tr>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/LiZhi.jpg width=600/></td>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/ProgramMusic.jpg width=600/></td>
    </tr>
    <tr>
        <td>Excalidraw
            <a href="https://github.com/tw93/Pake/releases/latest/download/Excalidraw.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/Excalidraw_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/Excalidraw_x86_64.deb">Linux</a>
        </td>
        <td>XiaoHongShu
            <a href="https://github.com/tw93/Pake/releases/latest/download/XiaoHongShu.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/XiaoHongShu_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/XiaoHongShu_x86_64.deb">Linux</a>
        </td>
    </tr>
    <tr>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/Excalidraw.png width=600/></td>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/XiaoHongShu.png width=600/></td>
    </tr>
    <tr>
        <td>Notion
            <a href="https://github.com/tw93/Pake/releases/latest/download/Notion.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/Notion_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/Notion_x86_64.deb">Linux</a>
        </td>
        <td>Flomo
            <a href="https://github.com/tw93/Pake/releases/latest/download/Flomo.dmg">Mac</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/Flomo_x64.msi">Windows</a>
            <a href="https://github.com/tw93/Pake/releases/latest/download/Flomo_x86_64.deb">Linux</a>
        </td>
    </tr>
    <tr>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/Notion.png width=600/></td>
        <td><img src=https://raw.githubusercontent.com/tw93/static/main/pake/Flomo.png width=600/></td>
    </tr>
</table>

<details>

<summary>🏂 Weitere Anwendungen können unter <a href="https://github.com/tw93/Pake/releases">Releases</a> heruntergeladen werden. <b>Klicken Sie hier für die Tastenkombinationen</b></summary>

<br/>

| Mac                                                       | Windows/Linux                                       | Funktion                           |
| --------------------------------------------------------- | --------------------------------------------------- | ---------------------------------- |
| <kbd>⌘</kbd> + <kbd>[</kbd>                               | <kbd>Ctrl</kbd> + <kbd>←</kbd>                      | Zurück zur vorherigen Seite        |
| <kbd>⌘</kbd> + <kbd>]</kbd>                               | <kbd>Ctrl</kbd> + <kbd>→</kbd>                      | Vorwärts zur nächsten Seite        |
| <kbd>⌘</kbd> + <kbd>↑</kbd>                               | <kbd>Ctrl</kbd> + <kbd>↑</kbd>                      | Ganz nach oben scrollen            |
| <kbd>⌘</kbd> + <kbd>↓</kbd>                               | <kbd>Ctrl</kbd> + <kbd>↓</kbd>                      | Ganz nach unten scrollen           |
| <kbd>⌘</kbd> + <kbd>r</kbd>                               | <kbd>Ctrl</kbd> + <kbd>r</kbd>                      | Seite neu laden                    |
| <kbd>⌘</kbd> + <kbd>w</kbd>                               | <kbd>Ctrl</kbd> + <kbd>w</kbd>                      | Fenster ausblenden (nicht beenden) |
| <kbd>⌘</kbd> + <kbd>-</kbd>                               | <kbd>Ctrl</kbd> + <kbd>-</kbd>                      | Seite verkleinern                  |
| <kbd>⌘</kbd> + <kbd>=</kbd>                               | <kbd>Ctrl</kbd> + <kbd>=</kbd>                      | Seite vergrößern                   |
| <kbd>⌘</kbd> + <kbd>0</kbd>                               | <kbd>Ctrl</kbd> + <kbd>0</kbd>                      | Zoom zurücksetzen                  |
| <kbd>⌘</kbd> + <kbd>L</kbd>                               | <kbd>Ctrl</kbd> + <kbd>L</kbd>                      | Aktuelle URL kopieren              |
| <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>⌥</kbd> + <kbd>V</kbd> | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>V</kbd>   | Mit Formatierung einfügen          |
| <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>H</kbd>                | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>H</kbd>   | Zur Startseite                     |
| <kbd>⌘</kbd> + <kbd>⌥</kbd> + <kbd>I</kbd>                | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>I</kbd>   | Entwicklertools öffnen (nur Debug) |
| <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>⌫</kbd>                | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Del</kbd> | Cache leeren und neu starten       |
| <kbd>⌃</kbd> + <kbd>⌘</kbd> + <kbd>F</kbd>                | <kbd>F11</kbd>                                      | Vollbild umschalten                |

Durch Doppelklick auf die Titelleiste lässt sich das Vollbild ebenfalls umschalten. Unter Windows und Linux ermöglicht `--hide-window-decorations` rahmenlose Fenster mit oberem Ziehbereich. Auf dem Mac werden Wischgesten für Vor und Zurück sowie Menübefehle zur Fenstersteuerung unterstützt.

</details>

## CLI-Paketierung mit einem Befehl

![Pake](https://raw.githubusercontent.com/tw93/static/main/pake/pake1.gif)

```bash
# Pake CLI installieren
pnpm install -g pake-cli

# Standardnutzung - Website-Icon automatisch abrufen
pake https://github.com --name GitHub

# Erweiterte Nutzung mit benutzerdefinierten Optionen
pake https://weekly.tw93.fun --name Weekly --icon https://cdn.tw93.fun/pake/weekly.icns --width 1200 --height 800 --hide-title-bar
```

Die Erstpaketierung dauert durch die Einrichtung der Build-Umgebung etwas länger, Folgebilds sind sehr schnell. Vollständige Parameter finden Sie in der [CLI-Anleitung](docs/cli-usage.md). Alternativ steht der [GitHub Actions Online-Build](docs/github-actions-usage.md) bereit.

Pake in Skripten oder mit AI-Agenten nutzen? Übergeben Sie `--json` für maschinenlesbare Ausgaben, beschreiben Sie Apps deklarativ mit `--config app.json` ([Schema](schema/pake.schema.json)), oder paketieren Sie lokale Build-Ausgaben direkt per `pake ./dist --name MyTool`. Vollständiger Agent-Vertrag unter [llms.txt](llms.txt). Offiziellen Skill installieren: in Claude Code `/plugin marketplace add tw93/Pake` und `/plugin install pake@pake` ausführen; in Codex `codex plugin marketplace add tw93/Pake` und `codex plugin add pake@pake`.

Übergeben Sie folgenden Prompt an Ihren AI-Agenten:

```text
Verwende Pake (npm i -g pake-cli), um Webseiten als Desktop-Apps zu paketieren. Lies zuerst https://unpkg.com/pake-cli@latest/llms.txt; führe pake immer mit --json aus und parse stdout als einzelnes JSON-Objekt. Paketiere <url-or-local-dist> als App namens <AppName>.
```

## Entwicklung

Erfordert Rust `>=1.85` und Node `>=22` (empfohlenes LTS; `>=20` ebenfalls lauffähig). Installationsanleitung unter [Tauri-Dokumentation](https://tauri.app/start/prerequisites/). Wenn Sie mit der Entwicklungsumgebung nicht vertraut sind, empfiehlt sich das CLI-Tool.

```bash
# Abhängigkeiten installieren
pnpm i

# Lokale Entwicklung [Rechtsklick öffnet Debug-Modus]
pnpm run dev

# Anwendung paketieren
pnpm run build
```

Stilanpassungen, Funktionserweiterungen und Container-Kommunikation finden Sie in der [Erweiterten Dokumentation](docs/advanced-usage.md).

## Mitwirkende

Pake wäre ohne diese großartigen Mitwirkenden nicht möglich ❤️

<a href="https://github.com/tw93/Pake/graphs/contributors">
  <img src="https://raw.githubusercontent.com/tw93/Pake/main/CONTRIBUTORS.svg?sanitize=true" alt="Contributors" width="1000" />
</a>

## Unterstützung

1. Die direkteste Unterstützung ist der Kauf meiner Mac-Bereinigungs-App [Mole for Mac](https://mole.fit).
2. Wenn Pake Ihnen geholfen hat, geben Sie dem Projekt einen Stern auf GitHub oder [empfehlen Sie es weiter](https://twitter.com/intent/tweet?url=https://github.com/tw93/Pake&text=Pake%20-%20Verwandeln%20Sie%20beliebige%20Webseiten%20in%20schlanke,%20schnelle%20Desktop-Apps.%20Unterst%C3%BCtzt%20macOS,%20Windows%20und%20Linux).
3. Neueste Updates teile ich auf [Twitter](https://twitter.com/HiTw93); treten Sie auch gerne unserer [Telegram](https://t.me/+9f9gf4ZrFSQ2OWVl)-Gruppe bei.
4. Ich wünsche viel Freude beim Ausprobieren neuer Technologien. Wenn Sie Websites entdecken, die sich ideal als Desktop-App eignen, freue ich mich über Feedback.
5. Ich habe zwei Katzen, TangYuan und Coke. Wenn Pake Ihren Alltag bereichert hat, spendieren Sie ihnen gerne ein <a href="https://cats.tw93.fun?name=Pake" target="_blank">Dosenfutter 🥩</a>.

<details>
<summary>Diese freundlichen Menschen haben bereits gespendet 🐱</summary>
<br/>
<a href="https://cats.tw93.fun?name=Pake"><img src="https://cdn.jsdelivr.net/gh/tw93/sponsors@main/assets/sponsors.svg" width="1000px" /></a>
</details>

## Open-Source-Lizenz

Pake ist unter GPL-3.0 lizenziert, siehe [LICENSE](./LICENSE) und [Pake Output Exception](./LICENSE-EXCEPTION). Mit Pake erstellte Apps gehören vollständig Ihnen und können frei verwendet und weitergegeben werden. Wenn Sie Pake forken und ein eigenständiges Produkt veröffentlichen, wählen Sie bitte einen anderen Namen und geben Sie Pake als Quelle an.
