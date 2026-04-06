/* =============================================
   mlb.js — MLB Stats API helpers
   ============================================= */

const MLB_BASE = 'https://statsapi.mlb.com';
const CURRENT_SEASON = '2026'; // Centralized season setting

// Known team primary/secondary colors (hex).
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
  139: { primary: '#003831', secondary: '#EFB21E' }, // Rays (Fixed)
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
  // Add cache-busting to ensure we get the latest data from the API
  const separator = path.includes('?') ? '&' : '?';
  const url = `${MLB_BASE}${path}${separator}v=${Date.now()}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`MLB API ${r.status} — ${path}`);
  return r.json();
}

/** Find a team by name/abbreviation/city */
async function findTeam(name) {
  const d = await mlbFetch(`/api/v1/teams?sportId=1&season=${CURRENT_SEASON}`);
  const q = name.trim().toLowerCase();
  const team = d.teams.find(t =>
    t.name.toLowerCase().includes(q) ||
    t.teamName.toLowerCase().includes(q) ||
    (t.abbreviation  || '').toLowerCase() === q ||
    (t.franchiseName || '').toLowerCase().includes(q) ||
    (t.locationName  || '').toLowerCase().includes(q)
  );
  if (!team) throw new Error(`"${name}" not found.`);
  return team;
}

/** Fetch all 30 teams' hitting + pitching stats for league ranking */
async function fetchAllTeamStats() {
  const [hitAll, pitAll] = await Promise.all([
    mlbFetch(`/api/v1/teams/stats?stats=season&group=hitting&season=${CURRENT_SEASON}&sportId=1`),
    mlbFetch(`/api/v1/teams/stats?stats=season&group=pitching&season=${CURRENT_SEASON}&sportId=1`)
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

async function fetchTeamStats(teamId) {
  const [hitD, pitD] = await Promise.allSettled([
    mlbFetch(`/api/v1/teams/${teamId}/stats?stats=season&group=hitting&season=${CURRENT_SEASON}`),
    mlbFetch(`/api/v1/teams/${teamId}/stats?stats=season&group=pitching&season=${CURRENT_SEASON}`)
  ]);
  return {
    hitting:  hitD.status  === 'fulfilled' ? (hitD.value.stats?.[0]?.splits?.[0]?.stat  || {}) : {},
    pitching: pitD.status  === 'fulfilled' ? (pitD.value.stats?.[0]?.splits?.[0]?.stat  || {}) : {}
  };
}

async function fetchPitchingSplits(teamId) {
  const [startersD, bullpenD] = await Promise.allSettled([
    mlbFetch(`/api/v1/teams/${teamId}/stats?stats=season&group=pitching&season=${CURRENT_SEASON}&playerPool=startingPitchers`),
    mlbFetch(`/api/v1/teams/${teamId}/stats?stats=season&group=pitching&season=${CURRENT_SEASON}&playerPool=relievers`)
  ]);

  const starters = startersD.status === 'fulfilled'
    ? (startersD.value.stats?.[0]?.splits?.[0]?.stat || null) : null;
  const bullpen  = bullpenD.status  === 'fulfilled'
    ? (bullpenD.value.stats?.[0]?.splits?.[0]?.stat  || null) : null;

  return { starters, bullpen };
}

async function fetchRosters(teamId) {
  const [activeD, ilD] = await Promise.allSettled([
    mlbFetch(`/api/v1/teams/${teamId}/roster?rosterType=active&season=${CURRENT_SEASON}`),
    mlbFetch(`/api/v1/teams/${teamId}/roster?rosterType=injuries&season=${CURRENT_SEASON}`)
  ]);
  return {
    active: activeD.status === 'fulfilled' ? (activeD.value.roster || []) : [],
    il:     ilD.status     === 'fulfilled' ? (ilD.value.roster     || []) : []
  };
}

async function fetchTopHitters(teamId) {
  try {
    const d = await mlbFetch(
      `/api/v1/stats?stats=season&group=hitting&season=${CURRENT_SEASON}&teamId=${teamId}`
    );
    const players = (d.stats?.[0]?.splits || [])
      .map(s => ({ name: s.player?.fullName || '—', stat: s.stat }))
      .filter(p => parseFloat(p.stat?.plateAppearances || 0) >= 10);

    players.sort((a, b) => parseFloat(b.stat?.ops || 0) - parseFloat(a.stat?.ops || 0));
    return players.slice(0, 5);
  } catch { return []; }
}

async function fetchTopPitchers(teamId) {
  try {
    const d = await mlbFetch(
      `/api/v1/stats?stats=season&group=pitching&season=${CURRENT_SEASON}&teamId=${teamId}`
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

function getTeamColors(teamId) {
  return TEAM_COLORS[teamId] || { primary: '#1a1a1a', secondary: '#444444' };
}

function sv(o, ...keys) {
  for (const k of keys) if (o && o[k] != null && o[k] !== '') return o[k];
  return null;
}

function fmtN(v, d = 3) {
  if (v == null || v === '') return '—';
  const n = parseFloat(v);
  return isNaN(n) ? '—' : n.toFixed(d);
}