export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { teamName, payload } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
  }

  const prompt = `You are a senior MLB analyst generating a GM report card. Given these 2026 season stats for the ${teamName}, return ONLY a valid JSON object — no markdown fences, no prose outside the JSON.

STATS DATA:
${JSON.stringify(payload, null, 2)}

Return this exact JSON shape:
{
  "overallGrade": "B+",
  "overallSummary": "...",
  "offense": { 
    "grade": "...", 
    "headline": "...", 
    "stats": [
      { "label": "OPS", "value": "0.750", "note": "#10/30", "flag": "good" }
    ], 
    "strength": "...", 
    "weakness": "..." 
  },
  "rotation": { "grade": "...", "headline": "...", "stats": [], "strength": "...", "weakness": "..." },
  "bullpen": { "grade": "...", "headline": "...", "stats": [], "strength": "...", "weakness": "..." },
  "roster": { "grade": "...", "headline": "...", "stats": [], "strength": "...", "weakness": "..." },
  "insights": ["...", "...", "...", "..."]
}

Rules:
- DATA INTEGRITY: Only use the provided stats. Do not use external knowledge of player history, team reputations, or past seasons (2024, 2025, etc.).
- NO HISTORICAL NARRATIVES: Do not mention "bouncing back from last year," "defending champions," or "rebuilding phase" unless the 2026 data explicitly supports it.
- NO PLAYER REPUTATIONS: Do not assume a player is a "superstar" or "struggling veteran" based on real-world knowledge. Judge them ONLY by the 2026 stats in the payload.
- INJURIES: Only mention injuries if players are listed in the 'ilPlayers' array. If 'ilPlayers' is empty, assume the team is healthy.
- MISSING DATA: If a stat is missing or null in the data, use "—" for the value. NEVER use "undefined" or "null" as a string.
- flag must be exactly "good", "neutral", or "bad".
- Use real numbers from the supplied data.
- Rank notes should say e.g. "#4/30".
- Be analytical and specific.
- The "stats" array in each section should contain 3-5 key metrics.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Clean and parse JSON
    const cleaned = rawText.replace(/```json|```/gi, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid AI response');
    
    res.status(200).json(JSON.parse(jsonMatch[0]));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}