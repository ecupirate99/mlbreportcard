/* =============================================
   render.js — DOM rendering helpers
   ============================================= */

/** Apply team color CSS variables to :root */
function applyTeamColors(colors) {
  document.documentElement.style.setProperty('--team-primary',   colors.primary);
  document.documentElement.style.setProperty('--team-secondary', colors.secondary);
}

/** Grade letter → CSS class */
function gradeClass(g) {
  if (!g) return '';
  const l = g[0].toUpperCase();
  return l === 'A' ? 'grade-A' : l === 'B' ? 'grade-B' : l === 'C' ? 'grade-C' : l === 'D' ? 'grade-D' : 'grade-F';
}

function setStatus(msg) {
  document.getElementById('out').innerHTML =
    `<div class="status"><span class="spinner"></span>${msg}</div>`;
}

function setError(msg) {
  document.getElementById('out').innerHTML =
    `<div class="error"><strong>Error:</strong> ${msg}</div>`;
}

/**
 * Render a rank bar under a stat label.
 * pct: 0–100 where 100 = best in league
 * flag: 'good' | 'bad' | 'neutral'
 */
function rankBar(pct, flag) {
  if (pct == null) return '';
  const cls = flag === 'good' ? 'good' : flag === 'bad' ? 'bad' : 'neutral';
  return `<div class="rank-bar-wrap"><div class="rank-bar-fill ${cls}" style="width:${pct}%"></div></div>`;
}

/** Render a single stat row with optional rank bar */
function statRow(label, value, note, flag, rankPct) {
  const valClass = flag === 'good' ? 'good' : flag === 'bad' ? 'bad' : '';
  // Ensure we don't display 'undefined' or 'null'
  const safeValue = (value === undefined || value === null || value === 'undefined') ? '—' : value;
  
  return `
    <div class="stat-row">
      <div class="stat-left">
        <span class="stat-label">${label || 'Stat'}</span>
        ${rankPct != null ? rankBar(rankPct, flag) : ''}
      </div>
      <div class="stat-right">
        <span class="stat-val ${valClass}">${safeValue}</span>
        ${note ? `<div class="stat-note">${note}</div>` : ''}
      </div>
    </div>`;
}

/** Render a section card (offense, rotation, bullpen, roster) */
function renderSectionCard(title, data) {
  if (!data) return '';
  const rows = (data.stats || []).map(s => statRow(s.label, s.value, s.note, s.flag)).join('');
  return `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">${title}</div>
          <div class="card-headline">${data.headline || ''}</div>
        </div>
        <div class="grade-pill ${gradeClass(data.grade)}">${data.grade || '—'}</div>
      </div>
      ${rows}
      <div class="sw">
        ${data.strength ? `<div class="sw-item"><span class="good" style="font-weight:700">▲ </span>${data.strength}</div>` : ''}
        ${data.weakness ? `<div class="sw-item"><span class="bad"  style="font-weight:700">▼ </span>${data.weakness}</div>` : ''}
      </div>
    </div>`;
}

/** Render pitcher split boxes inside the pitching card */
function renderPitchingSplitCard(rotationData, bullpenData, splits) {
  const sp = splits?.starters;
  const bp = splits?.bullpen;

  const spEra  = sp ? fmtN(sv(sp,'era'), 2)  : '—';
  const spWhip = sp ? fmtN(sv(sp,'whip'), 2) : '—';
  const spK9   = sp && sp.strikeOuts && sp.inningsPitched
    ? (parseFloat(sp.strikeOuts) / parseFloat(sp.inningsPitched) * 9).toFixed(1) : '—';

  const bpEra  = bp ? fmtN(sv(bp,'era'), 2)  : '—';
  const bpWhip = bp ? fmtN(sv(bp,'whip'), 2) : '—';
  const bpSv   = bp ? (sv(bp,'saves') || '0') : '—';

  return `
    <div class="card" style="grid-column: 1 / -1">
      <div class="card-header">
        <div>
          <div class="card-title">Pitching</div>
          <div class="card-headline">Rotation vs. Bullpen split</div>
        </div>
        <div style="display:flex; gap:8px; align-items:center">
          <div class="grade-pill ${gradeClass(rotationData?.grade)}" title="Rotation">${rotationData?.grade || '—'}</div>
          <div style="font-size:11px; color:var(--color-text-hint); font-weight:600">ROT</div>
          <div class="grade-pill ${gradeClass(bullpenData?.grade)}" title="Bullpen">${bullpenData?.grade || '—'}</div>
          <div style="font-size:11px; color:var(--color-text-hint); font-weight:600">BP</div>
        </div>
      </div>

      <div class="split-row">
        <div class="split-box">
          <div class="split-box-label">Starting Rotation</div>
          <div class="split-stat-row"><span>ERA</span><span>${spEra}</span></div>
          <div class="split-stat-row"><span>WHIP</span><span>${spWhip}</span></div>
          <div class="split-stat-row"><span>K/9</span><span>${spK9}</span></div>
          ${rotationData?.stats ? rotationData.stats.slice(0,2).map(s =>
            `<div class="split-stat-row"><span>${s.label}</span><span class="${s.flag==='good'?'good':s.flag==='bad'?'bad':''}">${s.value || '—'}</span></div>`
          ).join('') : ''}
        </div>
        <div class="split-box">
          <div class="split-box-label">Bullpen</div>
          <div class="split-stat-row"><span>ERA</span><span>${bpEra}</span></div>
          <div class="split-stat-row"><span>WHIP</span><span>${bpWhip}</span></div>
          <div class="split-stat-row"><span>Saves</span><span>${bpSv}</span></div>
          ${bullpenData?.stats ? bullpenData.stats.slice(0,2).map(s =>
            `<div class="split-stat-row"><span>${s.label}</span><span class="${s.flag==='good'?'good':s.flag==='bad'?'bad':''}">${s.value || '—'}</span></div>`
          ).join('') : ''}
        </div>
      </div>

      <div class="sw">
        ${rotationData?.weakness ? `<div class="sw-item"><span class="bad" style="font-weight:700">▼ ROT: </span>${rotationData.weakness}</div>` : ''}
        ${bullpenData?.strength  ? `<div class="sw-item"><span class="good" style="font-weight:700">▲ BP: </span>${bullpenData.strength}</div>` : ''}
      </div>
    </div>`;
}

/** Render top hitters leaders section */
function renderHitterLeaders(players) {
  if (!players || !players.length) return '';

  const categories = [
    { key: 'ops',          label: 'OPS',  fmt: v => parseFloat(v).toFixed(3) },
    { key: 'homeRuns',     label: 'HR',   fmt: v => v },
    { key: 'battingAverage', label: 'AVG', fmt: v => parseFloat(v).toFixed(3) },
    { key: 'rbi',          label: 'RBI',  fmt: v => v },
  ];

  const cards = categories.map(cat => {
    const sorted = [...players]
      .filter(p => p.stat[cat.key] != null)
      .sort((a, b) => parseFloat(b.stat[cat.key]) - parseFloat(a.stat[cat.key]))
      .slice(0, 3);
    if (!sorted.length) return '';

    const items = sorted.map((p, i) => `
      <div class="leader-item">
        <span class="leader-rank">${i + 1}</span>
        <span class="leader-name">${p.name.split(' ').pop()}</span>
        <span class="leader-val">${cat.fmt(p.stat[cat.key])}</span>
      </div>`).join('');

    return `
      <div class="leader-card">
        <div class="leader-cat">${cat.label}</div>
        ${items}
      </div>`;
  }).join('');

  return `
    <div class="leaders-section">
      <div class="leaders-title">Top Hitters — 2026</div>
      <div class="leaders-grid">${cards}</div>
    </div>`;
}

/** Render top pitchers leaders section */
function renderPitcherLeaders(players) {
  if (!players || !players.length) return '';

  const categories = [
    { key: 'era',          label: 'ERA',  fmt: v => parseFloat(v).toFixed(2), asc: true },
    { key: 'strikeOuts',   label: 'K',    fmt: v => v,                         asc: false },
    { key: 'whip',         label: 'WHIP', fmt: v => parseFloat(v).toFixed(2), asc: true },
  ];

  const cards = categories.map(cat => {
    const sorted = [...players]
      .filter(p => p.stat[cat.key] != null)
      .sort((a, b) => cat.asc
        ? parseFloat(a.stat[cat.key]) - parseFloat(b.stat[cat.key])
        : parseFloat(b.stat[cat.key]) - parseFloat(a.stat[cat.key]))
      .slice(0, 3);
    if (!sorted.length) return '';

    const items = sorted.map((p, i) => `
      <div class="leader-item">
        <span class="leader-rank">${i + 1}</span>
        <span class="leader-name">${p.name.split(' ').pop()}</span>
        <span class="leader-val">${cat.fmt(p.stat[cat.key])}</span>
      </div>`).join('');

    return `
      <div class="leader-card">
        <div class="leader-cat">${cat.label}</div>
        ${items}
      </div>`;
  }).join('');

  return `
    <div class="leaders-section">
      <div class="leaders-title">Top Pitchers — 2026</div>
      <div class="leaders-grid">${cards}</div>
    </div>`;
}

/** Render the full report into #out */
function renderReport(team, report, hs, ps, splits, rosters, hitters, pitchers, leagueHitting, leaguePitching) {
  const teamId = team.id;

  // Compute league rank percentiles for key hitting stats
  const ranks = {
    ops:   leagueRank(leagueHitting,  teamId, 'ops',         true),
    hr:    leagueRank(leagueHitting,  teamId, 'homeRuns',     true),
    obp:   leagueRank(leagueHitting,  teamId, 'obp',         true),
    avg:   leagueRank(leagueHitting,  teamId, 'avg',         true),
    era:   leagueRank(leaguePitching, teamId, 'era',         false),
    whip:  leagueRank(leaguePitching, teamId, 'whip',        false),
  };

  const insights = (report.insights || []).map((ins, i) => {
    const icons = ['◆','◆','◆','→'];
    const isBold = i === 3;
    return `
      <div class="insight">
        <span class="insight-icon">${icons[i] || '◆'}</span>
        <span>${isBold ? `<strong>GM action:</strong> ${ins}` : ins}</span>
      </div>`;
  }).join('');

  // Get full list of IL names for debugging
  const ilNames = rosters.il.map(p => p.person?.fullName).filter(Boolean).join(', ') || 'None';

  document.getElementById('out').innerHTML = `
    <div class="report">
      <div class="report-header">
        <div class="team-name">${team.name}</div>
        <div class="season-badge">2026 Season Report</div>
      </div>

      <div class="overall-strip">
        <div class="big-grade ${gradeClass(report.overallGrade)}">${report.overallGrade || '—'}</div>
        <div>
          <div class="overall-label">Overall Grade</div>
          <div class="overall-text">${report.overallSummary || ''}</div>
        </div>
      </div>

      <div class="grid3">
        ${renderSectionCard('Offense', report.offense)}
        ${renderPitchingSplitCard(report.rotation, report.bullpen, splits)}
        ${renderSectionCard('Roster Health', report.roster)}
      </div>

      ${renderHitterLeaders(hitters)}
      ${renderPitcherLeaders(pitchers)}

      <div class="insights-card">
        <div class="insights-title">GM Intelligence Feed</div>
        ${insights}
      </div>

      <div class="raw">
        <strong>Raw snapshot —</strong>
        AVG ${fmtN(sv(hs,'avg'))} ·
        OBP ${fmtN(sv(hs,'obp'))} ·
        SLG ${fmtN(sv(hs,'slg'))} ·
        OPS ${fmtN(sv(hs,'ops'))} ·
        ERA ${fmtN(sv(ps,'era'),2)} ·
        WHIP ${fmtN(sv(ps,'whip'),2)} ·
        Active: ${rosters.active.length} ·
        IL: ${rosters.il.length}
        ${ranks.ops ? ` · OPS rank: #${ranks.ops.rank}/30` : ''}
        ${ranks.era ? ` · ERA rank: #${ranks.era.rank}/30` : ''}
        <br><br>
        <strong>IL List (Source):</strong> ${ilNames}
      </div>
    </div>`;
}

/** Add a bubble to the Q&A thread */
function addQaBubble(role, text) {
  const thread = document.getElementById('qaThread');
  if (!thread.classList.contains('qa-thread')) thread.classList.add('qa-thread');
  const div = document.createElement('div');
  div.className = `qa-bubble ${role}`;
  div.textContent = text;
  thread.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  return div;
}