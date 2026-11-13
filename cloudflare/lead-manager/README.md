# ProjectBaluga Lead Manager (draft)

This is a separate Worker so the existing AI assistant and its routes remain unchanged.

## What it does

- Stores a lead in D1 only after the browser confirms FormSubmit returned `success: "true"`.
- Keeps FormSubmit email delivery as the primary notification path.
- Provides a private dashboard at `/admin` with search, status filtering, and status updates.
- Allows only the Cloudflare Access JWT whose verified email is `projectbaluga@gmail.com`.
- Uses prepared D1 statements, bounded input sizes, no-store responses, and an edge rate-limit binding.
- Does not send automatic replies or follow-up emails.

## Required Cloudflare setup (account owner)

1. Create a D1 database named `projectbaluga-leads`; replace `database_id` in `wrangler.toml`.
2. From this folder run `npx wrangler d1 execute projectbaluga-leads --remote --file=schema.sql`.
3. Deploy this Worker with `npx wrangler deploy`.
4. Add a Worker custom domain such as `admin.wiltek.cloud`. Configure Cloudflare Access to protect that hostname and allow only `projectbaluga@gmail.com`. The Worker independently verifies the Access JWT, so Access policy alone is not the only check.
5. In Worker settings configure `ACCESS_TEAM_DOMAIN` (for example `your-team.cloudflareaccess.com`) and `ACCESS_AUD` (the Access application's AUD tag). The Access issuer must be `https://<team-domain>`.
6. Add a separate custom domain/route for public intake only if desired; the site currently uses the Worker `workers.dev` URL. Keep the Access application on the admin hostname. The `/api/intake` route is intentionally public but restricted by website Origin and rate limited; Origin is not authentication.
7. Configure the rate-limit binding namespace uniquely for this account if `817264` is already in use.
8. Confirm the D1 binding and limiter are present, then test from an owner browser and an unauthenticated browser before announcing the dashboard.

## Endpoints

- `POST /api/intake` — public CORS-restricted, rate-limited lead insert. Only call after FormSubmit accepts the email.
- `GET /admin` — owner dashboard, requires Access JWT.
- `GET /api/admin/leads` — owner-only list (latest 500).
- `POST /api/admin/status` — owner-only status update.

## Deployment notes

Before launch, replace the empty `LEAD_MANAGER_INTAKE_URL` constant near the top of the website's `script.js` with the deployed public Worker URL ending in `/api/intake`. The constant is declared in `script.js`, so the website does not throw a `ReferenceError` when the Worker has not yet been deployed. While it is blank, FormSubmit email delivery remains enabled and D1 saving is intentionally skipped. Never put Access secrets or D1 credentials in website code. The Worker URL is not a secret.

The website's FormSubmit activation and email delivery should be tested separately. If FormSubmit succeeds but D1 is unavailable, the visitor is told the email was sent but the dashboard save failed; the form is not silently retried, avoiding duplicate emails.

## Security and privacy

- Dashboard access requires both Cloudflare Access and server-side JWT verification (issuer, audience, expiry, signing key, and owner email).
- Do not expose the D1 database ID as a credential; it is configuration, not a secret.
- CORS and Origin checks are defense-in-depth, not authentication. Public intake remains callable by non-browser clients; rate limiting and monitoring reduce but do not eliminate spam.
- Do not store passwords, payment details, government IDs, or confidential business records in inquiry fields.
- D1 retention/deletion must be managed by the owner. Review applicable privacy obligations and update the public privacy notice before production launch.
- No live Cloudflare deployment or browser security test is performed by this repository change.
