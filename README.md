# autional/cdn

Content source for **`cdn.autional.com`** — versioned, immutable static assets on an own domain,
**isolated** from `cdn.autional.cn`.

## What it serves

- `/ai/<version>/…` — AI skill / onboarding distribution (`text/markdown`, plus `.sha256`),
  published by the SDK repo's generator.
- `/ui/<version>/…` — design-system runtime assets (CSS / icons / fonts) for `*.autional.com` sites.

## Rules

- **Versioned & immutable**: never overwrite a versioned path; publish a new version directory.
- Do not hand-edit generated directories.
- Follow the latest via `/ai/latest.json` (short TTL).

## Vercel

- Project: `cdn`  ·  Domain: `cdn.autional.com`
