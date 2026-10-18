# Contributing

<div align="center">

**English** · [中文](contributing_CN.md)

</div>

Pull requests for fixes, docs, examples and suggestions are welcome. For a new feature, open an [issue](https://github.com/tw93/Pake/issues) first so we can talk about whether it is needed; a typo or a clearer sentence can go straight to a pull request.

## Working on the code

All work happens on `main`, and pull requests go to `main` too. [Development workflow](advanced-usage.md#development-workflow) covers the toolchain, the project layout and the commands. The two you will use most:

```bash
# Run the CLI and the app together, the quickest loop for CLI changes
pnpm run cli:dev -- https://web.telegram.org/k/

# Build the CLI, run the test suite, then the real build smoke tests
pnpm test
```

## Proposing a site for the gallery

The Pake apps for Mac and Windows show a gallery of sites that work well as desktop apps. Each one is a small recipe in [`gallery/apps`](https://github.com/tw93/Pake/tree/main/gallery/apps), and anyone can propose one:

1. Package the site with the Pake CLI and use it for a few days: sign in, open links, download a file, and check that you are still signed in after a restart.
2. Add `gallery/apps/<id>.json`. Leave the window options out unless one fixed a problem you saw, and keep injected CSS or JavaScript to the smallest change that fixes it.
3. Run `npx vitest run tests/unit/gallery.test.ts`.
4. Open a pull request that says what you tested and on which platform.

Describe what the site does in plain words, without ratings or slogans. Sites that need a paid account are fine; sites that mainly serve ads or ask for another service's credentials are not accepted. Every field is explained in the [gallery guide](../gallery/README.md).

## Name and logo

The code license covers the code, not the brand. If you publish a fork or a product built on Pake, give it your own name and icon, and do not suggest that it is endorsed by Pake. The full text is in the [trademark policy](../TRADEMARK.md).
