# StashVault

> **A private personal ownership archive for receipts, warranties, return windows, product records, and supporting documents.**

StashVault helps a signed-in owner keep purchase evidence and product lifecycle information in one place. It supports receipt capture and OCR-assisted review, document storage, warranty and return tracking, repair-first guidance, product comparison, evidence-limited assistance, and account-scoped Settings.

## Current deployment

StashVault is deployed on **Vercel**.

> **Live application:** _Add the Vercel production URL here._
>
> Example: `[Open StashVault](https://your-project.vercel.app)`

The Vercel deployment serves the React application and its Node server entrypoint from the same project. Configure any custom domain in Vercel after confirming that the production deployment is healthy.

The repository includes a Vercel-specific Node server adapter that prevents the compiled Express bundle from being served as page text. The deployment still requires configured portable equivalents for the database, OAuth, file storage, AI, and OCR dependencies. See [Vercel deployment](docs/DEPLOYMENT.md#external-hosting-vercel-and-netlify) for the required setup and recovery steps.

## Product capabilities

| Area | What it does |
|---|---|
| **Receipt capture and OCR** | Accepts receipt images/PDFs, extracts evidence-backed values, and presents a review step before product creation. |
| **My Stash** | Stores owner-scoped product records with purchase evidence, model/serial information, and linked documents. |
| **Documents** | Stores receipts, invoices, warranties, manuals, and other proof. Documents can optionally be linked to an existing saved product, and the signed-in owner can export supported document metadata and extracted receipt fields as a CSV. |
| **Warranty and returns** | Tracks date-only purchase, warranty, and return facts without timezone conversion; produces lifecycle statuses and in-app attention items. |
| **Risk Radar** | Surfaces attention items based on saved product and document evidence. |
| **Ask StashVault** | Provides a server-side assistant constrained to the authenticated user’s stored product and document context. It must not invent missing facts. |
| **Before You Buy** | Saves owner-scoped comparison candidates, identifies missing information, and supports moving a decided item into My Stash. |
| **Repair & Sustainability** | Lists actual saved products and offers evidence-safe repair-first guidance. |
| **Settings** | Persists a display name and in-app reminder preferences for warranty expiry, return-period, and general product/document attention items. |

## Technology

| Layer | Implementation |
|---|---|
| Client | React 19, TypeScript, Vite, Tailwind CSS 4, Wouter, Radix UI, TanStack Query |
| Server | Node.js, Express 4, tRPC 11, SuperJSON |
| Data | Drizzle ORM with MySQL/TiDB-compatible SQL |
| Authentication | Manus OAuth plus an application session JWT cookie |
| Files | Forge-backed object storage and signed access URLs |
| OCR | Tesseract and Poppler system packages, with evidence-safe extraction/normalization |
| AI | Server-side Manus Forge OpenAI-compatible gateway; no AI credential is exposed to the browser |
| Tests | Vitest |

## Repository layout

```text
client/                 React application
  src/components/       Reusable UI and connected feature views
  src/pages/            Route selection and page shells
  src/lib/trpc.ts       Typed tRPC client
server/                 Express, tRPC, data access, services, tests
  _core/                Runtime/auth/storage infrastructure
  services/             OCR, lifecycle, assistant, comparison, and preference logic
drizzle/                Drizzle schema, SQL migrations, metadata
shared/                 Shared constants, types, and error definitions
docs/                   Architecture and deployment documentation
Dockerfile              Supported container recipe with OCR/PDF dependencies
```

## Prerequisites

Use **Node.js 22** and **pnpm 10**. Local OCR requires `tesseract-ocr`, English language data, and `poppler-utils`; the supplied Dockerfile installs these dependencies.

A useful local installation on Ubuntu/Debian is:

```bash
sudo apt-get update
sudo apt-get install -y poppler-utils tesseract-ocr tesseract-ocr-eng
corepack enable
pnpm install
```

You also need a MySQL/TiDB-compatible database, configured OAuth credentials, and working file/AI service credentials. Do not commit `.env` files or production secrets.

## Local setup

1. Clone the repository and install dependencies.

   ```bash
   git clone https://github.com/aasiya-hadiya/StashVault.git
   cd StashVault
   corepack enable
   pnpm install
   ```

2. Create a local environment configuration using the required variable names in the [environment configuration guide](docs/ENVIRONMENT.md). Obtain legitimate values for each service; do not commit that local file.

3. Apply schema migrations to an empty or approved development database.

   ```bash
   pnpm drizzle-kit migrate
   ```

   For schema changes, first run `pnpm drizzle-kit generate`, review the generated SQL, and apply it deliberately. Do not use destructive database commands against production data without a backup and explicit approval.

4. Start the development server.

   ```bash
   pnpm dev
   ```

5. Open the URL printed by the server. The development runtime serves the React client and the API from the same origin.

## Environment configuration

See the [environment configuration guide](docs/ENVIRONMENT.md) for the variable names and security requirements. The application currently expects the following services:

| Variable | Purpose | Browser-visible? |
|---|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string for owner-scoped application data | No |
| `JWT_SECRET` | Signs the application session cookie | No |
| `VITE_APP_ID` | OAuth client/application identifier | Build-time client value |
| `OAUTH_SERVER_URL` | Manus OAuth server base URL | No |
| `BUILT_IN_FORGE_API_URL` | Forge API base URL for storage and AI | No |
| `BUILT_IN_FORGE_API_KEY` | Forge API credential for storage and AI | No |
| `OWNER_OPEN_ID` / `OWNER_NAME` | Optional project-owner metadata supplied by the managed environment | No |
| `PORT` | Optional server port; defaults to `3000` | No |

`VITE_*` values are embedded during the frontend build. Never place server credentials, database URLs, JWT secrets, or Forge API keys in a `VITE_*` variable.

## Development commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Run Express with the Vite development server. |
| `pnpm check` | Run the TypeScript type check. |
| `pnpm test` | Run the complete Vitest suite. |
| `pnpm build` | Build the Vite client and bundle the Node server to `dist/`. |
| `pnpm build:vercel` | Build the Vite client into `public/` for the committed Vercel server adapter. |
| `pnpm start` | Run `dist/index.js` in production mode. |
| `pnpm drizzle-kit generate` | Generate a schema migration after editing `drizzle/schema.ts`. |
| `pnpm drizzle-kit migrate` | Apply generated Drizzle migrations. |

## Quality and safety requirements

Run the full validation sequence before proposing a release:

```bash
pnpm check
pnpm test
pnpm build
```

The project’s data rules are intentional:

- **All application data is owner-scoped.** Protected tRPC procedures use the authenticated user context and database helpers scope reads/writes to that owner.
- **Receipt, warranty, and return business dates are date-only values.** Do not introduce UTC timestamp conversion for these facts.
- **OCR and AI may assist, but do not create evidence.** Unsupported values must remain empty or explicitly review-needed.
- **Files are stored in object storage, not database blobs or local disk.** Only metadata is stored in the database.
- **AI calls run server-side.** Browser code must not receive an AI or Forge secret.
- **Deletion is explicit.** Document removal requires confirmation; account deletion is not presented as available unless a complete, safe identity-and-data deletion workflow exists.

## Architecture and operational documentation

- [Architecture](docs/ARCHITECTURE.md) explains the request flow, data model, security boundaries, and feature services.
- [Deployment](docs/DEPLOYMENT.md) explains managed deployment, Docker use, required services, the Vercel adapter, and the remaining portability decisions needed for an external host.

## Troubleshooting

| Symptom | Check first |
|---|---|
| OAuth callback fails | Confirm the configured callback URL includes `/api/oauth/callback`, the OAuth app accepts the exact HTTPS origin, and `VITE_APP_ID`/`OAUTH_SERVER_URL` are correct. |
| API calls return an unauthenticated error | Sign in again; verify the session cookie’s HTTPS configuration and same-origin deployment. |
| Uploads or document views fail | Verify Forge storage variables are available server-side and the storage proxy route is reachable. |
| OCR lacks text or PDF processing fails | Confirm Tesseract, English language data, and Poppler are installed in the runtime image. |
| The assistant cannot respond | Verify the server-only Forge API configuration; do not expose or substitute client-side secrets. |
| Migration fails | Verify `DATABASE_URL`, inspect the generated SQL, and check whether the schema was partially applied before retrying. |

## Contributing

Use a focused branch and retain existing behavior unless a task explicitly changes it. Keep schema changes additive whenever possible, include owner-isolation tests for protected data paths, and update the relevant documentation with any change to runtime requirements, security boundaries, or deployment assumptions.

## License

This repository currently declares the **MIT** license in `package.json`. Add a standalone `LICENSE` file before distributing the code under that license.
