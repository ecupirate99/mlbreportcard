export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question, teamName, reportContext } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
  }

  const system = `You are a sharp, data-driven MLB analyst advising a General Manager. You have already generated a full report card for the ${teamName}. Answer follow-up questions concisely and analytically — 2-4 sentences max. Reference specific stats. Speak directly to the GM.`;

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