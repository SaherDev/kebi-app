# Quickstart: Consult SSE Proxy (Local Dev)

## Prerequisites

- NestJS API running: `pnpm nx serve api`
- FastAPI (kebi) running: `uvicorn main:app --reload` on port 8000
- `services/api/config/.local.yaml` has `ai_service.base_url: http://localhost:8000`

## Test Non-Streaming

```bash
curl -X POST http://localhost:3333/api/v1/consult \
  -H "Authorization: Bearer <your-clerk-token>" \
  -H "Content-Type: application/json" \
  -d '{"query": "good ramen near me"}'
```

Expected: single JSON response with `primary`, `alternatives`, `reasoning_steps`.

## Test Streaming

```bash
curl -X POST http://localhost:3333/api/v1/consult \
  -H "Authorization: Bearer <your-clerk-token>" \
  -H "Content-Type: application/json" \
  -N \
  -d '{"query": "good ramen near me", "stream": true}'
```

`-N` disables curl buffering. Expected: `data: {...}` lines arriving progressively.

## Test Disconnect Cleanup

Run the streaming curl above and press Ctrl+C after a few events. In the NestJS logs you should see the upstream connection to FastAPI terminated immediately.

## Bruno

Open `kebi-config/bruno/nestjs-api/consult-stream.bru` in Bruno desktop, set the `nestjs_url` environment variable to `http://localhost:3333`, and run both variants.
