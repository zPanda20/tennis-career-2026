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

## Starting at 16

A career can start at 16 on the ITF junior tour, or at 19 as a lower-tier professional.

- **Junior tour.** Junior events run every week: J30 to J500, the junior Grand Slams in the second week of each major, and the ITF Junior Finals for the top eight. The junior ranking counts your best six junior results of the last 52 weeks. Juniors play through the season they turn 18. Strong juniors also enter ITF pro events.
- **Development speed.** Early, steady or late, or hidden. It changes when you grow, not how far.
- **Academy.** Club, national centre or elite academy, each with its own fees and development rate. The national centre is free in the junior top 100. The elite academy is half price in the junior top 60 and free in the top 20. Family support covers part of the cost.
- **At 18, the next four years.**
  - **Tour full time:** no limits.
  - **University:** the college season runs from January to May and from mid-September to mid-November. Pro events are blocked in those weeks, but you get dual matches and the NCAA singles championship; its champion gets a US Open wildcard. Prize money is capped at $10,000 a year, and a scholarship covers living costs.
  - **Academy plus part-time tour:** faster development, at most 14 pro events a season, and academy fees.
- **Yearly check-ins.** Each year-end you can stay on the path, turn pro early or stop playing. At the end of the four years you either commit to the tour or quit.

## Watching controls
Space plays or pauses, ← and → step back and forward, Shift+→ (or E) jumps to the end of the match, S skips to the summary.
Controller: A next, B back, X or Start play/pause, RB end of match, Y summary, d-pad left/right to step.

## Hands-on matches
Choose who plays your matches on the Career page or in the planner: the coach (fastest), you for the big ones, or you for every main-draw match.
Hands-on matches pause before the first ball (scouting report, film study, extra practice, game plan), at every set break (your coach's advice and a new plan) and when you drop three games in a row (reset, change plan or ride it out).
Plans shift point odds depending on the matchup; opponents have plans too, change them after losing a set, and adapt if you repeat the same plan. With the coach in charge, the coach makes the same calls using their read of the opponent, which is sharper with better coaches.

## Entry rules
- Lucky losers: when main-draw players withdraw after qualifying (injury, illness or late withdrawal), the spots go to qualifying losers, final-round losers first and by ranking, then earlier rounds. Players must have signed in on site; some will have left. A lucky loser gets main-draw prize money and points (plus qualifying points), even after a first-round loss.
- ATP Challenger eligibility (by ranking at entry): the top 10 may not play Challengers. Players ranked 11–50 may not play Challenger 50 or 75, may play Challenger 175, and need one of three Challenger wildcards per season for Challenger 100 or 125.
