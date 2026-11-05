<!-- generated: core@1ad71c67fc69 · region: com · lang: en — do not edit directly -->

# Backend request verification

> Reference file for the Autional Onboarding skill.
> Read it when the app stores user data on a server.
> A front-end guard is UX; this file defines the security boundary.

## Contract

**Server**

1. Read `Authorization: Bearer <token>`.
2. Decode `exp`; reject expired tokens without a network call.
3. Validate with `GET https://api.autional.com/bff/identity/api/v1/auth/me` → `{ data: { id } }` (or `userinfo` → `sub`).
4. Owner key: the app's own user id (linked via `external_identities`), or `data.id` when there is no user table. Never email.
5. Invalid/expired → 401 · `entry_plane`/claims mismatch → 403 (do not refresh) · 5xx → 503.
6. Cache positive results ≤60s; clear on logout/delete.

**Client**

On 401 refresh once (single-flight, Web Lock) and retry; on 403 do not retry.

## Why not JWKS

Access tokens have no `kid`, and their signing key is not the one published at
`https://api.autional.com/.well-known/jwks.json` (that key serves id_tokens).
JWKS verification therefore fails for real access tokens.
RS256 key distribution is still pending; until it ships, the supported server-side
paths are `/me`, `userinfo`, or `introspect`.

Do not hard-code `iss`: it varies by flow (SAML uses the SP EntityID).
Validate through `/me` or `userinfo` instead.

## Owner key

- App has its own user table: `app_user.id` is the owner; map `(issuer, subject)` → `external_identities.app_user_id`.
- No user table: `data.id` (or `sub`) is the owner.
- Never use email as the owner key.

## Next.js (App Router)

```ts
// lib/server/caller.ts
import { decodeJwt } from "jose";

const ME = `${process.env.AUTIONAL_API_URL}/identity/api/v1/auth/me`;
const cache = new Map<string, { id: string; exp: number }>();

export async function requireCaller(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Response("unauthorized", { status: 401 });

  const { exp = 0, sub } = decodeJwt(token);
  if (exp * 1000 < Date.now()) throw new Response("expired", { status: 401 });

  const hit = cache.get(token);
  if (hit && hit.exp > Date.now()) return hit.id;

  const res = await fetch(ME, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(3000),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Response("unauthorized", { status: 401 });
  }
  if (!res.ok) throw new Response("auth unavailable", { status: 503 });

  const body = await res.json();
  const id = body?.data?.id;
  if (!id) throw new Response("unauthorized", { status: 401 });
  // /me returns the same subject as `sub`; a mismatch means schema drift.
  if (sub && sub !== id) throw new Response("unauthorized", { status: 401 });

  if (cache.size >= 500) cache.delete(cache.keys().next().value!);
  cache.set(token, { id, exp: Date.now() + 60_000 });
  return id;
}

/** Call on logout / account deletion. */
export function clearCallerCache() {
  cache.clear();
}
```

> `jose` is only used to decode `exp`. To avoid the dependency, decode the payload with `Buffer.from(token.split(".")[1], "base64url")`.

## Express

```ts
app.use(async (req, res, next) => {
  try {
    req.userId = await requireCaller(req);
    next();
  } catch {
    res.status(401).json({ error: "unauthorized" });
  }
});
```

## Node SDK

If you use `@autional/node`, the middleware verifies by default:

- `verify: 'userinfo'` (default) — calls the OAuth userinfo endpoint;
- `verify: 'introspect'` — requires `clientId` / `clientSecret`, returns scope;
- `verify: 'decode-only'` — local debugging only; the injected user is marked `verified: false`.

Do not enable `decode-only` on protected routes.

## `useCookie` / BFF

`useCookie` only disables local persistence. The SDK does not send credentials
and does not read tokens from cookies. A BFF must:

1. keep the token server-side and set an httpOnly cookie;
2. expose an endpoint that returns the access token (or calls Autional on behalf of the browser);
3. call `setTokens()` after a reload, or proxy the API itself.

Without this, a page refresh logs the user out.

## Cache

- Positive results only; TTL ≤60s.
- Bound the map (e.g. 500 entries) to avoid unbounded growth in long-lived processes.
- Clear on logout and account deletion; do not wait for the TTL.
- Serverless instances each keep their own cache; a logout on one instance does not clear the others, so keep the TTL short.
- Revocation and logout can therefore lag up to 60s. For immediate revocation, query `/me` on every request or use Redis-backed introspection.
