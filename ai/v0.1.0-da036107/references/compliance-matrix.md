<!-- generated: core@f495cd50f8cc · region: com · lang: en — do not edit directly -->

# Autional Compliance Matrix

> Reference file for the Autional Onboarding skill.
> Use it to pick a security policy that matches the user's industry and jurisdiction.

## Standards overview

| Standard | Scenario | password_transmission | min_length | require_upper/lower/digit | MFA | breached_check | expiry_days |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|
| **NIST SP 800-63B AAL1** | low-risk apps | hash | 8 | yes | no | no | 0 |
| **NIST SP 800-63B AAL2** | standard SaaS | hash | 8 | yes | yes | recommended | 0 |
| **NIST SP 800-63B AAL3** | high security | symmetric | 15 | yes | yes | yes | 0 |
| **PCI DSS v4.0** | payments / finance | hash | 12 | yes | yes | yes | 90 |
| **GDPR** | EU users | hash | 8 | yes | recommended | yes | 0 |
| **HIPAA** | healthcare | hash | 8 | yes | yes | yes | 90 |

## Quick pick

| Your scenario | Recommended profile |
|---|---|
| Personal project / internal tool | NIST AAL1 |
| SaaS product (default) | NIST AAL2 |
| Finance / payments | PCI DSS v4.0 |
| Users in the EU | NIST AAL2 + GDPR |
| Healthcare | HIPAA |

## Password transmission modes

| Mode | Security | Performance | When |
|---|:--:|:--:|---|
| `plain` | low | fastest | development only |
| `hash` | medium | fast | **production default** — SHA-256, zero extra overhead |
| `symmetric` | high | medium | end-to-end encryption required |
| `asymmetric` | highest | slow | high-compliance setups (PCI/HIPAA) |
