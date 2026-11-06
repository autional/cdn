<!-- generated: core@a8bcf8f2d714 · region: com · lang: en — do not edit directly -->

# Identifier and account recovery

> Reference file for the Autional Onboarding skill.
> Registration requires email or phone; username is only a login alias.
> Both answers are required before signup is considered complete.

## Identifier matrix

| Identifier | Friction | Recovery | Anti-abuse |
|---|---|---|---|
| email + password (default) | low | code to the same email | CAPTCHA + rate limit |
| phone + password / SMS | medium | code to the same phone | SMS cost + rate limit |
| email + phone (dual) | high | either channel | both channels |
| SSO only | depends on IdP | at the IdP | IdP policy |

Registration without email or phone is rejected (`email or phone is required`).
An optional username (3–32 chars) can sign in, but cannot replace email/phone at signup.
Email verification is optional for login; it is required for email-based recovery.

## Recovery options

| Option | Requires | If the user loses it | Notes |
|---|---|---|---|
| code to the account's own email/phone | email or phone on file | unrecoverable unless another channel exists | `/auth/recovery/request`, `/verify`, `/complete` |
| recovery contact | a contact bound in settings | contact must still be reachable | `/auth/me/recovery-contacts`; `/auth/recover-account`, `/reset` |
| admin reset | an operator | requires an operator | audited runbook |
| none | — | account is unrecoverable | record it in `AUTIONAL_SETUP.md` |

There is no user-facing account recovery code. MFA backup codes are a separate second-factor mechanism, not an account recovery channel.
Codes expire and requests are rate-limited; admin resets must be audited.

## Decision → implementation

| Decision | Where to apply | How to verify |
|---|---|---|
| Identifier | registration form (`email` or `phone`) + tenant `login_methods` | submit each chosen identifier; a missing email/phone returns 400 |
| Email/phone recovery | identity `/auth/recovery/*` | request a code, receive it, complete the reset |
| Recovery contact | `/auth/me/recovery-contacts` | bind a contact, run `/auth/recover-account` |
| Admin reset | operator runbook | reset one test account and check the audit log |
| Registration protection | CAPTCHA + rate limit | 3 failures → challenge; per-IP limit trips |

Field names vary by region and version; verify behaviour instead of trusting a 200.

## SSO users

SSO users have no local password. Recovery happens at the identity provider.
If a user has both password and SSO, define the linking rule before enabling both.

## Decision record

Copy this into `AUTIONAL_SETUP.md`:

```
Identifier: email | phone | email+phone | SSO only
Recovery: email/phone OTP | recovery contact | admin | none
If none: account is unrecoverable (accepted by <user> on <date>)
```
