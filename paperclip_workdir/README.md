# RIT API

The platform API for RIT. Built with TypeScript + Hono + Pino.

## Project structure

```
.
├── src/
│   ├── index.ts          # Server entry point
│   ├── app.ts            # Hono app: middleware + routing
│   ├── routes/
│   │   └── health.ts     # GET /health
│   └── lib/
│       └── logger.ts     # Structured logger (Pino)
├── tests/
│   └── health.test.ts    # Integration tests
├── docs/
│   ├── adr/
│   │   └── 001-tech-stack.md
│   └── observability.md
├── .github/
│   └── workflows/
│       └── ci.yml        # GitHub Actions CI
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
└── .prettierrc
```

## Quick start

```bash
npm install
npm run dev       # start dev server with hot-reload
npm test          # run tests
npm run lint      # lint
npm run typecheck # type-check
```

## Tech stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript 5
- **Framework:** Hono
- **Logging:** Pino (structured JSON)
- **Testing:** Vitest
- **Linting:** ESLint + Prettier

See docs/adr/001-tech-stack.md for rationale.

## Observability

See docs/observability.md.
