# autional/cdn

`cdn.autional.com` 与 `cdn.autional.cn` 的**共用内容源**（单源双域名）。**这个仓的 `ui/`、`ai/`、`demo/` 目录都是生成物，不要手工编辑。**

两个 Vercel 项目（`cdn` / `cn-cdn`）从这同一个仓部署。`ui/` 与 `demo/` 两个区域内容相同；
`ai/` 两个区域内容不同（`skills/autional-com` 与 `skills/autional-cn`），`/ai/latest.json` 由
`vercel.json` 的 host 条件 rewrite 按请求域名分流到 `ai/latest.com.json` 或 `ai/latest.cn.json`。

## 它是什么

设计系统的**运行期资产**。存在的理由只有三条，每条都对应 npm 覆盖不到的场景：

1. **Go 服务 demo 不是 Node 构建**，装不了 npm 包，只能靠 `<link href="https://cdn...">` 消费设计系统。
2. **站点图标（favicon / logo）在此之前完全没有交付通道** —— 门户各自手工放置，已经漂移。
3. **字体走同一个 URL 才能跨站命中缓存** —— 门户只下载一次，而不是每个站各下一次。

## 它不是什么

**不是构建期代码的分发通道。** `tokens/index.js`、`tailwind-preset`、`antd-theme`、React 组件
必须在构建时被 bundler 解析，CDN 的 `<script>` 语义解决不了这个问题。那些走 npm：`@autional/*`。

## `ai/` 是什么

AI skill / onboarding 分发（`text/markdown`）。唯一源 = `autional/sdk` 仓的 skills 生成器。
两个区域的 skills 内容不同，因此指针分开存放、按域名分流：

- `/ai/<version>/…` 各区域的版本目录（互不相交）。
- `/ai/latest.json` 短 TTL 指针，经 rewrite 指到本区域的版本；消费入口是 `/ai/latest/<文件>`。

### ai/ 版本号（内容指纹）

版本目录名 = `v0.1.0-<8hex>`。配方与 `autional/ui` 的 `build-cdn` 完全相同：

```js
fp = sha256(entries.map(e => e.rel + '\u0000' + 'sha384-' + sha384b64(e.bytes)).sort().join('\n')).digest('hex').slice(0, 8)
```

- `rel` = 版本目录内相对路径（正斜杠）；`bytes` = **git blob 原始字节（LF）**——不要用工作区检出字节（Windows 检出为 CRLF）。
- 两区各算各的：内容不同 → 版本号不同。
- 历史注记：首批 6 个版本号（2026-10-05）出自当时的未文档化流程，已不可复现；自 2026-10-10 起用上表配方。**旧版本号不追溯重命名**（铁律 1：目录不可变）。

## `demo/` 是什么

服务 demo 的运行时资产（`brand.css` / `brand-dark.css` / `brand-logo.svg` / `demo.js`）。
唯一源 = `autional/ui-demo` 模块的 `demokit/assets/`（26 个服务 demo 页共一份，防漂移）。
发布：在 ui-demo 对应版本打 tag 后，于该仓运行

```bash
go run ./cmd/publish-cdn -version v1.8.0 -out <cdn 仓路径>
```

它读 **git blob**（LF 原始字节）而不是工作区文件（Windows 检出为 CRLF），与 CI 构建机
`go:embed` 进二进制的字节逐字节一致。铁律同样适用：路径版本化且不可变。

## 铁律

1. **路径版本化且不可变。** `/ui/v<version>/` 下的内容是永久缓存（`max-age=31536000, immutable`）。
   内容一变就换版本号。**不要**原地改一个已发布版本的文件 —— 全世界的缓存都不会知道。
2. **跟随最新版要读 `/ui/latest.json`**（`max-age=300`）。它是唯一的可变指针。
3. **CORS 必须保持 `*`。** 跨域 `@font-face` 缺 `Access-Control-Allow-Origin` 会**静默回退**到系统字体，
   症状是「字体偶尔不对」这种极难排查的问题。`vercel.json` 里那条全局头不能删。
4. **字体要用 `crossorigin`。** `<link rel="preload" as="font" ... crossorigin>`，否则预加载会失效并重复下载。

## 怎么更新

```bash
# ui/：在 autional/ui 仓里
pnpm build:cdn            # 默认输出到 ../cdn

# ai/：在 autional/sdk 生成产物后手工上架（新增版本目录 + 更新该区域的指针与 vercel.json rewrite 目标；两区互不影响。版本号配方见「ai 版本号」节）

# demo/：在 autional/ui-demo 仓里（对应版本已打 tag）
go run ./cmd/publish-cdn -version v1.8.0 -out <cdn 仓路径>

cd ../cdn && git add -A && git commit -m "..." && git push
```

推送到 `main` 即触发两个 Vercel 项目（`cdn` / `cn-cdn`）的生产部署。

## 结构

```
ui/latest.json               当前版本指针（短 TTL；两区相同）
ui/v<version>/manifest.json  每个文件的 path / bytes / sha384
ui/v<version>/tokens.css     预编译令牌（含 @font-face）
ui/v<version>/primitives.css
ui/v<version>/fonts/
ui/v<version>/icons/         favicon 套件 + 生成的 site.webmanifest
ui/v<version>/logo/
ai/latest.com.json | ai/latest.cn.json   区域指针（由 /ai/latest.json 经 rewrite 分流）
ai/v<version>/               SKILL.md / SKILL.en.md / references/
demo/v<version>/manifest.json  demokit 资产清单（path / bytes / sha384）
demo/v<version>/              brand.css / brand-dark.css / brand-logo.svg / demo.js
```

`site.webmanifest` 是**生成**的而非拷贝来的：原始那份用相对路径，搬到 CDN 上就是死链；
且它的 `theme_color` 取自设计系统令牌，不是手填的字面量。

## 已知遗留：白色填充路径（U66 #12）

逐个查过 `assets/logo` 与 `assets/favicon` 的全部变体，各自含有的填充色是：

| 文件 | 填充色 | 白底可用？ |
|---|---|---|
| `logo/logo-mark.svg` | `#93BFDE` `#FFFFFF` `#223A58` `#E8B440` | ⚠️ 白色那笔会隐形 |
| `logo/logo-mark.color.svg` | 同上 | ⚠️ 同上 |
| `logo/logo-mark.dark.svg` | `#93BFDE` `#FFFFFF` `#E8B440` | ⚠️ **同样含白色**，它是给深色底用的 |
| `logo/logo-mark.mono-white.svg` | `#FFFFFF` | ❌ 白底完全不可见（本就不该用于白底） |
| `logo/logo-mark.mono-black.svg` | `#000000` | ✅ 唯一在白底上确定安全的变体 |
| `icons/favicon.svg` | `#0A2B47` `#93BFDE` `#FFFFFF` `#223A58` `#E8B440` | ⚠️ 同 logo-mark |

**容易搞错的一点**：`logo-mark.dark.svg` 是「深色主题版本」（给深底用），不是「深色描边版本」，
它同样含白色填充，**不能**当作白底方案。

所以当前没有「白底彩色」变体。要修的话有两条路，都需要设计决策：
① 把白色那一笔替换成一个在白底上可见的颜色，产出 `logo-mark.on-light.svg`；
② 或者确认白色描边本就是为深色底设计的，白底一律用 `mono-black`。

在定下来之前，**白底场景请用 `mono-black`**。见 `autional/ui` 的 `docs/logo-favicon-kit.md`。
