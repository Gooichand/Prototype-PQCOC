# Local-only source package

This source package can be run locally for development and presentation. It is **not published** by this package. It contains no production credentials, recovered evidence, or uploaded artifact bytes.

## Quick start

Install Node.js 22 or later and pnpm. From the extracted project directory, run the following commands.

```bash
pnpm install
pnpm dev
```

The development server prints a localhost URL (typically `http://localhost:3000`). For quality checks, run `pnpm test`, `pnpm check`, and `pnpm build`.

## Port configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Express server listening port (override with `PORT=4000 pnpm dev`) |
| `NODE_ENV` | `development` | Set automatically by `cross-env` in the dev/start scripts |

The Vite dev server proxy and the Express server both bind to the same port. When running behind a reverse proxy, set `X-Forwarded-Proto` and `X-Forwarded-Host` headers so that server-side `resolveStorageReadUrl()` resolves relative storage paths to the correct origin.

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Set automatically by `cross-env` |
| `JWT_SECRET` | No | (empty) | Session cookie secret for optional OAuth flow |
| `DATABASE_URL` | No | (empty) | MySQL/TiDB connection string; when absent, in-memory store is used |
| `BUILT_IN_FORGE_API_URL` | No | (empty) | Object-storage API URL; when absent, in-memory artifact store is used |
| `BUILT_IN_FORGE_API_KEY` | No | (empty) | Object-storage API key |
| `VITE_APP_ID` | No | (empty) | OAuth application ID for optional login flow |

Create a `.env` file in the project root for local development. Example:

```
NODE_ENV=development
JWT_SECRET=local-dev-secret-not-for-production
```

Do not commit the `.env` file to version control.

## Local storage behavior

When `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY` are not configured, the application uses an **in-memory artifact store**. Uploaded evidence bytes are held in process memory and served through the local Express storage proxy at `/manus-storage/*`. This is suitable for development and demonstration only — artifacts are lost when the server restarts.

Server-side verification resolves storage paths to absolute URLs using the request origin (`req.headers.host` and `req.protocol`), so that Node.js `fetch()` always receives a fully qualified URL. This means:

- `storageGetSignedUrl()` returns a relative path (`/manus-storage/...`) in in-memory mode.
- `resolveStorageReadUrl()` resolves that path against the incoming request origin.
- No server-side `fetch()` call ever receives a bare relative URL.

When Forge/S3 storage is configured, `storageGetSignedUrl()` returns the full presigned S3 URL directly, and verification fetches from the external object store.

## Configuration boundary

The original project runs on a managed full-stack template. Its database, object storage, and OAuth configuration are injected by that environment; the archive deliberately does not include those credentials. The supplied `server/storage.ts` uses a managed storage proxy for permitted evidence copies.

| Capability | Managed local preview | Fully self-hosted local installation |
|---|---|---|
| Interface and test suite | Available after dependency installation | Available after dependency installation |
| Cryptographic helpers | Available in the Node runtime | Available in the Node runtime |
| Persistent metadata | Managed database configuration is supplied | Configure a compatible MySQL/TiDB `DATABASE_URL` and apply the reviewed Drizzle migrations |
| Permitted file/image storage | Managed object storage configuration is supplied | Replace or adapt `server/storage.ts` to an S3-compatible or MinIO adapter and configure credentials outside source control |
| OAuth session flow | Managed OAuth configuration is supplied | Configure a compatible OAuth service or adapt the authentication layer for the intended local environment |
| Role-based access control | In-memory demo mode: all roles accessible | Configure user authentication with `forensicRole` field on user records |

## In-memory mode

When `DATABASE_URL` and `BUILT_IN_FORGE_API_URL` are not set, the application operates entirely in-memory:

- **Database**: All cases, evidence, custody events, verification runs, and benchmarks are stored in process memory. Data is lost on server restart.
- **Storage**: Artifact bytes are held in memory and served through the local Express storage proxy at `/manus-storage/*`.
- **Authentication**: No user authentication is required. All tRPC procedures are accessible regardless of role guards.

This is suitable for development, testing, and presentation demonstrations only.

Do not add live secrets to the archive, source files, or version control. A developer who needs a truly self-contained offline prototype should make a separate, reviewed implementation change that replaces the managed database, storage, and OAuth dependencies with local equivalents; that work is intentionally not represented as complete in this package.

## Permitted-image safeguards

The Evidence Vault accepts only authorised, non-sensitive copies of JPEG, PNG, WebP, or GIF images below 2 MB. It checks declared image types against byte signatures before registration, computes SHA-256 and SHA3-256 values, stores bytes outside the database through the configured storage layer, and provides a visual preview only for identification. The visual preview is not a substitute for the hashes, event signature, or custody-chain verification.

Do not upload seized material, personal data, confidential information, or any artifact for which you lack explicit authority.

## Troubleshooting

### `pnpm dev` starts but the browser shows a blank page

Ensure `pnpm install` completed successfully. Check the terminal for Vite compilation errors. If you see `EADDRINUSE`, another process is using port 3000 — stop it or set `PORT=4000 pnpm dev`.

### Verification fails with "Stored evidence artifact could not be read"

This usually means the server-side `fetch()` received a relative URL. Ensure the server is running on `localhost` (not a custom domain) so that `resolveStorageReadUrl()` can resolve relative `/manus-storage/...` paths. The server derives the origin from `req.headers.host` and `req.protocol`.

### `pnpm test` fails after code changes

Run `pnpm check` to identify TypeScript errors first. Then run `pnpm test` and review the failing test output. Common causes: changed function signatures, missing mock implementations, or altered return types.

### Image upload is rejected with "image bytes do not match"

The server validates image magic bytes against the declared content type. Ensure the file is a genuine JPEG, PNG, WebP, or GIF (not a renamed file). SVG files are intentionally excluded.

### Build fails with missing environment variables

The Vite build may warn about missing `VITE_ANALYTICS_*` variables. These are non-critical and do not affect the build output. All other required variables have defaults.
