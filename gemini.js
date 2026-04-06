/* =============================================
   gemini.js — Gemini 3.1 Flash-Lite Preview API helpers
   ============================================= */

// Replace with your Gemini API key.
// For production, proxy this call through your backend — never expose keys client-side.
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE'; // Replace with your actual key

const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';

async function geminiFetch(messages, system = '') {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : m.role,
    parts: [{ text: m.content }]
  }));

  const body = { contents };
  if (system) {
    body.system_instruction = {
      parts: [{ text: system }]
    };
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Gemini API ${resp.status}: ${err.slice(0, 300)}`);
  }

  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/** Build the full report-card prompt and call Gemini 3.1 Flash-Lite Preview */
async function generateReport(teamName, payload) {
  // Derive a plain-English IL summary directly from the data so the AI
  // never has to infer or guess player injury status.
  const ilCount = payload.roster?.il ?? 0;
  const ilNames = payload.roster?.ilPlayers?.length
    ? payload.roster.ilPlayers.join(', ')
    : 'none listed';

  const prompt = `You are a senior MLB analyst generating a GM report card. Given these 2025 season stats for the ${teamName}, return ONLY a valid JSON object — no markdown fences, no prose outside the JSON.

STATS DATA:
${JSON.stringify(payload, null, 2)}

CRITICAL DATA INTEGRITY RULES — READ BEFORE GENERATING:
1. NEVER invent, assume, or recall player names from your training data. Every player name you use MUST come from the topHitters, topPitchers, or roster.ilPlayers arrays in STATS DATA above. If a name does not appear in those arrays, do not mention it.
2. The injured list has exactly ${ilCount} players. Their names (if available) are: ${ilNames}. Do not add or remove any names from this list, and do not mention any other player as being injured.
3. All numerical values (ERA, OPS, rank notes, etc.) must come directly from the STATS DATA. Do not invent or recall stats from memory.
4. If a data field is null or missing, say "N/A" or omit it — do not fill it with assumed values.

Return this exact JSON shape (fill all values from the real data above):
{
  "overallGrade": "B+",
  "overallSummary": "2-3 sentence executive take for the GM covering offense, pitching, and roster outlook",
  "offense": {
    "grade": "A-",
    "headline": "Punchy headline under 8 words",
    "stats": [
      {"label": "Team OPS",  "value": ".812", "note": "3rd in MLB (#3/30)",  "flag": "good"},
      {"label": "Home Runs", "value": "87",   "note": "Pace for 228 season", "flag": "good"},
      {"label": "K Rate",    "value": "25.8%","note": "26th in MLB",         "flag": "bad"}
    ],
    "strength": "One sentence on biggest offensive strength, cite a player name only if they appear in topHitters above",
    "weakness": "One sentence on biggest offensive weakness"
  },
  "rotation": {
    "grade": "C+",
    "headline": "Punchy headline under 8 words",
    "stats": [
      {"label": "SP ERA",  "value": "4.44", "note": "24th in MLB", "flag": "bad"},
      {"label": "SP WHIP", "value": "1.38", "note": "High walk rate","flag": "bad"},
      {"label": "SP K/9",  "value": "8.9",  "note": "Above average", "flag": "good"}
    ],
    "strength": "One sentence on rotation strength, cite a player name only if they appear in topPitchers above",
    "weakness": "One sentence on rotation weakness"
  },
  "bullpen": {
    "grade": "A",
    "headline": "Punchy headline under 8 words",
    "stats": [
      {"label": "BP ERA",   "value": "2.91", "note": "2nd in AL",     "flag": "good"},
      {"label": "Saves",    "value": "18",   "note": "92% conv. rate", "flag": "good"},
      {"label": "BP WHIP",  "value": "1.11", "note": "Elite",         "flag": "good"}
    ],
    "strength": "One sentence on bullpen strength, cite a player name only if they appear in topPitchers above",
    "weakness": "One sentence on bullpen concern"
  },
  "roster": {
    "grade": "B",
    "headline": "Punchy headline under 8 words",
    "stats": [
      {"label": "Active Roster", "value": "26", "note": "Full 26-man",    "flag": "good"},
      {"label": "IL Players",    "value": "${ilCount}",  "note": "From live roster data", "flag": "${ilCount > 5 ? 'bad' : ilCount > 2 ? 'neutral' : 'good'}"},
      {"label": "Avg Age",       "value": "28", "note": "Prime window",   "flag": "good"}
    ],
    "strength": "One sentence on roster depth or construction strength",
    "weakness": "One sentence on roster concern. If referencing IL players, only name players from this list: ${ilNames}"
  },
  "insights": [
    "Specific data-backed insight referencing a real number from the STATS DATA",
    "Second analytical pattern or anomaly worth flagging — numbers only from STATS DATA",
    "Third observation — could be a trend, risk, or hidden strength — no invented player names",
    "Concrete GM action item: trade target type, deadline priority, or contract decision"
  ]
}

Rules:
- flag must be exactly "good", "neutral", or "bad"
- Use ONLY real numbers from the supplied STATS DATA — do not invent or recall values from memory
- Rank notes should say e.g. "#4/30" or "Top 5 MLB" using the leagueRanks provided
- Player names are ONLY allowed if they appear in topHitters, topPitchers, or roster.ilPlayers in the data
- Be analytical and specific — this is read by a professional GM`;

  const raw = await geminiFetch([{ role: 'user', content: prompt }]);

  // Extract JSON robustly
  const cleaned = raw.replace(/```json|```/gi, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in Gemini response. Raw: ' + raw.slice(0, 200));
  return JSON.parse(jsonMatch[0]);
}

/** Answer a follow-up GM question given the full report context */
async function answerQuestion(question, teamName, reportContext) {
  const system = `You are a sharp, data-driven MLB analyst advising a General Manager. You have already generated a full report card for the ${teamName}. Answer follow-up questions concisely and analytically — 2-4 sentences max unless a list is clearly better. Reference specific stats when relevant. Speak directly to the GM.

CRITICAL: Only mention player names that appear in the report context data (topHitters, topPitchers, roster.ilPlayers). Do not recall or invent player names or stats from your training data — the report context is the single source of truth.`;

  const userContent = `Current report context:
${JSON.stringify(reportContext, null, 2)}

GM Question: ${question}`;

  return geminiFetch([{ role: 'user', content: userContent }], system);
}
