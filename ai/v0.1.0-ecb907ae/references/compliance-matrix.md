<!-- generated: core@2bfed789ef9f · region: cn · lang: zh — do not edit directly -->

# Autional 合规对照表

> Autional 接入 Skill 的引用文件。
> 用于按用户的行业与司法辖区选择安全策略。

## 标准对照

| 合规标准 | 适用场景 | password_transmission | min_length | require_upper/lower/digit | MFA | breached_check | expiry_days |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|
| **NIST SP 800-63B AAL1** | 低风险应用 | hash | 8 | 是 | 否 | 否 | 0 |
| **NIST SP 800-63B AAL2** | 标准 SaaS | hash | 8 | 是 | 是 | 推荐 | 0 |
| **NIST SP 800-63B AAL3** | 高安全 | symmetric | 15 | 是 | 是 | 是 | 0 |
| **PCI DSS v4.0** | 支付/金融 | hash | 12 | 是 | 是 | 是 | 90 |
| **GDPR** | 欧盟用户 | hash | 8 | 是 | 推荐 | 是 | 0 |
| **HIPAA** | 医疗 | hash | 8 | 是 | 是 | 是 | 90 |

## 国内合规补充（.cn）

| 合规标准 | 适用场景 | password_transmission | min_length | require_upper/lower/digit | MFA | breached_check | expiry_days |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|
| **等保 2.0 三级** | 大陆生产系统 | hash | 8 | 是 | 是 | 推荐 | 90 |
| **PIPL 个人信息保护法** | 大陆用户个人信息 | hash | 8 | 是 | 推荐 | 是 | 0 |

注：

- 面向大陆用户服务通常需要域名 ICP 备案；上线前与对接人确认。
- PIPL 要求个人信息处理取得明示同意，并支持个人的导出/删除请求——启用 Autional 的对应能力。

## 推荐策略速查

| 你的场景 | 推荐配置 |
|---|---|
| 个人项目/内部工具 | NIST AAL1 |
| SaaS 应用（默认） | NIST AAL2 |
| 金融/支付 | PCI DSS v4.0 |
| 面向欧盟用户 | NIST AAL2 + GDPR |
| 医疗保健 | HIPAA |

## 密码传输模式

| 模式 | 安全级别 | 性能 | 何时使用 |
|---|:--:|:--:|---|
| `plain` | 低 | 最快 | 仅开发环境 |
| `hash` | 中 | 快 | **生产默认**——SHA-256，零额外开销 |
| `symmetric` | 高 | 中 | 需要端到端加密 |
| `asymmetric` | 最高 | 慢 | 高合规场景（PCI/HIPAA） |
