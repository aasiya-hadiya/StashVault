# Environment configuration

## Handling rule

Configuration values are environment secrets, not repository content. Create them through your deployment platform or a local secret-management workflow. Do not commit `.env`, API keys, database URLs, JWT secrets, OAuth secrets, or provider tokens.

## Required variables

| Variable | Used by | Notes |
|---|---|---|
| `NODE_ENV` | Server | Use `development` locally and `production` in a deployed runtime. |
| `PORT` | Server | Optional; the server defaults to `3000` and honors a provider-supplied port. |
| `DATABASE_URL` | Drizzle/database helpers | MySQL/TiDB-compatible connection string. Keep it server-side. |
| `JWT_SECRET` | Session infrastructure | A stable, high-entropy secret used to sign and verify application session cookies. Keep it server-side. |
| `VITE_APP_ID` | OAuth client configuration | Public OAuth application identifier embedded at build time. It is not a secret, but must match the configured OAuth application. |
| `OAUTH_SERVER_URL` | OAuth SDK | Server-side Manus OAuth server URL. |
| `BUILT_IN_FORGE_API_URL` | Storage and AI services | Server-side Forge API base URL. |
| `BUILT_IN_FORGE_API_KEY` | Storage and AI services | Server-side Forge API credential. Never prefix it with `VITE_`. |
| `OWNER_OPEN_ID` | Managed runtime metadata | Optional owner identifier supplied by the managed environment. |
| `OWNER_NAME` | Managed runtime metadata | Optional owner display metadata supplied by the managed environment. |

## Local development procedure

1. Use an approved local secret-management mechanism to supply the variables above to `pnpm dev`.
2. Confirm that `DATABASE_URL` points to a non-production development database.
3. Confirm that the OAuth configuration permits your local callback origin if you intend to test sign-in.
4. Run `pnpm check`, `pnpm test`, and `pnpm build` before sharing a change.

## Deployment procedure

Set the values in the deployment platform’s encrypted environment-variable interface. Configure them separately for preview/staging and production environments. Ensure the selected runtime uses the exact HTTPS OAuth callback URL:

```text
https://YOUR-PUBLIC-ORIGIN/api/oauth/callback
```

Never transfer internal managed-environment credentials to a third-party host without explicit approval and confirmed portability. An external deployment requires a supported identity, storage, AI, and database plan as described in [Deployment](DEPLOYMENT.md).
