# ADR-001: Tech Stack

**Date:** 2026-06-18
**Status:** Accepted
**Author:** CTO

## Context

Greenfield startup, no product direction defined yet. The goal is to move fast once a product direction is locked in. We need a stack that:

- Has a short ramp-up time
- Supports rapid iteration
- Has a rich ecosystem for building APIs
- Is production-ready without heavy ops overhead

## Decisions

### Language: TypeScript

**Rationale:** Type safety catches bugs at compile time, enabling confident refactoring. The Node.js ecosystem (npm) is the largest in the world. TypeScript is the de facto standard for serious Node.js projects.

**Alternatives considered:** Go (faster runtime, steeper ramp for product pivots), Python (great for ML, slower API performance).

### Framework: Hono

**Rationale:** Ultra-lightweight web framework (~14kb). Works on Node.js, Cloudflare Workers, Deno, and Bun — gives us flexibility to move to edge compute without a rewrite. Fast router, first-class TypeScript.

**Alternatives considered:** Express (no types by default, aging), Fastify (heavier, more config).

### Testing: Vitest

**Rationale:** Fastest TypeScript-native test runner. Jest-compatible API. Zero-config TypeScript support.

### Logging: Pino

**Rationale:** Fastest structured JSON logger for Node.js. Outputs NDJSON which ships directly into any log aggregator (Datadog, Loki, Logtail). Supports pino-pretty for dev readability.

### Linting / Formatting: ESLint + Prettier

**Rationale:** Industry standard. ESLint with @typescript-eslint catches type-level issues. Prettier removes formatting debates. Enforced in CI.

### CI: GitHub Actions

**Rationale:** Zero-cost for public repos, native to GitHub, workflow-as-code in repo.

### Database: None (deferred)

**Rationale:** No product direction yet. Adding a database before knowing the data model is premature. Will be added as a follow-on ADR once product scope is defined.

### Deployment target: TBD

**Rationale:** Hono portability means we can target Node (Railway, Fly.io, Render), Cloudflare Workers, or Docker without a rewrite.

## Consequences

- All new services default to TypeScript + Hono until a specific use case warrants otherwise.
- New ADRs required for: adding a database, changing deployment targets, or introducing a second language.
