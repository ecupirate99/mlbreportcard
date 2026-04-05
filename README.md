# MLB GM Report Card — v2

A single-page web app that generates an AI-powered GM report card for any MLB team using live data from the MLB Stats API and Gemini 3.1 Flash-Lite Preview.

## Deployment to Vercel

This app is configured to use **Vercel Serverless Functions** to keep your API keys secure.

### 1. Environment Variables
You need to add one environment variable in your Vercel Project Dashboard:
- `GEMINI_API_KEY`: Your API key from [aistudio.google.com](https://aistudio.google.com).

### 2. Local Development
If you want to run this locally with the API routes, create a `.env` file in the root:
```
GEMINI_API_KEY=your_key_here
```
Then run using `vercel dev`.

## File Structure
- `api/` — Serverless functions (Node.js) for secure AI calls.
- `index.html` — App shell.
- `styles.css` — Custom styling.
- `mlb.js` — MLB Stats API logic.
- `gemini.js` — Client-side bridge to the API routes.
- `render.js` — DOM rendering.
- `app.js` — Main orchestration.