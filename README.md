# MLB GM Report Card — v2

A single-page web app that generates an AI-powered GM report card for any MLB team using live data from the MLB Stats API and Gemini 3.1 Flash-Lite Preview AI analysis.

## What's New in v2

| Feature | Details |
|---|---|
| **Individual player stats** | Top 5 hitters (OPS, HR, AVG, RBI) and top 5 pitchers (ERA, K, WHIP) pulled from the MLB API |
| **League rank for every stat** | All 30 teams' stats fetched simultaneously; real-time percentile rank bars shown under each stat |
| **Bullpen vs. rotation split** | Separate ERA/WHIP/K stats for starters and relievers with independent letter grades |
| **Team color theming** | Each team's primary brand color applied to the UI (masthead, buttons, accents) |
| **Natural language Q&A** | After a report generates, ask any follow-up question and Gemini 3.1 Flash-Lite Preview answers in context |

## File Structure

```
mlb-report-card-v2/
├── index.html   — App shell & markup
├── styles.css   — All styling (light/dark mode, team color variables)
├── mlb.js       — MLB Stats API calls + league ranking logic + team colors
├── gemini.js    — Gemini 3.1 Flash-Lite Preview API: report generation + Q&A
├── render.js    — All DOM rendering (cards, leader tables, Q&A bubbles)
├── app.js       — Main orchestration + event handlers
└── README.md    — This file
```

## Setup

### 1. Get a Google Gemini API Key
Sign up at [aistudio.google.com](https://aistudio.google.com) and create an API key.

### 2. Add your API key
Open `gemini.js` and replace:
```js
const GEMINI_API_KEY = 'YOUR_API_KEY_HERE';
```

### 3. Serve locally
You must run via a local server (not `file://`) due to browser CORS restrictions:

```bash
# Python 3
python -m http.server 8080

# Node.js
npx serve .

# VS Code
# Use the "Live Server" extension
```

Then open `http://localhost:8080`.

## APIs Used

| API | Auth | Notes |
|---|---|---|
| [MLB Stats API](https://statsapi.mlb.com) | None (free, public) | Team stats, rosters, player leaders, pitching splits |
| [Gemini 3.1 Flash-Lite Preview](https://ai.google.dev) | API key required | Report card generation + Q&A |

### Key MLB Endpoints Used
- `/api/v1/teams?sportId=1&season=2025` — Team search
- `/api/v1/teams/stats?stats=season&group=hitting&season=2025&sportId=1` — **All 30 teams** hitting (for league ranks)
- `/api/v1/teams/stats?stats=season&group=pitching&season=2025&sportId=1` — **All 30 teams** pitching
- `/api/v1/teams/{id}/stats?...&playerPool=startingPitchers` — Rotation split
- `/api/v1/teams/{id}/stats?...&playerPool=relievers` — Bullpen split
- `/api/v1/teams/{id}/stats?...&playerPool=qualified` — Individual player stats
- `/api/v1/teams/{id}/roster?rosterType=active` — Active 26-man
- `/api/v1/teams/{id}/roster?rosterType=injuries` — IL players

## Security Note

**Never commit your Gemini API key to source control.** For a production deployment, proxy the `/v1/messages` call through your own backend so the key is never exposed in client-side JavaScript.

## Q&A Example Questions

After generating a report, try asking:
- *"Who should we target at the trade deadline?"*
- *"How does our rotation compare to the Dodgers?"*
- *"What's our biggest risk going into the playoffs?"*
- *"Should we call up any prospects?"*
- *"Is our bullpen sustainable or regression risk?"*

## Possible Next Steps

- **Print to PDF** — Add `window.print()` button with `@media print` stylesheet
- **Team comparison** — Side-by-side report for two teams
- **Last 15 games trend** — Use `lastXGames` stat type for hot/cold momentum indicator
- **Game log** — Recent W/L record from `/api/v1/schedule`
- **Prospect watch** — Pull from `/api/v1/teams/{id}/roster?rosterType=fullRoster` for minor leaguers
