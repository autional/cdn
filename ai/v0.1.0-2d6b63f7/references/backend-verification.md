<!-- generated: core@1229279235b2 · region: cn · lang: zh — do not edit directly -->

# 服务端请求认证

> Autional 接入 Skill 的引用文件。
> 服务端保存用户数据时阅读。
> 前端守卫只改善体验；本文件定义安全边界。

## 契约

**服务端**

1. 读取 `Authorization: Bearer <token>`。
2. 解码 `exp`；过期直接拒绝，不打网络。
3. 用 `GET https://api.autional.cn/bff/identity/api/v1/auth/me` 校验 → `{ data: { id } }`（或 `userinfo` → `sub`）。高流量资源服务可改用 `@autional/node` `verify: 'jwks'`（可选、有条件——见下）。
4. owner key：应用自己的 user id（经 `external_identities` 关联），没有用户表时用 `data.id`。**不要用邮箱**。
5. 无效/过期 → 401 · `entry_plane`/claims 不匹配 → 403（不刷新）· 5xx → 503。
6. 正结果缓存 ≤60 秒；登出/删号时清缓存。

**客户端**

401 时刷新一次（单飞 + Web Lock）并重试；403 不重试。

## JWKS 验签（可选、有条件）

自 2026-11-07 起 access token 带 `kid`，`https://api.autional.cn/.well-known/jwks.json` 也发布签名公钥。
因此 JWKS **可用**——但它是**可选的高性能路径**，不是默认。默认仍是 `userinfo`；
`introspect` 与 `/me` 仍是撤销判断的权威来源。

需要本地验签时用 `@autional/node` 的 `verify: 'jwks'`（≥0.5）：本地 RS256 验签 +
`/.well-known/jwt-status.json` 撤销检查。必须配 `appId`（audience）并保留 `issuer`；
JWKS/status 挂在 API **origin** 根（`/bff` 前缀会被剥离）。换钥在服务端完成（平台 `reload`），
客户端无需重新部署——未知 `kid` 会触发重取。

自研验签必须**同时**满足：

1. `alg` 白名单 = `RS256`（拒绝 `none`；拒绝用公钥跑 HS256）。
2. 按 `kid` 从固定 JWKS URL 选键；未知 `kid` → 强制重取一次（限频），仍失败则拒绝。
   无 `kid` 的 token 仅在 status 文档允许的窗口内接受。
3. `type === 'access'`（拒绝 id_token / refresh_token 混淆）。
4. `iss` ∈ 来自 discovery 的显式白名单；`aud` 包含你的 app id；header `typ` ∈
   {`JWT`, `at+jwt`}；`exp` 有效（`nbf` 允许小 skew）。
5. 缓存密钥集（≤5 分钟）与验证结果（≤15 秒）；缓存不得跨 issuer/app 复用。
   不信任 `jku` / `x5u` / 内嵌密钥，不硬编码公钥。

敏感操作（删号、改密/凭证、管理或支付动作）仍必须每次请求走 `/me` 或 introspect——
本地验签看不到 token/session 的即时撤销。

不要写死 `iss`：它会随区域/流程变化（SAML 统一到 identity-service）。从 discovery 或区域配置取值
并校验，不要套用另一个区域的值。

**撤销 SLO**：内部验签方 ≤60 秒；官方 SDK 最坏约 55 秒（oauth keyset 30 秒 + jwt-status 10 秒 +
结果缓存 15 秒）；外部应用由自身缓存决定——敏感路径要把缓存压短。

## Owner key

- 应用有自己的用户表：owner 是 `app_user.id`；把 `(issuer, subject)` 映射到 `external_identities.app_user_id`。
- 没有用户表：owner 是 `data.id`（或 `sub`）。
- **不要用邮箱**做 owner key。

## Next.js（App Router）

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

使用 `@autional/node` 时，中间件默认会校验：

- `verify: 'userinfo'`（默认）——调 OAuth userinfo；最简单也最稳；
- `verify: 'introspect'`——需要 `clientId` / `clientSecret`，可拿到 scope；
- `verify: 'jwks'`——本地 RS256 验签 + `jwt-status` 撤销检查；高流量资源服务的可选路径
  （配 `appId` / `issuer`；未知 `kid` 会自动重取）；
- `verify: 'decode-only'`——仅本地调试；注入的 user 会标记 `verified: false`。

保护路由不要开 `decode-only`——它不是安全边界。读请求用 `jwks` 时，敏感操作仍走 `/me` 或 introspect。

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
- 撤销 SLO 按验签路径分列：内部验签方 ≤60 秒；官方 SDK（`jwks`）最坏约 55 秒（oauth keyset 30 秒 + jwt-status 10 秒 + 结果缓存 15 秒）；外部应用由自身缓存决定。敏感路由要把缓存压短。
- `jwks` 模式另有自己的缓存：密钥集（默认 5 分钟，未知 `kid` 会重取）与 jwt-status（10 秒）；敏感路由不要调大。
