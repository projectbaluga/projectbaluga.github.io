# ProjectBaluga AI Assistant — Cloudflare Worker

This API is designed for the GitHub Pages site at https://projectbaluga.github.io/.

## Free-tier architecture

- Cloudflare Workers Free hosts the API.
- Cloudflare Workers AI runs `@cf/meta/llama-3.2-1b-instruct`.
- No OpenAI API key or paid AI provider is required.
- Conversation history is held only in the visitor's page memory and sent with each request. The Worker does not write chat content to KV, D1, R2, or another database.
- A Cloudflare Rate Limiting binding provides approximate edge-local throttling (12 requests per 60 seconds per client IP). Shared networks may share this limit; it is not a strict global quota.
- Workers AI Free allocation is 10,000 Neurons/day. If the daily allocation or another limit is exceeded, inference requests fail until the quota resets. Do not enable a paid plan just to bypass this without approval.

## Deploy steps (account owner)

1. Create/sign in to a Cloudflare account and open Workers & Pages.
2. Install Wrangler locally (Node.js required): `npm install -g wrangler`.
3. From this directory, authenticate: `wrangler login`.
4. Deploy: `wrangler deploy`.
5. In Cloudflare, confirm Workers AI is enabled for the account and that the selected model is available on the Free plan.
6. Copy the deployed Worker URL (for example, `https://projectbaluga-ai-assistant.<your-subdomain>.workers.dev`).
7. In the website markup, set `data-api-url` on `#pbAssistant` to that Worker origin. Do not add account tokens or secrets to the website.
8. Deploy the GitHub Pages changes only after the Worker is deployed and the URL is configured.

## Local development

Run `wrangler dev` from this directory. The worker allows the standard localhost origins on port 8787 for local testing. The browser widget's `data-api-url` should point to the local Worker during a local-only test.

## Endpoints

- `GET /health` — health check.
- `POST /api/chat` — accepts `{ "messages": [{ "role": "user" | "assistant", "content": "..." }] }`.

## Security and privacy notes

- Only the published GitHub Pages origin and standard local Wrangler origins are accepted.
- CORS is not authentication; a public website endpoint can still be called outside a browser. Keep the rate limiter enabled, monitor usage, and review abuse if the site becomes public.
- The rate limiter is approximate and local to each Cloudflare location. IP-based throttling can affect visitors behind the same shared network.
- Input size, message count, and output token limits are bounded.
- Never request passwords, payment details, or sensitive personal information.
- Chat content is sent to Cloudflare Workers AI to generate a response. The application itself does not persist conversation history. Review Cloudflare's current data handling terms before production use.
- The assistant may make mistakes. It is instructed to rely only on the verified knowledge in `worker.js`, avoid invented prices or commitments, and direct uncertain questions to projectbaluga@gmail.com.
- Do not claim this is a fully tested production system until deployment and live browser tests are complete.

## Change the knowledge base

Edit the verified facts and behavior in the `SYSTEM_PROMPT` in `worker.js`. Keep claims aligned with the public site and approved service capabilities.
