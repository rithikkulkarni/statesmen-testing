# Observability

## Logging

All logs are emitted as **structured JSON** using [Pino](https://getpino.io). Every log line includes:

| Field | Description |
|-------|-------------|
| `level` | Severity: `trace`, `debug`, `info`, `warn`, `error`, `fatal` |
| `time` | ISO 8601 timestamp |
| `service` | Always `rit-api` |
| `version` | Package version from `package.json` |
| `env` | `NODE_ENV` (production / development) |
| `msg` | Human-readable message |

Additional fields are added per-log-site (e.g. `method`, `path`, `status`, `ms` on request logs).

### Log levels

| Level | When to use |
|-------|-------------|
| `error` | Unrecoverable failures, unexpected exceptions |
| `warn` | Recoverable issues, degraded state, deprecated usage |
| `info` | Normal operational events (start, request, shutdown) |
| `debug` | Diagnostic detail for development |
| `trace` | High-frequency detail (never in production) |

Set the log level via the `LOG_LEVEL` environment variable (default: `info`).

### Local development

In development (`NODE_ENV=development`), logs are pretty-printed via `pino-pretty` for readability. In production they are raw JSON.

```bash
LOG_LEVEL=debug NODE_ENV=development npm run dev
```

## Health check

`GET /health` returns `200 OK` with:

```json
{
  "status": "ok",
  "version": "0.1.0",
  "commit": "<git-sha>",
  "buildTime": "<iso-timestamp>",
  "uptime": 42.3
}
```

Use this endpoint for:
- Load balancer health checks
- Uptime monitors (e.g. Betterstack, UptimeRobot)
- Kubernetes readiness probe

## Error alerting

**Current state (MVP):** Errors surface through logs. Operators should tail logs (`LOG_LEVEL=warn`) and watch for `level=error` lines.

**Recommended next steps (in priority order):**

1. **Sentry** — add `@sentry/node` and call `Sentry.captureException(err)` in `app.onError`. Free tier covers early-stage usage.
2. **Structured log ingestion** — ship logs to Loki / Logtail / Datadog via a log forwarder. Add alerting rules on `level=error` count thresholds.
3. **Uptime alerting** — wire `/health` to Betterstack or UptimeRobot to get paged when the service goes down.

Until Sentry is wired up: **check the logs**. Every unhandled error is logged at `error` level with the full stack trace.
