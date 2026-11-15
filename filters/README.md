# Filter lists

Runtime templates built with the `content-blocking` feature (which `runtime-template` turns on) embed these lists, unmodified and gzipped, for the `content_blocking` groups in `pake.json`. The npm package does not ship this folder, and the CLI never enables the feature.

| Group      | List                          | Authors                                                                | License                                                                   |
| ---------- | ----------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `ads`      | EasyList                      | The EasyList authors (https://easylist.to/)                            | GPL-3.0-or-later or CC BY-SA 3.0 (https://easylist.to/pages/licence.html) |
| `trackers` | EasyPrivacy                   | The EasyList authors (https://easylist.to/)                            | GPL-3.0-or-later or CC BY-SA 3.0 (https://easylist.to/pages/licence.html) |
| `cookies`  | AdGuard Cookie Notices filter | AdGuard (https://github.com/AdguardTeam/AdguardFilters)                | GPL-3.0                                                                   |
| `china`    | EasyList China                | The EasyList China authors (https://github.com/easylist/easylistchina) | GPL-3.0-or-later or CC BY-SA 3.0 (https://easylist.to/pages/licence.html) |
| always     | uBlock filters – Unbreak      | uBlock Origin contributors (https://github.com/uBlockOrigin/uAssets)   | GPL-3.0                                                                   |

`sources.json` records each list's download URL, version and date. Refresh them with `node scripts/update-filter-lists.mjs` before a runtime release; `cargo test --features content-blocking content_blocking` then checks that every list unpacks and that all groups together still fit WebKit's 150,000-rule limit.

The lists are matched by Brave's adblock-rust (https://github.com/brave/adblock-rust, MPL-2.0).
