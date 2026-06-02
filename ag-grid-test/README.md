# AG Grid Prototype

## AI Config Setup

1. Copy `.env.example` to `.env`.
2. Choose an AI provider.
3. Run `npm run dev`.

### Gemini

Set:

```ini
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash-lite
```

### Ollama

Start Ollama locally, pull a model, then set:

```ini
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1:8b
```

Example:

```sh
ollama pull llama3.1:8b
ollama serve
```

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
