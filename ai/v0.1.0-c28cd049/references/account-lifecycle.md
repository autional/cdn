<!-- generated: core@23aef5aa3d26 · region: com · lang: en — do not edit directly -->

# Account lifecycle: join, link, recover

> Reference file for the Autional Onboarding skill.
> Use it when the app keeps its own user table and needs to decide
> when to create an account, how to merge identities, and how users recover.

## Join confirmation (first SSO login)

```
IdP authorized → (issuer, subject)
  ├── already linked → sign in
  └── not linked → show "Join <app>?" (checked by default)
        ├── Join    → create app_user + link → sign in
        └── Decline → do not create an account; keep the IdP session when possible
```

Rules:

- Ask **after** authorization: only then do you know the trusted `(issuer, subject)`.
- Record `join_declined` if you need product analytics; do not create a row.
- Idempotent: `unique(provider, issuer, subject)`; `on conflict do nothing` then re-read.
- The confirmation is UX, not a security boundary: the server still decides whether the account exists and enforces ownership.
- On decline, clear the local app session without calling the OP logout endpoint, so the IdP session can survive. Do not call the SDK's `logout()` — it ends the OP session.

## Linking (no auto-merge by email)

- Never merge accounts because two identities share an email. The email may be unverified.
- Link only while the user is **signed in to the app**: Settings → link → IdP authorize.
- Reject if the identity is already linked to another `app_user`.
- Refuse to unlink the last sign-in method.

## Data model

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

Business rows reference `app_users.id`; never email, never the IdP subject.

## TOTP and recovery

- TOTP is a **second factor**, not a recovery channel.
- Enable it only after a recovery code (or a verified email) exists.
- On enable: show the secret once, verify one code, then generate 10 single-use recovery codes (shown once).
- Lost authenticator: sign in with a recovery code → disable TOTP → re-enrol.
- SSO users recover at the IdP; the app does not reset an SSO password.
- If the app does not need its own MFA, use the Autional account MFA instead.

## Decision record

Copy into `AUTIONAL_SETUP.md`:

```
Join confirmation: yes/no (default checked)
Identity key: (provider, issuer, subject)
Account merge: explicit link only (no email auto-merge)
Recovery: recovery code / optional email / admin / none
TOTP: off by default; requires recovery code first
```
