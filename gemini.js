/* =============================================
   gemini.js — Gemini API helpers (client-side)
   All requests are proxied through /api/gemini
   so the API key never appears in the browser.
   ============================================= */

async function geminiFetch(messages, system = '') {
  const resp = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, system })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(`Gemini API ${resp.status}: ${err.error || resp.statusText}`);
  }

  const data = await resp.json();
  return data.text || '';
}

/** Build the full report-card prompt and call Gemini */
async function generateReport(teamName, payload) {

  // ── Pre-extract verified values to inject into the prompt as ground truth ──
  // This prevents Gemini from reaching into its training data to fill gaps.

  const ilCount  = payload.roster?.il ?? 0;
  const ilNames  = payload.roster?.ilPlayers?.length
    ? payload.roster.ilPlayers.join(', ')
    : 'none listed';

  // FIX #1: Real avg age computed from birthdates in app.js
  const avgAge     = payload.roster?.avgAge != null ? `${payload.roster.avgAge}` : null;
  const avgAgeNote = avgAge
    ? `${avgAge} years (calculated from live roster birthdate data)`
    : 'not available — omit this stat row entirely';

  // FIX #2: Real pace projections computed in app.js from actual games played
  const paceNote = payload.pace
    ? `Based on ${payload.pace.gamesPlayed} games played of ${payload.pace.seasonGames}:
       HR pace: ${payload.pace.hrPace ?? 'N/A'} | Runs pace: ${payload.pace.runsPace ?? 'N/A'} | Saves pace: ${payload.pace.savesPace ?? 'N/A'} | K pace: ${payload.pace.kPace ?? 'N/A'}
       Use ONLY these pre-calculated pace figures. Do not compute your own pace projections.`
    : 'Season pace data unavailable — do not include pace projections in the report.';

  // FIX #3: Real K% computed in app.js (strikeouts / plate appearances)
  const kPct     = payload.hitting?.kPct ?? null;
  const kPctNote = kPct
    ? `${kPct} (pre-calculated from API data — use this exact value)`
    : 'not available — omit K Rate stat row entirely';

  // FIX #4: Real save conversion % computed in app.js (saves / save opps)
  const saveConvPct  = payload.pitching?.saveConvPct ?? null;
  const saveConvNote = saveConvPct
    ? `${saveConvPct} (pre-calculated from API data — use this exact value)`
    : 'not available — omit save conversion stat';

  const prompt = `You are a senior MLB analyst generating a GM report card. Given these 2026 season stats for the ${teamName}, return ONLY a valid JSON object — no markdown fences, no prose outside the JSON.

STATS DATA:
${JSON.stringify(payload, null, 2)}

═══════════════════════════════════════════════════
CRITICAL DATA INTEGRITY RULES — VIOLATIONS WILL PRODUCE A WRONG REPORT
═══════════════════════════════════════════════════
1. PLAYER NAMES: Never invent, assume, or recall names from training data.
   Every player name used MUST appear in topHitters, topPitchers, or roster.ilPlayers above.

2. IL ROSTER: The injured list has exactly ${ilCount} players. Names: ${ilNames}.
   Do not add, remove, or substitute any names. Do not mention any other player as injured.

3. ALL NUMBERS: Every stat value must come directly from STATS DATA.
   Do not recall, estimate, or compute values beyond what is explicitly pre-calculated below.

4. AVG AGE → Use this pre-calculated value: ${avgAgeNote}

5. PACE PROJECTIONS → ${paceNote}

6. K RATE → Use this pre-calculated value: ${kPctNote}

7. SAVE CONVERSION % → Use this pre-calculated value: ${saveConvNote}

8. NULL / MISSING DATA: If a field is null or not available, write "N/A" or omit the stat row.
   Do not fill missing values with guesses.
═══════════════════════════════════════════════════

Return this exact JSON shape. Stat "value" fields must be strings (e.g. ".812", "23.4%", "27.4").
All "note" fields should give league context using the leagueRanks provided (e.g. "#4/30", "Top 5 MLB").
"flag" must be exactly "good", "neutral", or "bad".

{
  "overallGrade": "B+",
  "overallSummary": "2-3 sentence executive take for the GM covering offense, pitching, and roster outlook. Use only numbers from STATS DATA.",
  "offense": {
    "grade": "A-",
    "headline": "Punchy headline under 8 words",
    "stats": [
      {"label": "Team OPS",  "value": "[use ops from hitting]",  "note": "[rank from leagueRanks.ops]",  "flag": "good|neutral|bad"},
      {"label": "Home Runs", "value": "[use hr from hitting]",   "note": "[rank from leagueRanks.hr — if pace available, add pace projection using pre-calculated pace.hrPace only]", "flag": "good|neutral|bad"},
      {"label": "K Rate",    "value": "[use hitting.kPct — omit row if null]", "note": "[rank context if available]", "flag": "good|neutral|bad"}
    ],
    "strength": "One sentence. Player name only if in topHitters.",
    "weakness": "One sentence."
  },
  "rotation": {
    "grade": "C+",
    "headline": "Punchy headline under 8 words",
    "stats": [
      {"label": "SP ERA",  "value": "[use rotation.era]",  "note": "[rank from leagueRanks.era]",  "flag": "good|neutral|bad"},
      {"label": "SP WHIP", "value": "[use rotation.whip]", "note": "[context]",                    "flag": "good|neutral|bad"},
      {"label": "SP K/9",  "value": "[compute only if rotation.k and rotation.ip are both non-null: (k/ip*9).toFixed(1)]", "note": "[context]", "flag": "good|neutral|bad"}
    ],
    "strength": "One sentence. Player name only if in topPitchers.",
    "weakness": "One sentence."
  },
  "bullpen": {
    "grade": "A",
    "headline": "Punchy headline under 8 words",
    "stats": [
      {"label": "BP ERA",       "value": "[use bullpen.era]",                              "note": "[rank context]",   "flag": "good|neutral|bad"},
      {"label": "Saves",        "value": "[use pitching.saves]",                           "note": "[pace.savesPace if available, otherwise rank context]", "flag": "good|neutral|bad"},
      {"label": "Save Conv %",  "value": "[use pitching.saveConvPct — omit row if null]",  "note": "[context]",        "flag": "good|neutral|bad"}
    ],
    "strength": "One sentence. Player name only if in topPitchers.",
    "weakness": "One sentence."
  },
  "roster": {
    "grade": "B",
    "headline": "Punchy headline under 8 words",
    "stats": [
      {"label": "Active Roster", "value": "[use roster.active]",                       "note": "Full 26-man",                  "flag": "good"},
      {"label": "IL Players",    "value": "${ilCount}",                                "note": "From live 40-man roster data", "flag": "${ilCount > 5 ? 'bad' : ilCount > 2 ? 'neutral' : 'good'}"},
      {"label": "Avg Age",       "value": "[use roster.avgAge — omit row if null]",    "note": "[context e.g. prime window / aging core / young roster]", "flag": "good|neutral|bad"}
    ],
    "strength": "One sentence on roster depth.",
    "weakness": "One sentence. If referencing IL players, only name players from this exact list: ${ilNames}"
  },
  "insights": [
    "Data-backed insight using a real number from STATS DATA. No invented player names.",
    "Second analytical pattern or anomaly — numbers only from STATS DATA.",
    "Third observation — trend, risk, or hidden strength — no invented values.",
    "Concrete GM action item: trade target type, deadline priority, or contract decision."
  ]
}`;

  const raw = await geminiFetch([{ role: 'user', content: prompt }]);

  const cleaned = raw.replace(/```json|```/gi, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in Gemini response. Raw: ' + raw.slice(0, 200));
  return JSON.parse(jsonMatch[0]);
}

/** Answer a follow-up GM question given the full report context */
async function answerQuestion(question, teamName, reportContext) {
  const system = `You are a sharp, data-driven MLB analyst advising a General Manager. You have already generated a full report card for the ${teamName}. Answer follow-up questions concisely and analytically — 2-4 sentences max unless a list is clearly better. Reference specific stats when relevant. Speak directly to the GM.

CRITICAL: The report context below is the single source of truth.
- Only mention player names that appear in topHitters, topPitchers, or roster.ilPlayers in the context.
- Do not recall player names, injury status, or stats from your training data.
- Do not compute or project numbers — only reference figures already present in the context.`;

  const userContent = `Current report context:
${JSON.stringify(reportContext, null, 2)}

GM Question: ${question}`;

  return geminiFetch([{ role: 'user', content: userContent }], system);
}
