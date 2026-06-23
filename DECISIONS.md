# Decisions

Judgment calls made during the build, beyond what the spec already settled. Every
hard-to-change-after-launch value (epoch, domain, `puzzleTarget` format, namespace, word-list rules)
follows the spec exactly; the items here are the choices the spec left open or where a small,
documented interpretation was needed.

## Architecture & data

1. **Result record key is `"any"`, not `"tid"`.** The spec asked for `tid` semantics *and* a
   deterministic rkey `<lang>-<puzzleNumber>` (e.g. `en-412`). A `tid` key forces TID-format rkeys,
   which would reject `en-412`. The deterministic rkey is the load-bearing requirement (one record
   per puzzle per account; parseable), so the lexicon uses `"key": "any"` and documents the
   `<lang>-<puzzleNumber>` format in the record description. This is the standards-correct way to
   express the intended constraint.

2. **Result records are written with `createRecord` (write-once).** A fixed rkey + `createRecord`
   means re-finishing a puzzle is a no-op (the "already exists" error is treated as success), which
   enforces immutability and prevents stats double-counting at the protocol layer.

3. **`dailyStats.averageGuesses` is an integer ×100** (e.g. `412` = 4.12). Lexicons avoid floats;
   scaling keeps it unambiguous.

## Word lists

4. **Sources:** English dictionary = **ENABLE** (Public Domain); French dictionary =
   **an-array-of-french-words** (MIT); commonness ranking for both = **hermitdave/FrequencyWords**
   (MIT, OpenSubtitles). The French list is sourced independently with **no relation to** the
   `wordle-fr` / “Le Mot” project, as required.

5. **Validity vs. commonness are separated.** Frequency lists alone leak proper nouns, foreign
   words, and apostrophe-mangled contraction fragments. So the *dictionary* decides validity and the
   *frequency* list only decides commonness/ordering. French additionally drops dictionary entries
   containing apostrophes/hyphens and a small set of elision stems (`JUSQU`, `LORSQU`, …).
   English additionally keeps obvious **inflected `-S` forms** (regular plurals, `-es`/`-ies`
   plurals, and 3rd-person verbs like `ROOMS`, `BOXES`, `FLIES`) **out of the answer pool** — they
   stay valid as guesses. Detection (`scripts/plurals.ts`) checks the singular against the *full*
   ENABLE dictionary of every length; an earlier version checked only the 5-letter subset, so no
   4-letter singular ever matched and the filter silently did nothing.

6. **Answer order is a fixed seeded shuffle baked into the committed JSON.** Daily agreement comes
   from shared *data* (every client reads the same ordered array) rather than runtime computation.
   The per-language seeds are frozen; changing them would renumber history.

7. **Generated word JSON is committed.** It *is* the game content and must be byte-identical across
   clients; `npm run build:words` regenerates it reproducibly.

## Share & Constellation read path

8. **The permalink is posted as a real richtext link facet *and* an external embed**, not plain
   text. Constellation only indexes URIs at link positions (`.facets[].features[…].uri`,
   `.embed.external.uri`) — a plain-text URL would be invisible to it, breaking shared-post
   discovery. Discovery queries both paths and dedupes.

9. **Engagement is reported as distinct DIDs** (people who liked/reposted/replied) via Constellation's
   `count/distinct-dids` — one clean endpoint, and arguably more meaningful than raw counts. Replies
   are counted at `.reply.parent.uri`.

10. **Leaderboard aggregation samples up to 200 result records**, fetched with bounded concurrency
    and aggregated in-browser; the UI flags when the sample is capped. Everything returns
    null/empty on failure so the page degrades instead of crashing.

11. **No Cloudflare Worker fallback was built.** The spec makes it optional ("only if needed");
    core gameplay and reads work entirely client-side, verified against the live Constellation
    instance.

## Design

12. **Type = Overused Grotesk (display/body) + IBM Plex Mono (data/provenance)** — the exact
    skypress.blog stack, self-hosted (both OFL).

13. **Board palette:** teal `#0F766E` (correct), burnt amber `#B45309` (present), slate `#5B6776`
    (absent) — deliberately not Wordle's green/yellow. The same saturated chips are used in both
    light and dark themes, which guarantees AA contrast for the white tile letters in either theme.
    Secondary non-hue cue: an inner ring on "present" tiles plus per-tile aria labels announcing the
    state, so colour-blind and screen-reader players read the board clearly. The shared emoji grid
    stays standard `🟩🟨⬛`.

14. **Dark mode follows `prefers-color-scheme` only** (no toggle), via semantic CSS custom
    properties, per spec.

15. **Vanilla TypeScript, no UI framework** — keeps the static bundle tiny (~94 KB gzip), matching
    the "lightest fit for a client-side game" rationale behind choosing atcute.

## Auth / flow

16. **Playing does not require sign-in.** You can play immediately; on finishing, the result is
    recorded to your PDS if you're signed in, otherwise the finished game persists locally and is
    recorded the moment you sign in (the write-once result prevents double-counting). This is
    friendlier than gating play behind OAuth while staying fully serverless.

17. **`redirect_uri` is the site root** (`https://atmot.herve.bzh/`); the OAuth callback is detected
    from the hash params on load. Dev uses atproto's loopback client via a Vite plugin (no hosted
    metadata needed locally).

## Tooling

18. **Dev tooling (Vite/Vitest) bumped to latest majors** to clear all `npm audit` advisories
    (currently **0 vulnerabilities**). The advisories were dev-server-only (esbuild), never in
    shipped code.

19. **atcute versions:** `@atcute/client@^5`, `@atcute/oauth-browser-client@^4`,
    `@atcute/identity-resolver@^2` (newer than the spec's illustrative snippets; the API used is
    equivalent).

## Handoff note

20. **No git remote is configured.** Everything is committed to the **`trunk`** branch, which is the
    repository's current/default branch locally (HEAD points at it). Creating a remote and marking
    `trunk` as the default branch *on the host* (GitHub/Tangled/etc.) is a one-step manual action for
    the owner, since no remote exists to push to yet.

## PWA / installability

21. **Manifest-only PWA — deliberately no service worker.** The app is installable
    to the home screen via `public/manifest.webmanifest` + committed PNG icons
    (rasterized once from `icon.svg`, flattened onto `#0e1116`) + apple/mobile
    web-app meta tags. There is intentionally **no service worker and no caching
    layer**: this is a daily game with dynamic reads (Constellation leaderboard,
    PDS writes, OAuth), and an over-eager cache is exactly what would serve a
    stale puzzle or stale bundle. Consequence: iOS add-to-home-screen and
    Android manual "Add to Home Screen" both work from the manifest alone; the
    proactive Android install banner (which needs a service worker) is forgone on
    purpose. Loading speed is unchanged (CDN + ~94 KB bundle) with no new failure
    modes.
