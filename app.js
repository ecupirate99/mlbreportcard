/* =============================================
   app.js — Main orchestration
   ============================================= */

// ---- Autocomplete ----
const TEAM_NAMES = [
  "Angels","Astros","Athletics","Blue Jays","Braves","Brewers","Cardinals",
  "Cubs","Diamondbacks","Dodgers","Giants","Guardians","Mariners","Marlins",
  "Mets","Nationals","Orioles","Padres","Phillies","Pirates","Rangers",
  "Rays","Red Sox","Reds","Rockies","Royals","Tigers","Twins","White Sox","Yankees"
];

const dl = document.getElementById('teamList');
TEAM_NAMES.forEach(t => {
  const o = document.createElement('option');
  o.value = t;
  dl.appendChild(o);
});

document.getElementById('teamInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') runReport();
});

document.getElementById('qaInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') askQuestion();
});

// ---- State ----
let currentReportContext = null;
let currentTeamName = null;

// ---- Utility: round to N decimal places ----
function round(v, d = 1) {
  if (v == null || isNaN(v)) return null;
  return Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
}

// ---- Main Report Runner ----
async function runReport() {
  const name = document.getElementById('teamInput').value.trim();
  if (!name) { setError('Please enter a team name.'); return; }

  const btn = document.getElementById('genBtn');
  btn.disabled = true;

  // Reset Q&A
  document.getElementById('qaPanel').style.display = 'none';
  document.getElementById('qaThread').innerHTML   = '';
  currentReportContext = null;
  currentTeamName      = null;

  try {
    // 1. Find team
    setStatus('Finding team...');
    const team   = await findTeam(name);
    const colors = getTeamColors(team.id);
    applyTeamColors(colors);

    // 2. Fetch all data concurrently — including new avg age and season progress
    setStatus('Fetching stats, roster & league rankings...');
    const [
      teamStats,
      allLeagueStats,
      splits,
      rosters,
      hitters,
      pitchers,
      avgAge,
      seasonProgress
    ] = await Promise.all([
      fetchTeamStats(team.id),
      fetchAllTeamStats(),
      fetchPitchingSplits(team.id),
      fetchRosters(team.id),
      fetchTopHitters(team.id),
      fetchTopPitchers(team.id),
      fetchRosterAvgAge(team.id),      // FIX #1: real avg age from birthdates
      fetchSeasonProgress(team.id)     // FIX #2: real game number for pace math
    ]);

    const hs = teamStats.hitting;
    const ps = teamStats.pitching;

    // 3. Build league rank context
    const lh = allLeagueStats.hitting;
    const lp = allLeagueStats.pitching;

    const rankNote = (rankObj) => rankObj ? `#${rankObj.rank}/30` : null;

    const ranks = {
      ops:  leagueRank(lh, team.id, 'ops',        true),
      obp:  leagueRank(lh, team.id, 'obp',        true),
      avg:  leagueRank(lh, team.id, 'avg',        true),
      hr:   leagueRank(lh, team.id, 'homeRuns',   true),
      runs: leagueRank(lh, team.id, 'runs',        true),
      era:  leagueRank(lp, team.id, 'era',        false),
      whip: leagueRank(lp, team.id, 'whip',       false),
      k9:   leagueRank(lp, team.id, 'strikeOuts', true),
    };

    // -------------------------------------------------------------------------
    // FIX #3: Pre-compute strikeout rate (K%) so Gemini never calculates it.
    // K% = strikeouts / plate appearances. Both come from the API directly.
    // -------------------------------------------------------------------------
    const rawK  = parseFloat(sv(hs, 'strikeOuts') || 0);
    const rawPA = parseFloat(sv(hs, 'plateAppearances') || 0);
    const kPct  = (rawPA > 0) ? round((rawK / rawPA) * 100, 1) : null;
    // e.g. 23.4 (as a number; we'll format it as "23.4%" in the payload label)

    // -------------------------------------------------------------------------
    // FIX #4: Pre-compute save conversion % so Gemini never calculates it.
    // saveConvPct = saves / (saves + blownSaves), expressed as a percentage.
    // -------------------------------------------------------------------------
    const rawSaves      = parseFloat(sv(ps, 'saves')      || 0);
    const rawBlownSaves = parseFloat(sv(ps, 'blownSaves') || 0);
    const saveOpps      = rawSaves + rawBlownSaves;
    const saveConvPct   = (saveOpps > 0) ? round((rawSaves / saveOpps) * 100, 1) : null;
    // e.g. 88.2 (as a number; formatted as "88.2%" in the payload)

    // -------------------------------------------------------------------------
    // FIX #2 continued: Pre-compute full-season pace for key counting stats.
    // We pass the pre-computed pace values directly — Gemini never does math.
    // -------------------------------------------------------------------------
    const pace = seasonProgress
      ? {
          gamesPlayed: seasonProgress.gamesPlayed,
          seasonGames: seasonProgress.seasonGames,
          hrPace:   seasonProgress.gamesPlayed > 0
            ? Math.round(parseFloat(sv(hs,'homeRuns') || 0) * seasonProgress.paceMultiplier)
            : null,
          kPace:    seasonProgress.gamesPlayed > 0
            ? Math.round(parseFloat(sv(hs,'strikeOuts') || 0) * seasonProgress.paceMultiplier)
            : null,
          savesPace: seasonProgress.gamesPlayed > 0
            ? Math.round(rawSaves * seasonProgress.paceMultiplier)
            : null,
          runsPace: seasonProgress.gamesPlayed > 0
            ? Math.round(parseFloat(sv(hs,'runs') || 0) * seasonProgress.paceMultiplier)
            : null,
        }
      : null;

    // 4. Assemble payload for Gemini
    const payload = {
      team: team.name,
      season: 2026,
      leagueRanks: {
        ops:    rankNote(ranks.ops),
        obp:    rankNote(ranks.obp),
        avg:    rankNote(ranks.avg),
        hr:     rankNote(ranks.hr),
        runs:   rankNote(ranks.runs),
        era:    rankNote(ranks.era),
        whip:   rankNote(ranks.whip),
        totalK: rankNote(ranks.k9),
      },
      hitting: {
        avg:  sv(hs,'avg'),
        obp:  sv(hs,'obp'),
        slg:  sv(hs,'slg'),
        ops:  sv(hs,'ops'),
        hr:   sv(hs,'homeRuns'),
        runs: sv(hs,'runs'),
        rbi:  sv(hs,'rbi'),
        sb:   sv(hs,'stolenBases'),
        k:    sv(hs,'strikeOuts'),
        bb:   sv(hs,'baseOnBalls'),
        pa:   sv(hs,'plateAppearances'),
        // FIX #3: pre-computed K% — do not ask Gemini to derive this
        kPct: kPct !== null ? `${kPct}%` : null,
      },
      pitching: {
        era:        sv(ps,'era'),
        whip:       sv(ps,'whip'),
        k:          sv(ps,'strikeOuts'),
        bb:         sv(ps,'baseOnBalls'),
        hr:         sv(ps,'homeRuns'),
        saves:      sv(ps,'saves'),
        blownSaves: sv(ps,'blownSaves'),
        wins:       sv(ps,'wins'),
        losses:     sv(ps,'losses'),
        ip:         sv(ps,'inningsPitched'),
        // FIX #4: pre-computed save conversion % — do not ask Gemini to derive this
        saveConvPct: saveConvPct !== null ? `${saveConvPct}%` : null,
      },
      rotation: splits.starters ? {
        era:  sv(splits.starters,'era'),
        whip: sv(splits.starters,'whip'),
        k:    sv(splits.starters,'strikeOuts'),
        ip:   sv(splits.starters,'inningsPitched')
      } : null,
      bullpen: splits.bullpen ? {
        era:        sv(splits.bullpen,'era'),
        whip:       sv(splits.bullpen,'whip'),
        saves:      sv(splits.bullpen,'saves'),
        blownSaves: sv(splits.bullpen,'blownSaves')
      } : null,
      roster: {
        active: rosters.active.length,
        il: rosters.il.length,
        ilPlayers: rosters.il.slice(0,6).map(p => p.person?.fullName).filter(Boolean),
        // FIX #1: real avg age from birthdate data — do not ask Gemini to guess this
        avgAge: avgAge,
      },
      // FIX #2: pre-computed pace numbers — do not ask Gemini to project these
      pace,
      topHitters: hitters.slice(0,5).map(p => ({
        name: p.name,
        avg:  sv(p.stat,'avg'),
        obp:  sv(p.stat,'obp'),
        slg:  sv(p.stat,'slg'),
        ops:  sv(p.stat,'ops'),
        hr:   sv(p.stat,'homeRuns'),
        rbi:  sv(p.stat,'rbi')
      })),
      topPitchers: pitchers.slice(0,5).map(p => ({
        name: p.name,
        era:  sv(p.stat,'era'),
        whip: sv(p.stat,'whip'),
        k:    sv(p.stat,'strikeOuts'),
        ip:   sv(p.stat,'inningsPitched'),
        wins: sv(p.stat,'wins')
      }))
    };

    // 5. Generate AI report
    setStatus('Generating AI analysis...');
    const report = await generateReport(team.name, payload);

    // 6. Render
    renderReport(
      team, report,
      hs, ps, splits, rosters, hitters, pitchers,
      lh, lp
    );

    // 7. Store context for Q&A
    currentTeamName = team.name;
    currentReportContext = {
      teamName: team.name,
      report,
      payload
    };

    // 8. Show Q&A panel
    document.getElementById('qaPanel').style.display = 'block';

  } catch (err) {
    setError(err.message);
    console.error(err);
  } finally {
    btn.disabled = false;
  }
}

// ---- Q&A Handler ----
async function askQuestion() {
  const input = document.getElementById('qaInput');
  const qaBtn = document.getElementById('qaBtn');
  const q = input.value.trim();
  if (!q || !currentReportContext) return;

  input.value = '';
  qaBtn.disabled = true;

  addQaBubble('user', q);
  const thinking = addQaBubble('thinking', 'Analyzing...');

  try {
    const answer = await answerQuestion(q, currentTeamName, currentReportContext);
    thinking.remove();
    addQaBubble('assistant', answer);
  } catch (err) {
    thinking.remove();
    addQaBubble('assistant', 'Error: ' + err.message);
  } finally {
    qaBtn.disabled = false;
    input.focus();
  }
}
