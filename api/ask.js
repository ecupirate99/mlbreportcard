export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question, teamName, reportContext } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
  }

  const system = `You are a sharp, data-driven MLB analyst advising a General Manager. 
  The current date is April 5, 2026.
  
  STRICT RULES:
  1. DATA INTEGRITY: Only use the provided stats from the report context.
  2. NO HALLUCINATIONS: Do not use external knowledge of player history, team reputations, or past seasons.
  3. INJURIES: Only mention injuries if players are listed in the 'ilPlayers' array in the context. If that array is empty, the team is 100% healthy.
  4. NO HISTORICAL NARRATIVES: Do not mention "bouncing back" or "defending champions" unless the 2026 data explicitly supports it.
  5. Answer concisely (2-4 sentences) and speak directly to the GM.`;

  const userContent = `Current report context: ${JSON.stringify(reportContext, null, 2)}\n\nGM Question: ${question}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: userContent }] }]
      })
    });

    const data = await response.json();
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No answer generated.';
    res.status(200).json({ answer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}