# Balance and tuning report (balance version 1.0.0)

Every tunable number lives in `src/core/balance.ts`. Values marked *spec* are taken directly from the design document; values marked *tuned* were changed after automated full-career runs.

## What was changed from the document's initial values, and why

| Area | Document's initial value | This build | Reason |
|---|---|---|---|
| Competition development base | 1.50 points per competition week | 3.6 | With 1.50 and the headroom divisor of 40, a GOAT Contention career topped out well short of contending; the document asks for base rates to be tuned so players can approach their intended level |
| Training pool | 0.30 points per training week | 0.6 | Same reason; competition remains the larger source (about 60% of growth in the first eight seasons) |
| World size | 800 active players per tour | 800 | Unchanged. Entry-professional events use 64-player qualifying so lower-ranked players can always find an entry |
| Background players' coaching | not specified | 1.15 inside the top 60, 1.08 inside the top 250 | Without it the user's coach gave a development edge no rival had |
| Elite newcomers | not specified | 3.5% of each rookie class has top-level potential | Needed for major-winning rates to fall inside the target ranges |
| Aging | 1 to 3 physical points a year, rising with age | multiplier rises 30% per year past onset; technical decline from onset + 3 | Players were staying near their peak into their late thirties |
| Money | support for the first year only | unchanged, plus: local and regional trips are always possible through the basic support scheme | Without it, a player whose cash reached zero could never enter another event |

A consequence of the first two rows: young-player growth is above the document's "initial targets" (15 to 35 points a year). A typical first season is 40 to 80 total attribute points depending on profile. That was the trade needed to meet the outcome targets below.

## Outcome check (document section 23.4)

Automated quick-play careers (coach's recommended route every block, retirement at 35). The document asks for at least 10,000 careers per profile; these runs are 8 to 10 careers per cell, so treat them as a sanity check, not a calibration.

| Profile | Tour | Careers | Won a major | Reached top 10 | Document target (major / top 10) |
|---|---|---|---|---|---|
| GOAT Contention | Men | 8 | 62% | 100% | 45–65% / 85–95% |
| GOAT Contention | Women | 8 | 50% | 88% | 45–65% / 85–95% |
| Contender | Men | 8 | 25% | 50% | 8–18% / 35–55% |
| Contender | Women | 8 | 12% | 38% | 8–18% / 35–55% |
| Grinder | Men | 10 | 0% | 0% | 1–4% / 5–15% |
| Grinder | Women | 10 | 0% | 0% | 1–4% / 5–15% |

The Grinder rows were measured before the last two world-strength changes; their numbers can only have moved down since. Grinder careers reached a median best ranking of about 50 to 70, and 90 to 100% reached the top 100.

Not yet measured: Unknown Prospect aggregate outcomes, injury-rate bands, and whether quick and detailed play give equal sporting results (they share one simulation, so they should).

## Reproduce

```
npm run balance -- atp goat 10
npm test
```

## Junior development (added November 2026)

Source: an update of Reid et al. (2007), covering the 504 boys who finished a year in the ITF junior top 50 between 2004 and 2016, matched to their ATP careers. Targets and the game's results (`npx tsx tests/juniors.ts atp 3`, three worlds, juniors born 2008–2010 followed to the end of 2034):

| Best junior ranking | Top 100 before 24 (data / game) | Ever top 50 | Ever top 10 | Median career high |
|---|---|---|---|---|
| 1–3 | 51% / 57% | 46% / 43% | 19% / 25% | 72 / 58 |
| 4–10 | 29% / 27% | 24% / 20% | 5% / 5% | 154 / 137 |
| 11–20 | 19% / 16% | 21% / 8% | 4% / 3% | 205 / 253 |
| 21–50 | 10% / 5% | 10% / 4% | 4% / 2% | 336 / 372 |

Ages: top-50 juniors' best ranking before 19 is 570 (data 745) and before 22 is 317 (data 342). Eventual top-10 players: best ranking before 19 about 256 (data about 190), before 22 about 30 (data about 25). First top 250 at about 20 and first top 100 at about 20–21 (data 21.0 and 22.2): the game's players arrive about a year early.

The levers:
- `GAP` in `src/core/juniors.ts` sets how far below their peak a junior is at each age, by development speed. It is used when juniors are created.
- `SPEED_AGE` multiplies weekly growth by age and speed. Early developers grow fastest before 17; late developers grow fastest from 19 to 24.
- `juniorPotential` sets the potential tail for each cohort. Each tour gets 100 new 14-year-olds a year.
- `proShare` controls how much of a strong junior's schedule moves to ITF and Challenger events.
- Graduation at 19 removes weaker juniors from the world. The quit chance rises below level 58, and is higher for players never ranked in the junior top 300.

Small samples (about 30 juniors per band per run) make single bands noisy. Run 3 or more worlds before changing anything. Later cohorts, which are simulated from 14 rather than created at 16–18, can be checked with `npx tsx tests/juniors.ts atp 2 2038 2012 2013`.
