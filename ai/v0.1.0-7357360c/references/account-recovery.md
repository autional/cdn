<!-- generated: core@889ab9186b36 · region: com · lang: en — do not edit directly -->

# Identifier and account recovery

> Registration requires email or phone (platform `RegisterRequest.Validate`); username is only a login alias.
> The app does not send email/SMS codes by default.
> Recovery uses an app-side recovery code; admin reset is the fallback.

## Identifier matrix

| Identifier | Friction | Recovery | Anti-abuse |
|---|---|---|---|
| email + password (default) | low | app-side recovery code / admin | CAPTCHA + rate limit |
| phone + password | medium | app-side recovery code / admin | CAPTCHA + rate limit |
| email + phone (dual) | high | app-side recovery code / admin | both fields |
| SSO only | depends on IdP | at the IdP | IdP policy |

Registration without email or phone is rejected (`email or phone is required`).
The email/phone is stored unverified; no code is sent. It is a registration identifier, not a recovery channel by itself.
An optional username (3–32 chars) is the day-to-day login alias.

## Recovery options

| Option | Requires | If the user loses it | Notes |
|---|---|---|---|
| app-side recovery code (default) | codes generated at signup / in settings | account unrecoverable | 10 single-use codes, hashed, shown once; verify, never reuse |
| admin reset | an operator | requires an operator | audited runbook |
| email/phone OTP (optional) | the app can send email/SMS | unrecoverable unless another channel exists | do not enable without a delivery channel |
| recovery contact (optional) | the app can send | contact must still be reachable | only with a delivery channel |
| none | — | account unrecoverable | record it in `AUTIONAL_SETUP.md` |

The platform has no account recovery code; the app owns this mechanism.
The platform's `/auth/recovery/*` endpoints require delivery; use them only when the app can send.
Admin resets must be audited.

## Decision → implementation

| Decision | Where to apply | How to verify |
|---|---|---|
| Identifier | registration form (`email` or `phone`) + tenant `login_methods` | submit each chosen identifier; a missing email/phone returns 400 |
| Recovery code | app-side table + settings page | generate once, redeem once, reject reuse |
| Admin reset | operator runbook | reset one test account and check the audit log |
| Registration protection | CAPTCHA + rate limit | 3 failures → challenge; per-IP limit trips |

Field names vary by region and version; verify behaviour instead of trusting a 200.

## SSO users

SSO users have no local password. Recovery happens at the identity provider.
If a user has both password and SSO, define the linking rule before enabling both.

## Decision record

Copy this into `AUTIONAL_SETUP.md`:

```
Identifier: email | phone | email+phone | SSO only (username is a login alias)
Recovery: app-side recovery code | admin | none
If none: account is unrecoverable (accepted by <user> on <date>)
```
