# Tennis Career 2026

A private, single-player tennis career simulation that runs entirely in the browser, with a "Centre Court" game interface that re-tints to the hard, clay or grass swing you are in. Create a 19-year-old professional on 1 January 2026, enter the men's or women's tour among the real 2026 field, and play the career through to retirement.

Built from the *Tennis Career 2026* design document (Version 1.0).

## Run it

```
npm install
npm run dev        # local development
npm run build      # production build in dist/
npm test           # sporting and data invariants
npm run balance -- atp goat 10   # automated careers for balance checks
```

## Deploy on Render

The repository includes `render.yaml`. In Render choose **New > Blueprint**, pick this repository and apply. It creates a static site that runs `npm ci && npm run build` and publishes `dist/`. No server, account or database is involved: careers are saved in each player's own browser.

## What is real and what is simulated

- **Players**: the top 200 of each tour from the 2025 year-end rankings (see `content/players_*.txt`). Birth dates are stored to the year and shown as ages. Ability ratings are authored game estimates generated from ranking and playing style, not measurements. The rest of each 800-player field is generated and labelled *fictional*.
- **Events**: the 2026 ATP and WTA calendars, the 2026 Challenger Tour, WTA 125 events (listed through mid-October) and a selection of up to six ITF events per week for January to June. ITF events from July to December reuse first-half venues and are flagged *provisional* in the game.
- **Everything from 1 January 2026 onward is simulated.** Later seasons reuse the 2026 calendar pattern.
- **Money** is a fictional economy in career dollars. Sponsors are invented brands.

## Images

The game ships without player photos or logos. A private image pack can be loaded in **Settings > Load image pack folder**: choose a folder containing `image-pack.json` (format documented in `src/ui/pack.ts`). Images are stored in that browser only and are never uploaded or added to this repository.

## Structure

- `content/` real-world data as plain text
- `src/core/` deterministic simulation core in TypeScript, with no browser dependencies (`balance.ts` holds every tunable number)
- `src/worker.ts` runs commands off the main thread
- `src/persist/` IndexedDB saves, pending-command recovery, single-writer lock
- `src/ui/` React interface
- `src/export/` PDF review and JSON archive
- `tests/` invariants, balance runs and a browser smoke test

## Not in this build

Doubles, team events, manual point-by-point play, tactics, cloud saves, and the "pause for a decision" entry-fallback policy. Real players use the same generic injury and retirement rules as generated players. See `TUNING.md` for the balance report.

A free private hobby project. Not affiliated with or endorsed by any tour, tournament, player or brand.

## Watching controls
Space plays or pauses, ← and → step back and forward, Shift+→ (or E) jumps to the end of the match, S skips to the summary.
Controller: A next, B back, X or Start play/pause, RB end of match, Y summary, d-pad left/right to step.
