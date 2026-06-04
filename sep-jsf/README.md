# SEP JSF Demo

JSF + PrimeFaces port of the ag-grid-test insurance payments prototype.

## Stack

- **Java 17** (already installed)
- **Jakarta Faces 4** via **TomEE Plus 9.1** (downloaded automatically)
- **PrimeFaces 14** DataTable
- **Gemini** (or Ollama) for the AI Analyst — server-side, key never exposed to the browser

## First-time setup

### 0. Install Maven (one-time, ~10 MB)

Run this in **PowerShell as Administrator** — downloads Maven 3.9.6 and adds it to your system PATH:

```powershell
$dest = "$env:USERPROFILE\tools"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Invoke-WebRequest "https://archive.apache.org/dist/maven/maven-3/3.9.6/binaries/apache-maven-3.9.6-bin.zip" -OutFile "$env:TEMP\maven.zip"
Expand-Archive "$env:TEMP\maven.zip" -DestinationPath $dest -Force
[System.Environment]::SetEnvironmentVariable("Path", [System.Environment]::GetEnvironmentVariable("Path","User") + ";$dest\apache-maven-3.9.6\bin", "User")
```

Close and reopen your terminal, then `mvn --version` should work.

### 1. Set your Gemini API key

The AI Analyst reads `GEMINI_API_KEY` from the environment.  
In PowerShell before starting the server:

```powershell
$env:GEMINI_API_KEY = "your_key_here"
```

Or add it permanently via Windows → System → Environment Variables.

To use Ollama instead:
```powershell
$env:AI_PROVIDER   = "ollama"
$env:OLLAMA_BASE_URL = "http://127.0.0.1:11434"
$env:OLLAMA_MODEL  = "llama3.1:8b"
```

### 2. Run the app

From the `sep-jsf` directory in PowerShell:

```powershell
.\mvnw.cmd tomee:run
```

First run downloads:
- Maven (~10 MB) into `C:\Users\<you>\.m2\wrapper\`
- TomEE Plus (~50 MB) into `~\.m2\repository\`

Subsequent runs start in seconds.

### 3. Open in browser

```
http://localhost:8090
```

## Features

| Feature | Notes |
|---|---|
| PrimeFaces DataTable | sorting, filtering, pagination |
| Multi-sort | Shift+click column headers |
| Column filters | per-column input in each header |
| Column toggle | "Toggle Columns" button |
| 4 datasets | Payments, Adjustments, Exceptions, Candy |
| JSON config editor | Apply / Export / Reset Default |
| AI Analyst chat | Gemini or Ollama, server-side |
| Config patches from AI | AI can suggest filter/sort changes and apply them live |

## Changing the port

Edit `pom.xml` and change `<httpPort>8090</httpPort>`.

## Building a WAR for deployment

```powershell
.\mvnw.cmd package
```

The WAR file is at `target/sep-jsf.war`. Deploy to any Jakarta EE 10-compatible server (TomEE, WildFly, Payara, OpenLiberty).
