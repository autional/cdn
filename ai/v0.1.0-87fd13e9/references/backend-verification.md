<!-- generated: core@1229279235b2 · region: com · lang: en — do not edit directly -->

# Backend request verification

> Reference file for the Autional Onboarding skill.
> Read it when the app stores user data on a server.
> A front-end guard is UX; this file defines the security boundary.

## Contract

**Server**

1. Read `Authorization: Bearer <token>`.
2. Decode `exp`; reject expired tokens without a network call.
3. Validate with `GET https://api.autional.com/bff/identity/api/v1/auth/me` → `{ data: { id } }` (or `userinfo` → `sub`). High-traffic resource servers may instead use `@autional/node` `verify: 'jwks'` (optional, conditional — see below).
4. Owner key: the app's own user id (linked via `external_identities`), or `data.id` when there is no user table. Never email.
5. Invalid/expired → 401 · `entry_plane`/claims mismatch → 403 (do not refresh) · 5xx → 503.
6. Cache positive results ≤60s; clear on logout/delete.

**Client**

On 401 refresh once (single-flight, Web Lock) and retry; on 403 do not retry.

## JWKS verification (optional, conditional)

Since 2026-11-07 access tokens carry `kid`, and `https://api.autional.com/.well-known/jwks.json` publishes
the signing keys. JWKS is therefore usable — as an **optional high-performance path**, not the
default. The default stays `userinfo`; `introspect` and `/me` remain authoritative for revocation.

Use `@autional/node` `verify: 'jwks'` (≥0.5) if you need local verification: it does RS256
verification plus a `/.well-known/jwt-status.json` revocation check. Pass `appId` (audience) and
keep `issuer`; the JWKS/status URLs hang off the API **origin** (`/bff` prefixes are stripped).
Key rotation is server-side (platform `reload`); clients need no redeploy — an unknown `kid`
triggers a refetch.

If you verify JWTs yourself, enforce **all** of:

1. `alg` allowlist = `RS256` (never `none`; never HS256 with a public key).
2. Select the key by `kid` from the fixed JWKS URL; an unknown `kid` → refetch once (rate-limited),
   then fail closed. Tokens without `kid` are only acceptable while the status document allows it.
3. `type === 'access'` (reject id_token / refresh_token confusion).
4. `iss` ∈ an explicit allowlist taken from discovery; `aud` contains your app id; header `typ` ∈
   {`JWT`, `at+jwt`}; `exp` valid (and `nbf` with small skew).
5. Cache the key set (≤5 min) and verification results (≤15 s); never share a cache across
   issuers/apps. Do not trust `jku` / `x5u` / embedded keys, and never hard-code a public key.

Sensitive operations (account deletion, password/credential change, admin or payment actions) must
still call `/me` or introspect on every request — local verification cannot see a token/session
revocation immediately.

Do not hard-code `iss`: it can vary by region/flow (SAML unifies to identity-service). Take it from
discovery or the region config and validate it, instead of assuming another region's value.

**Revocation SLO**: internal verifiers ≤60 s; official SDK worst case ≈55 s (oauth keyset 30 s +
jwt-status 10 s + result cache 15 s); external apps are bounded by their own cache — keep it short
for sensitive paths.

## Owner key

- App has its own user table: `app_user.id` is the owner; map `(issuer, subject)` → `external_identities.app_user_id`.
- No user table: `data.id` (or `sub`) is the owner.
- Never use email as the owner key.

## Next.js (App Router)

```ts
// lib/server/caller.ts
import { decodeJwt } from "jose";
import { createHash } from "node:crypto";

const ME = `${process.env.AUTIONAL_API_URL}/identity/api/v1/auth/me`;
const cache = new Map<string, { id: string; exp: number }>();
const cacheKey = (token: string) => createHash("sha256").update(token).digest("hex").slice(0, 16);

export async function requireCaller(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Response("unauthorized", { status: 401 });

  const { exp = 0, sub } = decodeJwt(token);
  if (exp * 1000 < Date.now()) throw new Response("expired", { status: 401 });

  const key = cacheKey(token);
  const hit = cache.get(key);
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
  cache.set(key, { id, exp: Date.now() + 60_000 });
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
  } catch (err) {
    if (err instanceof Response) {
      const status = err.status === 503 ? 503 : 401;
      res.status(status).json({ error: status === 503 ? "auth unavailable" : "unauthorized" });
      return;
    }
    res.status(500).json({ error: "internal error" });
  }
});
```

## Node SDK

If you use `@autional/node`, the middleware verifies by default:

- `verify: 'userinfo'` (default) — calls the OAuth userinfo endpoint; simplest and always correct;
- `verify: 'introspect'` — requires `clientId` / `clientSecret`, returns scope;
- `verify: 'jwks'` — local RS256 verification + `jwt-status` revocation check; optional path for
  high-traffic resource servers (configure `appId` / `issuer`; unknown `kid` triggers a refetch);
- `verify: 'decode-only'` — local debugging only; the injected user is marked `verified: false`.

Do not enable `decode-only` on protected routes — it is not a security boundary. Sensitive
operations stay on `/me` or `introspect` even when reads use `jwks`.

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
- Revocation SLO by verification path: internal verifiers ≤60s; official SDK (`jwks`) worst case ≈55s (oauth keyset 30s + jwt-status 10s + result cache 15s); external apps are bounded by their own cache. Keep caches short on sensitive routes.
- `jwks` mode adds its own caches: key set (default 5 min, with unknown-`kid` refetch) and jwt-status (10s); do not raise them on sensitive routes.
