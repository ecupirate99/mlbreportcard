/* =============================================
   gemini.js — Updated for Vercel Deployment
   ============================================= */

/** Call the Vercel serverless function for report generation */
async function generateReport(teamName, payload) {
  const resp = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamName, payload })
  });

  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error || 'Failed to generate report');
  }

  return resp.json();
}

/** Call the Vercel serverless function for Q&A */
async function answerQuestion(question, teamName, reportContext) {
  const resp = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, teamName, reportContext })
  });

  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error || 'Failed to get answer');
  }

  const data = await resp.json();
  return data.answer;
}