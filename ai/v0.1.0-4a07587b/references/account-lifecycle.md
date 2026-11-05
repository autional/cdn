<!-- generated: core@23aef5aa3d26 · region: cn · lang: zh — do not edit directly -->

# 账号生命周期：加入、绑定、找回

> Autional 接入 Skill 的引用文件。
> 当应用有自己的用户表时，用它决定：
> 何时创建账号、如何合并身份、用户如何找回。

## 加入确认（首次 SSO 登录）

```
IdP 授权成功 → (issuer, subject)
  ├── 已绑定 → 直接登录
  └── 未绑定 → 显示「加入 <应用>？」（默认勾选）
        ├── 加入   → 创建 app_user + 绑定 → 登录
        └── 暂不加入 → 不创建账号；尽量保留 IdP 会话
```

规则：

- 放在授权**之后**：只有那时才拿到可信的 `(issuer, subject)`。
- 如需产品分析，记录 `join_declined`；不要创建账号行。
- 幂等：`unique(provider, issuer, subject)`；`on conflict do nothing` 后再读一次。
- 加入确认是 UX，不是安全边界：服务端仍要决定账号是否存在，并强制 owner 校验。
- 拒绝时清本地应用会话，**不要**调 OP 的 logout 端点，这样 IdP 会话可以保留；**不要**调 SDK 的 `logout()`——它会结束 OP 会话。

## 绑定（不按邮箱自动合并）

- 永远不要因为两个身份共用邮箱就合并账号；邮箱可能未验证。
- 只在用户**已登录应用**时绑定：设置 → 绑定 → IdP 授权。
- 该身份已绑定到别的 `app_user` → 拒绝。
- 拒绝解绑最后一个登录方式。

## 数据模型

```sql
create table app_users (
  id text primary key,
  tenant_id text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table external_identities (
  id text primary key,
  app_user_id text not null references app_users(id) on delete cascade,
  provider text not null,
  issuer text not null,
  subject text not null,
  email text,
  email_verified boolean not null default false,
  linked_at timestamptz not null default now(),
  unique (provider, issuer, subject)
);

create table recovery_codes (
  id text primary key,
  app_user_id text not null references app_users(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table mfa_factors (
  id text primary key,
  app_user_id text not null references app_users(id) on delete cascade,
  type text not null,                -- 'totp'
  secret_enc text not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
```

业务表引用 `app_users.id`；不要用邮箱，也不要用 IdP subject。

## TOTP 与找回

- TOTP 是**第二因素**，不是找回通道。
- 只有在已有恢复码（或已验证邮箱）后才允许启用。
- 启用时：密钥只显示一次 → 验证一次验证码 → 生成 10 个一次性恢复码（只显示一次）。
- 丢失 authenticator：用恢复码登录 → 关闭 TOTP → 重新绑定。
- SSO 用户在 IdP 找回；应用不重置 SSO 密码。
- 应用不需要独立 MFA 时，优先用 Autional 账号自身的 MFA。

## 决策记录

复制到 `AUTIONAL_SETUP.md`：

```
加入确认：是/否（默认勾选）
身份键：(provider, issuer, subject)
账号合并：仅显式绑定（不按邮箱自动合并）
找回：恢复码 / 可选邮箱 / 管理员 / 不支持
TOTP：默认关闭；启用前必须有恢复码
```
