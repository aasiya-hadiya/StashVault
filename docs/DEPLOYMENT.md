# StashVault deployment guide

## Supported production target

The current application is deployed in the managed StashVault environment. This is the supported target because it already supplies compatible OAuth, database, Forge storage, Forge AI, secret management, containerized OCR dependencies, HTTPS, and the Express runtime.

Before any release, run:

```bash
pnpm check
pnpm test
pnpm build
```

The production server starts with:

```bash
NODE_ENV=production pnpm start
```

It serves the compiled React build from `dist/public` and mounts OAuth, storage, and tRPC endpoints from the same Express process.

## Container deployment

The repository includes a Dockerfile intended for a Node 22 runtime. It installs:

- `poppler-utils` for PDF-related processing;
- `tesseract-ocr` and English language data for receipt OCR;
- application dependencies through pnpm; and
- the compiled Express/Vite application.

Build and run only in an environment where you have a complete, approved configuration for the required services:

```bash
docker build -t stashvault .
docker run --rm -p 3000:3000 --env-file .env stashvault
```

Do not bake `.env` files, database credentials, JWT secrets, Forge credentials, or OAuth secrets into the image.

## Required production configuration

| Requirement | Why it is needed |
|---|---|
| Node 22-capable application runtime | Runs the Express application and built server bundle. |
| MySQL/TiDB-compatible database | Stores user, product, document, reminder, and preference metadata. |
| HTTPS origin | Required for secure session cookies and OAuth callbacks. |
| OAuth application with exact callback URL | The callback is `${PUBLIC_ORIGIN}/api/oauth/callback`. |
| Stable `JWT_SECRET` | Verifies application session cookies across requests and restarts. |
| Server-side object storage integration | Retains uploaded receipts/documents outside the process filesystem. |
| Server-side AI provider configuration | Required only for Ask StashVault; never expose it to the browser. |
| OCR/PDF binaries | Required for the existing local receipt-OCR processing path. |

## Database migrations

Schema changes are managed with Drizzle.

1. Update `drizzle/schema.ts`.
2. Run `pnpm drizzle-kit generate`.
3. Review the generated SQL migration carefully.
4. Apply it to a staging database first, then an approved production database.
5. Run the test/build gates and verify the migration version.

Treat production databases as stateful systems. Avoid destructive changes, run backups appropriate to your database provider, and retain a rollback strategy before altering existing columns or relationships.

## External hosting: Vercel and Netlify

### Vercel adapter status

The repository now includes a **Vercel-specific Node server adapter** that prevents the deployed site from serving the compiled Express bundle as page text. `server.ts` is a Vercel-recognized Node server entrypoint, `build:vercel` emits the Vite application to `public/`, and `vercel.json` includes that directory with the function. This preserves the existing Express routes for `/api/trpc`, `/api/oauth/callback`, and the storage proxy while serving the React application and its SPA routes.

This fixes the reported **server-source-code response**. It does not make the managed OAuth, database, storage, AI, or OCR services portable by itself. Vercel must receive independently approved equivalents before the complete product can operate there.

### Recover the current Vercel deployment

1. Pull the repository revision that contains `server.ts`, `vercel.json`, and the `build:vercel` script.
2. In Vercel, set the project root to the repository root and use **Node.js 22.x**.
3. Remove any manual output-directory override that points to `dist`, `dist/index.js`, or the server bundle. The committed `vercel.json` supplies the correct `buildCommand` and `public` output directory.
4. Redeploy from the new commit. The root URL should now return the React `index.html`, not JavaScript/TypeScript server source.
5. Inspect the Vercel deployment logs. A missing external environment variable or unsupported OCR binary is a separate runtime issue and should not be papered over with a client-side fallback.

> Do not add Manus-managed Forge credentials to Vercel. Those values are scoped to the existing managed environment and are not a portable secret bundle.

### What must change before an external deployment

| Current dependency | Why a direct import is insufficient | Required migration decision |
|---|---|---|
| Express routing | Vercel would otherwise treat the project output as static content or an unrecognized bundle. | The committed `server.ts`/`vercel.json` adapter covers routing and SPA asset delivery; retain it when deploying to Vercel. |
| Tesseract and Poppler binaries | Standard serverless builds do not automatically include these system packages. | Move OCR to a managed OCR service/worker or use a platform that supports the supplied Docker image. |
| Manus OAuth | The callback flow relies on the current OAuth application and authorized callback origin. | Register/configure an external callback origin or replace the identity provider. |
| Forge object storage | Document handling relies on server-side Forge storage credentials and proxy endpoints. | Confirm sanctioned external use or replace it with a provider-managed object store. |
| Forge AI gateway | Ask StashVault uses a server-side managed gateway. | Confirm sanctioned external use or integrate a separate server-side AI provider. |
| Database | The managed database URL is not a transferable default. | Provision an external MySQL-compatible database and run reviewed migrations. |

### Recommended external-hosting decision

For the application **as it exists today**, a Docker-capable Node host remains the lowest-risk external route because the supplied Dockerfile already captures the OCR/PDF system dependencies. Vercel can now serve the client and existing Express routes using the committed adapter, but complete production use still requires the external-service decisions described above.

For a complete Vercel deployment, first confirm:

1. an external MySQL/TiDB-compatible `DATABASE_URL` is available and reviewed migrations have been applied;
2. a stable, newly generated `JWT_SECRET` is set only in Vercel's encrypted environment-variable settings;
3. the identity provider permits `https://<your-domain>/api/oauth/callback` as an exact callback URL and corresponding public client configuration is supplied;
4. document storage and AI have an approved external provider or other sanctioned portable configuration; and
5. OCR will move to a suitable service/worker or the platform supports the required binaries.

Do not copy internal managed-service secrets into Vercel or Netlify environment variables. The existing values are scoped to the supported environment and are not a portable external deployment contract.

## Post-deployment acceptance checks

After an approved deployment, verify the following over HTTPS:

1. The landing page and client routes load after a refresh.
2. OAuth sign-in and callback return to the app correctly.
3. A signed-in user can see only their own product/document records.
4. A test document uploads, views, downloads, and deletes only after confirmation.
5. Receipt OCR has its expected runtime dependencies and presents review fields.
6. Warranty/return alerts and Settings preferences persist correctly.
7. Ask StashVault handles a safe stored-data question without exposing a server secret.
8. `pnpm check`, `pnpm test`, and `pnpm build` remain green for the deployed revision.
