<!-- generated: core@240ebfa3cf0e · region: cn · lang: zh — do not edit directly -->

# 配置模板参考

> Autional 接入 Skill 的引用文件。
> `{花括号}` 字段按项目填写；其余内容已按 region 填好。

## src/autional.ts（React 示例）

```ts
/**
 * Autional 配置 — 由 Autional 接入流程生成
 * 日期: {DATE}
 * 框架: {FRAMEWORK}
 */

import { AutionalProvider, useAutional, RequireAuth } from '@autional/react';

export const autionalConfig = {
  appId: '{APP_ID}',
  issuer: 'https://api.autional.cn',
  apiUrl: 'https://api.autional.cn',
  syncTabs: true,
};

export { AutionalProvider, useAutional, RequireAuth };
```

Vue：`import { createAutional } from '@autional/vue'` → `app.use(createAutional(autionalConfig))`。
Next.js：在根 layout 用 `@autional/next` 的 Provider 包裹，并用其 middleware 保护路由。

## .env（公开——可提交 git）

```env
# Autional — 公开配置（可提交 git）
AUTIONAL_APP_ID={APP_ID}
AUTIONAL_ISSUER=https://api.autional.cn
AUTIONAL_API_URL=https://api.autional.cn
```

按框架使用公开前缀：`VITE_`（Vite）、`NEXT_PUBLIC_`（Next.js）、`REACT_APP_`（CRA）；Node 无需前缀。

## .env.local（私密——绝不提交）

```env
# Autional — 私密备注（已自动 gitignore）
# 创建日期: {DATE}
# 管理员邮箱: {ADMIN_EMAIL}
# 管理员密码: 单独保存，不在此文件
```

## AUTIONAL_SETUP.md 模板

```markdown
# Autional 接入配置 — {PROJECT_NAME}

## 基本信息
- 接入日期: {DATE}
- 框架: {FRAMEWORK}
- 租户: {TENANT_NAME}
- Region: .cn
- 环境: {ENVIRONMENT}

## 配置信息
- App ID: {APP_ID}
- Issuer: https://api.autional.cn
- API URL: https://api.autional.cn
- 管理员: {ADMIN_EMAIL}

## 安全策略
- 密码传输: {PASSWORD_TRANSMISSION}
- 最小长度: {MIN_LENGTH}
- 要求: {REQUIREMENTS}
- MFA: {MFA_STATUS}
- 泄露密码检查: {BREACHED_CHECK_STATUS}

## 测试账号
| 账号 | 密码 | 角色 |
|---|---|---|
| {TEST1_EMAIL} | {TEST1_PASSWORD} | 测试用户 1 |
| {TEST2_EMAIL} | {TEST2_PASSWORD} | 测试用户 2 |
| {TEST3_EMAIL} | {TEST3_PASSWORD} | 测试用户 3 |

> 测试密码仅显示一次；后续可在管理后台重置。

## 门户
| Portal | 地址 | 用途 |
|---|---|---|
| 管理后台 | https://admin.autional.cn | 用户/角色/安全策略/审计日志 |
| 用户门户 | https://user.autional.cn | 修改密码/设备/MFA |
| 安全仪表盘 | https://security.autional.cn | 异常检测/登录趋势 |
| 开发者门户 | https://developer.autional.cn | API 文档/OAuth 客户端/应用设置 |
| 系统状态 | https://status.autional.cn | 服务运行状况 |

## 提醒
1. 管理员密码单独保存（不在此文件）
2. .env.local 已 gitignore
3. 升级后到开发者门户查看新增安全能力
```

> 备份通道：若上方 `.cn` 链接在大陆网络不可达，使用镜像 https://cdn.autional.cn/ai/latest/SKILL.md。
