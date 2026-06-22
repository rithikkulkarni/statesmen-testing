# Contributing

## Prerequisites

- Node.js >= 20 (use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm))
- npm >= 10

## Local setup

```bash
git clone <repo-url>
cd rit-api
npm install
cp .env.example .env   # edit as needed (see Environment section)
npm run dev
```

The server starts on http://localhost:3000. Check http://localhost:3000/health to confirm it is up.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `production` | `development` enables pretty logs |
| `LOG_LEVEL` | `info` | Pino log level |

## Running tests

```bash
npm test          # single run
npm run test:watch  # watch mode
```

## Lint and format

```bash
npm run lint        # check for issues
npm run lint:fix    # auto-fix where possible
npm run format      # format all source files
npm run format:check  # check formatting (used in CI)
```

## Type checking

```bash
npm run typecheck
```

## Submitting changes

1. Branch from `main`: `git checkout -b feat/your-feature`
2. Make your changes
3. Ensure `npm test`, `npm run lint`, and `npm run typecheck` all pass
4. Open a pull request against `main`
5. CI will run automatically on every push

## Code style

- TypeScript strict mode is on — no `any` without justification
- Logs use Pino — never `console.log` in production code
- Tests live in `tests/` and use Vitest
