# Aluminati AI Assistant — Demo

A chatbot UI that runs entirely on local hardware via [Ollama](https://ollama.com).  
Built to demo to Aluminati how a locally-hosted LLM can power an intelligent admin assistant
with zero data leaving their servers.

---

## Prerequisites

| Requirement | Check |
|---|---|
| Ollama installed | `ollama --version` |
| `granite4.1:3b` pulled | `ollama list` (look for `granite4.1:3b`) |

If you haven't pulled the base model yet:
```
ollama pull granite4.1:3b
```

---

## Setup (one-time)

**1. Build the custom model from the Modelfile**

From inside this folder:
```
ollama create aluminati-bot -f Modelfile
```

Verify it exists:
```
ollama list
```
You should see `aluminati-bot` in the list.

**2. Make sure Ollama is running**

Ollama usually auto-starts as a background service. If not:
```
ollama serve
```

---

## Run the demo

Open `index.html` directly in a browser, or serve it over HTTP to avoid any
`file://` CORS quirks:

```
# Option A — Python (no install needed)
python -m http.server 8080

# Option B — Node.js
npx serve .

# Option C — just open the file
start index.html
```

Then visit `http://localhost:8080` (or just open the file).

---

## What the demo shows

- A realistic Aluminati **admin panel** UI with sidebar navigation
- A **streaming chat interface** (responses appear token by token, just like ChatGPT)
- A prominent **"Running Locally — Zero Data Leaves Your Server"** badge
- The model ID (`aluminati-bot · granite4.1:3b · Local Ollama`) displayed in the footer
- Four quick-start prompts covering the most impressive alumni use cases:
  - 25th anniversary reunion planning
  - Re-engagement email drafting
  - Annual fund strategy
  - Mentorship programme design

---

## Key talking point for the demo

> "This entire AI is running on the server you already own.
> No OpenAI bill, no data leaving your infrastructure, no GDPR headaches.
> The model is 3 billion parameters — it fits in 2 GB of RAM."

---

## Customising the Modelfile

Edit `Modelfile` to adjust the assistant's persona, knowledge scope, or tone.
After any edit, rebuild the model:

```
ollama create aluminati-bot -f Modelfile
```

Key parameters:
| Parameter | Current | Effect |
|---|---|---|
| `temperature` | `0.7` | Lower = more consistent, higher = more creative |
| `num_predict` | `1024` | Max tokens per response |
| `top_p` | `0.9` | Nucleus sampling — controls response diversity |
