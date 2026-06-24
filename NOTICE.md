# Third-party notices

AT Mot itself is dual-licensed MIT OR Apache-2.0. It bundles or builds upon the following
third-party assets, each under its own license.

## Word lists (bundled in `src/data/`)

- **ENABLE word list** — English dictionary (`words.en.json` `allowed` set).
  Source: <https://github.com/dolph/dictionary>. **Public Domain.**
- **an-array-of-french-words** — French dictionary (`words.fr.json` validity).
  Source: <https://github.com/words/an-array-of-french-words>. **MIT** © Zeke Sikelianos.
  Derived from the Letterpress word list.
- **hermitdave/FrequencyWords** — English & French commonness ranking (OpenSubtitles).
  Source: <https://github.com/hermitdave/FrequencyWords>. **MIT** © Hermit Dave.

## Fonts (bundled in `public/fonts/`)

- **Overused Grotesk** (`OverusedGrotesk-VF.woff2`).
  By Randy Abramo. **SIL Open Font License 1.1.** <https://github.com/RandyAbramo/Overused-Grotesk>
- **IBM Plex Mono** (`ibm-plex-mono-latin-*.woff2`).
  By IBM. **SIL Open Font License 1.1.** <https://github.com/IBM/plex>

Both are OFL-licensed and freely redistributable.

## Runtime dependencies

- **atcute** (`@atcute/*`) — AT Protocol browser OAuth + XRPC client + identity resolver.
  <https://github.com/mary-ext/atcute> (MIT).

## Network services

- **Constellation** (`constellation.microcosm.blue`) — community-run, AGPL backlink index used for
  the no-database read side. AT Mot sends a descriptive `User-Agent`, caches client-side, and
  degrades gracefully. Please be a good citizen if you fork this.
