# AI Development Rules - MLB GM Report Card

This document defines the technical stack and architectural rules for the MLB GM Report Card application to ensure consistency and maintainability.

## Tech Stack
- **Vanilla JavaScript (ES6+):** Core logic, API orchestration, and state management without external frameworks.
- **HTML5 & CSS3:** Semantic markup and custom styling using Flexbox, Grid, and CSS Variables for dynamic theming.
- **Google Gemini API:** Utilizes the `gemini-3.1-flash-lite-preview` model for analytical report generation and natural language Q&A.
- **MLB Stats API:** Primary data source for team statistics, rosters, and player performance metrics.
- **Google Fonts:** Typography powered by 'Barlow' and 'Barlow Condensed'.
- **Modular Architecture:** Separation of concerns across specialized JS files (`mlb.js`, `gemini.js`, `render.js`, `app.js`).

## Development Rules

### 1. Library & Framework Usage
- **No External Frameworks:** Do not introduce React, Vue, or jQuery. Stick to Vanilla JS to keep the app lightweight.
- **No CSS Frameworks:** Do not use Tailwind or Bootstrap. All styling must be authored in `styles.css` using standard CSS.
- **Icons:** Use Unicode characters or CSS-based shapes (like the `.diamond`) instead of icon libraries where possible.

### 2. Architectural Patterns
- **Data Fetching (`mlb.js`):** All calls to `statsapi.mlb.com` must reside here. Use the `mlbFetch` helper.
- **AI Integration (`gemini.js`):** All Gemini API interactions and prompt engineering must reside here.
- **Rendering (`render.js`):** All DOM manipulation and HTML string generation must be centralized here. Never put `innerHTML` or `createElement` logic in other files.
- **Orchestration (`app.js`):** Handles event listeners and high-level workflow (e.g., `runReport`).

### 3. Styling & Theming
- **Team Colors:** Always use the `--team-primary` and `--team-secondary` CSS variables for brand-specific accents.
- **Responsive Design:** Use the established media queries in `styles.css` to ensure the report is readable on mobile devices.

### 4. AI Prompting
- **JSON Enforcement:** AI prompts for report generation must strictly demand JSON output to ensure the `render.js` functions can parse the data reliably.
- **Contextual Q&A:** Always pass the `currentReportContext` to the AI for follow-up questions to maintain session awareness.

### 5. Data Integrity
- **Seasonality:** The app is currently hardcoded for the **2026** season. Ensure all API paths reflect this.
- **Error Handling:** Use the `setError` and `setStatus` helpers in `render.js` to provide user feedback during async operations.