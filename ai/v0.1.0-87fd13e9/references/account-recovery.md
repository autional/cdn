<!-- generated: core@1229279235b2 · region: com · lang: en — do not edit directly -->

# Identifier and account recovery

> Default registration is username + password.
> Email/phone are account identifiers only after verification; unverified values are never stored.
> Recovery uses an app-side recovery code; admin reset is the fallback.

## Identifier matrix

| Identifier | Friction | Recovery | Anti-abuse |
|---|---|---|---|
| username + password (default) | lowest | app-side recovery code / admin | CAPTCHA + rate limit |
| verified email + password | medium | recovery code; verified email OTP optional | CAPTCHA + rate limit |
| verified phone + password | medium | recovery code; verified phone OTP optional | SMS cost + rate limit |
| SSO only | depends on IdP | at the IdP | IdP policy |

Registration without a username is rejected. Email/phone are optional account identifiers, but they must pass a verification code before the account is created or the identifier is attached.
An unverified email/phone must not be written to the identity table, used for login, recovery, notifications, or uniqueness checks.
The default login is username + password; email/phone login is allowed only after verification.

## Recovery options

| Option | Requires | If the user loses it | Notes |
|---|---|---|---|
| app-side recovery code (default) | codes generated at signup / in settings | account unrecoverable | 10 single-use codes, hashed, shown once; verify, never reuse |
| admin reset | an operator | requires an operator | audited runbook |
| verified email/phone OTP (optional) | the identifier was verified and the app can send | unrecoverable unless another channel exists | do not enable without a delivery channel |
| recovery contact (optional) | the app can send | contact must still be reachable | only with a delivery channel |
| none | — | account unrecoverable | record it in `AUTIONAL_SETUP.md` |

The platform has no account recovery code; the app owns this mechanism.
The platform's `/auth/recovery/*` endpoints require delivery; use them only when the app can send.
Admin resets must be audited.

## Decision → implementation

| Decision | Where to apply | How to verify |
|---|---|---|
| Identifier | registration form (username) / verified code registration for email/phone | username registration returns 201; email/phone without code returns 400 |
| Email/phone verification | identity code endpoints; attach only after code success | verify DB has `verified_at`; no unverified identity row |
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
Identifier: username (default) | verified email | verified phone | SSO only
Recovery: app-side recovery code | admin | none
If none: account is unrecoverable (accepted by <user> on <date>)
```
