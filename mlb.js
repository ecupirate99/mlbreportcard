/* =============================================
   mlb.js — MLB Stats API helpers
   ============================================= */

const MLB_BASE = 'https://statsapi.mlb.com';

// Known team primary/secondary colors (hex).
// Falls back to #1a1a1a if team not listed.
const TEAM_COLORS = {
  108: { primary: '#BA0021', secondary: '#003263' }, // Angels
  109: { primary: '#A71930', secondary: '#000000' }, // Diamondbacks
  110: { primary: '#DF4601', secondary: '#000000' }, // Orioles
  111: { primary: '#BD3039', secondary: '#0C2340' }, // Red Sox
  112: { primary: '#0E3386', secondary: '#CC3433' }, // Cubs
  113: { primary: '#C6011F', secondary: '#000000' }, // Reds
  114: { primary: '#00385D', secondary: '#E50022' }, // Guardians
  115: { primary: '#333366', secondary: '#C4CED4' }, // Rockies
  116: { primary: '#0C2C56', secondary: '#C6011F' }, // Tigers
  117: { primary: '#002D62', secondary: '#EB6E1F' }, // Astros
  118: { primary: '#004687', secondary: '#C09A5B' }, // Royals
  119: { primary: '#005A9C', secondary: '#EF3E42' }, // Dodgers
  120: { primary: '#AB0003', secondary: '#14225A' }, // Nationals
  121: { primary: '#002D72', secondary: '#FF5910' }, // Mets
  133: { primary: '#003831', secondary: '#EFB21E' }, // Athletics
  134: { primary: '#27251F', secondary: '#FDB827' }, // Pirates
  135: { primary: '#2F241D', secondary: '#FFC425' }, // Padres
  136: { primary: '#005C5C', secondary: '#C4CED4' }, // Mariners
  137: { primary: '#FD5A1E', secondary: '#27251F' }, // Giants
  138: { primary: '#C41E3A', secondary: '#0C2340' }, // Cardinals
  139: { primary: '#092C5C', secondary: '#8FBCE6' }, // Rays
  140: { primary: '#003278', secondary: '#C0111F' }, // Rangers
  141: { primary: '#134A8E', secondary: '#1D2D5C' }, // Blue Jays
  142: { primary: '#002B5C', secondary: '#D31145' }, // Twins
  143: { primary: '#E81828', secondary: '#002D72' }, // Phillies
  144: { primary: '#CE1141', secondary: '#13274F' }, // Braves
  145: { primary: '#27251F', secondary: '#C4CED4' }, // White Sox
  146: { primary: '#00A3E0', secondary: '#FF6600' }, // Marlins
  147: { primary: '#003087', secondary: '#E4002C' }, // Yankees
  158: { primary: '#12284B', secondary: '#FFC52F' }, // Brewers
};

async function mlbFetch(path) {
  const r = await fetch(MLB_BASE + path);
  if (!r.ok) throw new Error(`MLB API ${r.status} — ${path}`);
  return r.json();
}

/** Find a team by name/abbreviation/city */
async function findTeam(name) {
  const d = await mlbFetch('/api/v1/teams?sportId=1&season=2026');
  const q = name.trim().toLowerCase();
  const team = d.teams.find(t =>
    t.name.toLowerCase().includes(q) ||
    t.teamName.toLowerCase().includes(q) ||
    (t.abbreviation  || '').toLowerCase() === q ||
    (t.franchiseName || '').toLowerCase().includes(q) ||
    (t.locationName  || '').toLowerCase().includes(q)
  );
  if (!team) throw new Error(`"${name}" not found. Try a nickname like "Yankees" or full name like "New York Yankees".`);
  return team;
}

/** Fetch all 30 teams' hitting + pitching stats for league ranking */
async function fetchAllTeamStats() {
  const [hitAll, pitAll] = await Promise.all([
    mlbFetch('/api/v1/teams/stats?stats=season&group=hitting&season=2026&sportId=1'),
    mlbFetch('/api/v1/teams/stats?stats=season&group=pitching&season=2026&sportId=1')
  ]);

  const hitting  = {};
  const pitching = {};

  (hitAll.stats?.[0]?.splits || []).forEach(s => {
    if (s.team?.id) hitting[s.team.id] = s.stat;
  });
  (pitAll.stats?.[0]?.splits || []).forEach(s => {
    if (s.team?.id) pitching[s.team.id] = s.stat;
  });

  return { hitting, pitching };
}

/**
 * Compute league rank (1 = best) for a given stat across all teams.
 * higherIsBetter: true for OPS/AVG/HR etc., false for ERA/WHIP etc.
 * Returns { rank, total, pct } where pct = percentile 0–100 (100 = best)
 */
function leagueRank(allStats, teamId, statKey, higherIsBetter = true) {
  const vals = Object.entries(allStats)
    .map(([id, stat]) => ({ id: parseInt(id), val: parseFloat(stat[statKey]) }))
    .filter(x => !isNaN(x.val));

  if (!vals.length) return null;

  vals.sort((a, b) => higherIsBetter ? b.val - a.val : a.val - b.val);
  const rank  = vals.findIndex(x => x.id === teamId) + 1;
  const total = vals.length;
  const pct   = rank > 0 ? Math.round(((total - rank) / (total - 1)) * 100) : 0;
  return { rank, total, pct };
}

/** Fetch team-level hitting + pitching stats */
async function fetchTeamStats(teamId) {
  const [hitD, pitD] = await Promise.allSettled([
    mlbFetch(`/api/v1/teams/${teamId}/stats?stats=season&group=hitting&season=2026`),
    mlbFetch(`/api/v1/teams/${teamId}/stats?stats=season&group=pitching&season=2026`)
  ]);
  return {
    hitting:  hitD.status  === 'fulfilled' ? (hitD.value.stats?.[0]?.splits?.[0]?.stat  || {}) : {},
    pitching: pitD.status  === 'fulfilled' ? (pitD.value.stats?.[0]?.splits?.[0]?.stat  || {}) : {}
  };
}

/** Fetch starter vs bullpen pitching splits */
async function fetchPitchingSplits(teamId) {
  const [startersD, bullpenD] = await Promise.allSettled([
    mlbFetch(`/api/v1/teams/${teamId}/stats?stats=season&group=pitching&season=2026&playerPool=startingPitchers`),
    mlbFetch(`/api/v1/teams/${teamId}/stats?stats=season&group=pitching&season=2026&playerPool=relievers`)
  ]);

  const starters = startersD.status === 'fulfilled'
    ? (startersD.value.stats?.[0]?.splits?.[0]?.stat || null) : null;
  const bullpen  = bullpenD.status  === 'fulfilled'
    ? (bullpenD.value.stats?.[0]?.splits?.[0]?.stat  || null) : null;

  return { starters, bullpen };
}

/**
 * Fetch active roster AND derive the real IL list from the 40-man roster.
 *
 * WHY: The `rosterType=injuries` endpoint is unreliable — it often returns
 * stale or empty data, which caused the AI to hallucinate IL player names.
 *
 * FIX: We fetch the 40-man roster (which includes every player and their
 * current status) and filter by status codes that indicate IL placement:
 *   - '10D'  = 10-Day IL
 *   - '15D'  = 15-Day IL (legacy/minors)
 *   - '60D'  = 60-Day IL
 *   - 'DES'  = Designated for assignment (not IL but worth tracking)
 * The active 26-man is separately fetched for the active count.
 */
async function fetchRosters(teamId) {
  // IL status codes used by the MLB API on the 40-man roster endpoint
  const IL_STATUS_CODES = new Set(['10D', '15D', '60D', 'IL10', 'IL60', 'IL7', 'DTD']);

  const [activeD, fortyManD] = await Promise.allSettled([
    mlbFetch(`/api/v1/teams/${teamId}/roster?rosterType=active&season=2026`),
    mlbFetch(`/api/v1/teams/${teamId}/roster?rosterType=fullRoster&season=2026`)
  ]);

  const active = activeD.status === 'fulfilled' ? (activeD.value.roster || []) : [];

  // Derive IL from 40-man by checking status codes
  let il = [];
  if (fortyManD.status === 'fulfilled') {
    const fullRoster = fortyManD.value.roster || [];
    il = fullRoster.filter(p => {
      const code = p.status?.code || '';
      // Check both the status code and description for IL indicators
      const desc = (p.status?.description || '').toLowerCase();
      return IL_STATUS_CODES.has(code) ||
             desc.includes('injured list') ||
             desc.includes('10-day') ||
             desc.includes('60-day');
    });
  }

  // If 40-man fetch failed, fall back to the dedicated injuries endpoint
  // but flag it as potentially stale
  if (il.length === 0 && fortyManD.status !== 'fulfilled') {
    try {
      const fallback = await mlbFetch(`/api/v1/teams/${teamId}/roster?rosterType=injuries&season=2026`);
      il = fallback.roster || [];
    } catch {
      il = [];
    }
  }

  return { active, il };
}

/** Fetch top individual hitters on the team (by OPS) */
async function fetchTopHitters(teamId) {
  try {
    const d = await mlbFetch(
      `/api/v1/stats?stats=season&group=hitting&season=2026&teamId=${teamId}`
    );
    const players = (d.stats?.[0]?.splits || [])
      .map(s => ({ name: s.player?.fullName || '—', stat: s.stat }))
      .filter(p => parseFloat(p.stat?.plateAppearances || 0) >= 10);

    players.sort((a, b) => parseFloat(b.stat?.ops || 0) - parseFloat(a.stat?.ops || 0));
    return players.slice(0, 5);
  } catch { return []; }
}

/** Fetch top individual pitchers on the team (by ERA, min 3 IP) */
async function fetchTopPitchers(teamId) {
  try {
    const d = await mlbFetch(
      `/api/v1/stats?stats=season&group=pitching&season=2026&teamId=${teamId}`
    );
    const players = (d.stats?.[0]?.splits || [])
      .map(s => ({ name: s.player?.fullName || '—', stat: s.stat }))
      .filter(p => {
        const ip = parseFloat(p.stat?.inningsPitched || 0);
        return ip >= 3;
      });

    players.sort((a, b) => parseFloat(a.stat?.era || 99) - parseFloat(b.stat?.era || 99));
    return players.slice(0, 5);
  } catch { return []; }
}

/** Return team color object or default */
function getTeamColors(teamId) {
  return TEAM_COLORS[teamId] || { primary: '#1a1a1a', secondary: '#444444' };
}

/** Safe stat value extractor */
function sv(o, ...keys) {
  for (const k of keys) if (o && o[k] != null && o[k] !== '') return o[k];
  return null;
}

/** Format number */
function fmtN(v, d = 3) {
  if (v == null || v === '') return '—';
  const n = parseFloat(v);
  return isNaN(n) ? '—' : n.toFixed(d);
}
