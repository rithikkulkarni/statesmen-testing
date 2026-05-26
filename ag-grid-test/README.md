# AG Grid Prototype

## AI Config Setup

1. Copy `.env.example` to `.env`.
2. Set `GEMINI_API_KEY`.
3. Optional: set `GEMINI_MODEL` (default is `gemini-2.5-flash-lite`).
4. Run `npm run dev`.

The AI assistant in the UI sends your prompt to `/api/generate-config`, receives a full table config JSON, applies it to the grid, and updates the JSON editor.

## Numeric Filter JSON Shortcuts

For numeric columns like `amount`, you can use shorthand bounds in JSON:

- Min only: `"amount": { "min": 2000 }`
- Max only: `"amount": { "max": 5000 }`
- Range: `"amount": { "min": 1000, "max": 3000 }`

These are normalized into AG Grid number filter models when applied.

## Automatic Bottom Totals

The grid now auto-calculates a pinned bottom totals row for numeric measure columns (money/count-like fields), while excluding ID-like columns.

## Multi-Sort

Multi-sort is enabled by default. Click one column header, then click another to add secondary (and tertiary) sort levels. The header sort-order badges (`1`, `2`, `3`, ...) show priority.
