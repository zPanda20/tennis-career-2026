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
