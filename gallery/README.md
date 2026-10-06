# Pake Gallery

Ready-made recipes for sites that work well as desktop apps. The Pake apps for Mac and Windows show them as a gallery, so picking one creates the app with the window size and options the recipe sets.

Pake is not affiliated with any of these sites. Names, logos and icons belong to their owners, and a recipe only describes how to open the public website in a window.

## Layout

- `apps/<id>.json`: one recipe per site, validated by `schema.json`.
- `apps/<name>.css`, `apps/<name>.js`: optional files a recipe injects through `inject_css` or `inject_js`.

```json
{
  "id": "excalidraw",
  "version": 1,
  "name": { "en": "Excalidraw", "zh-Hans": "Excalidraw" },
  "url": "https://excalidraw.com/",
  "category": "productivity",
  "description": {
    "en": "Sketch diagrams in a hand-drawn style",
    "zh-Hans": "手绘风格的白板和示意图"
  },
  "icon": "https://excalidraw.com/android-chrome-512x512.png"
}
```

- `id`: lowercase letters, digits and hyphens, equal to the file name. It never changes once published, because generated apps remember it.
- `version`: starts at 1. Bump it only when a change affects the built app, that is `url`, `window` or the inject files, so installed apps offer the update. Name, description and icon fixes need no bump, because installed apps keep their own name and icon.
- `category`: one of `ai`, `productivity`, `social`, `media`, `reading`, `developer`.
- `name` and `description`: both `en` and `zh-Hans`. The description is one short line on what the site does, without a trailing period.
- `icon`: the site's own apple-touch-icon or largest app icon over https, ideally 512 px. It is downloaded once when the apps are built, not at runtime.
- `window`: only options that differ from Pake's defaults, using the window option names of `src-tauri/pake.json` (`width`, `height`, `hide_title_bar`, `incognito` and the others listed in the schema). `user_agent` is a single string used on every platform. Options a platform cannot apply are ignored there.
- `platforms`: set to `["mac"]` or `["windows"]` only when the site is known not to work on the other one.

## Proposing a site

1. Package the site with the Pake CLI and use it for a few days: sign in, open links, download a file, and check that it is still logged in after a restart.
2. Add `apps/<id>.json`. Keep `window` empty unless an option fixed a problem you saw, and keep inject files to the smallest change that fixes it.
3. Run `npx vitest run tests/unit/gallery.test.ts`.
4. Open a pull request saying what you tested and on which platform.

Keep the copy honest: describe what the site does in plain words, without ratings, slogans or claims the site itself would not make. Sites that need a paid account are fine; sites that mainly serve ads or ask for credentials of another service are not accepted.
