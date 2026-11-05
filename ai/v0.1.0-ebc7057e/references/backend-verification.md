<!-- generated: core@acc04bbf46f0 · region: cn · lang: zh — do not edit directly -->

# 服务端请求认证

> Autional 接入 Skill 的引用文件。
> 服务端保存用户数据时阅读。
> 前端守卫只改善体验；本文件定义安全边界。

## 契约

**服务端**

1. 读取 `Authorization: Bearer <token>`。
2. 解码 `exp`；过期直接拒绝，不打网络。
3. 用 `GET https://api.autional.cn/bff/identity/api/v1/auth/me` 校验 → `{ data: { id } }`（或 `userinfo` → `sub`）。
4. owner key：应用自己的 user id（经 `external_identities` 关联），没有用户表时用 `data.id`。**不要用邮箱**。
5. 无效/过期 → 401 · `entry_plane`/claims 不匹配 → 403（不刷新）· 5xx → 503。
6. 正结果缓存 ≤60 秒；登出/删号时清缓存。

**客户端**

401 时刷新一次（单飞 + Web Lock）并重试；403 不重试。

## 为什么不能用 JWKS

Access token 没有 `kid`，签名密钥也不在
`https://api.autional.cn/.well-known/jwks.json`（那个密钥服务的是 id_token）。
用 JWKS 验真实 access token 会失败。
RS256 密钥分发尚未上线；在此之前，服务端可用路径是 `/me`、`userinfo` 或 `introspect`。

不要写死 `iss`：不同流程会变（SAML 用 SP EntityID）。
用 `/me` 或 `userinfo` 做校验。

## Owner key

- 应用有自己的用户表：owner 是 `app_user.id`；把 `(issuer, subject)` 映射到 `external_identities.app_user_id`。
- 没有用户表：owner 是 `data.id`（或 `sub`）。
- **不要用邮箱**做 owner key。

## Next.js（App Router）

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

使用 `@autional/node` 时，中间件默认会校验：

- `verify: 'userinfo'`（默认）——调 OAuth userinfo；
- `verify: 'introspect'`——需要 `clientId` / `clientSecret`，可拿到 scope；
- `verify: 'decode-only'`——仅本地调试；注入的 user 会标记 `verified: false`。

保护路由不要开 `decode-only`。

## `useCookie` / BFF

`useCookie` 只关闭本地持久化。SDK 不会自动携带 cookie，也不会从 cookie 读 token。BFF 必须：

1. 在服务端保存 token，并设置 httpOnly cookie；
2. 提供返回 access token 的接口（或代浏览器调 Autional）；
3. 刷新后调用 `setTokens()`，或者由 BFF 直接代理 API。

否则刷新页面就会掉线。

## 缓存

- 只缓存正结果；TTL ≤60 秒。
- 给 Map 设上限（如 500 条），避免长驻进程无限增长。
- 登出与删号时清缓存，不要等 TTL。
- Serverless 每个实例各有缓存；一个实例登出不会清其它实例，所以 TTL 要短。
- 因此撤销与登出最多滞后 60 秒。需要立即生效时，每次请求都查 `/me`，或用 Redis 支撑的 introspect。
