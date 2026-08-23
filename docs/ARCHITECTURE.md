# StashVault architecture

## System overview

StashVault is a same-origin React and Express application. The browser loads a Vite-built React client, while the Express process exposes OAuth, file-proxy, and tRPC routes before serving the static client bundle. The user’s authenticated identity is resolved on every protected request and passed to data procedures as `ctx.user`.

```text
Browser
  │
  ├── React client + TanStack Query
  │        │
  │        └── /api/trpc (typed procedures)
  │                    │
  ├── /api/oauth/callback
  └── /manus-storage/*
                       │
Express + tRPC ────────┼──── MySQL/TiDB (owner-scoped metadata)
                       ├──── Forge Storage (document bytes / signed access)
                       ├──── Forge AI gateway (server-side assistant only)
                       └──── Tesseract + Poppler (receipt/OCR processing)
```

## Request flow

1. The React client calls typed tRPC procedures through `client/src/lib/trpc.ts`.
2. Express mounts the application router under `/api/trpc`.
3. The tRPC context authenticates the request and places the user or `null` on `ctx.user`.
4. Protected procedures require an authenticated owner. They call owner-scoped database helpers in `server/db.ts`.
5. Database helpers return raw rows or feature-ready records. They must never accept a client-provided owner ID as authorization.
6. File uploads use server-side Forge storage helpers. Documents are stored outside the database and only their metadata/key is persisted.

## Authentication and session boundary

The project uses Manus OAuth and an app-session JWT cookie.

| Component | Responsibility |
|---|---|
| `server/_core/oauth.ts` | Registers the OAuth callback and completes the redirect flow. |
| `server/_core/sdk.ts` | Exchanges the OAuth authorization code, signs/verifies the session token, and synchronizes the authenticated user. |
| `server/_core/context.ts` | Resolves the current user for tRPC procedures. |
| `server/_core/cookies.ts` | Applies HTTP-only cookie settings. |
| `server/routers.ts` | Uses protected procedures for user data. |

An external deployment must preserve the exact HTTPS callback origin and make the OAuth callback route available at `/api/oauth/callback`. It must also provide a secure, stable value for `JWT_SECRET`.

## Data ownership model

The core database records include users, products, considered products, documents, ownership events, reminders, and service records. Every product, document, reminder, and considered-product operation is tied to the authenticated user.

Settings persist on the user record:

| Setting | Effect |
|---|---|
| Display name | Updates only the app-level display name; it does not edit OAuth identity data or email. |
| Warranty-expiry reminders | Suppresses only warranty-expiry attention items when disabled. |
| Return-period reminders | Suppresses only return-window attention items when disabled. |
| General product/document reminders | Suppresses general review/missing-document attention items when disabled. |

Preferences suppress reminder visibility/generation; they do not change warranty/return facts or product lifecycle calculations.

## Receipt and evidence processing

Receipt handling is deliberately review-oriented.

1. A file is uploaded to object storage.
2. OCR extracts text and produces a structured, evidence-backed draft.
3. Normalizers repair known receipt-format artifacts such as Indian-currency grouping and date-only formats.
4. The user reviews and can correct the extracted values before confirmation.
5. Confirmation creates the product and preserves the receipt/document association.

No layer should fabricate a price, receipt number, serial number, warranty, return period, or other fact that is not supported by source evidence. Date-only purchase and lifecycle values must not travel through a UTC/local timestamp conversion.

## AI assistant boundary

Ask StashVault constructs a minimal owner-scoped context from the authenticated user’s product and document metadata. It calls the configured Forge-compatible model from the server only. The user-facing response must distinguish unavailable or missing evidence from confirmed stored facts. UI code must not call the model directly or expose any server credential.

## Storage boundary

Documents and images are stored in object storage. The database stores metadata and object keys. The server storage proxy provides controlled redirects to signed reads, allowing the browser to view files without receiving an object-storage secret.

External hosting requires an equivalent storage integration or a supported way to keep the server-side Forge storage configuration available. A filesystem upload directory is not a production replacement because serverless or autoscaled instances are ephemeral.

## Testing strategy

Vitest coverage includes protected-router ownership checks, receipt confirmation/linkage, document access, lifecycle calculations, notification-preference gating, assistant safety, and client-side state helpers. Run all quality gates before release:

```bash
pnpm check
pnpm test
pnpm build
```
