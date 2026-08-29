# JasimFlow implementation audit

## Completed source-level checks

- TypeScript/TSX parser: **PASS** — 47 TS/TSX files, zero syntax parse diagnostics.
- Non-submit `<button>` audit: **PASS** — all native buttons explicitly declare a type; the shared `Button` defaults to `type="button"`.
- Decimal-safe frontend money self-tests: **PASS** for line rounding, percentage discount, tax-after-discount, fixed-discount cap and zero quantity.
- Historical delete safety: **PASS by schema review** — customer/catalog foreign keys use `ON DELETE SET NULL`; document/customer/company and line values are snapshotted.
- Numbering audit: row-locked independent counters; minimum 4-digit padding remains valid after 9,999.
- Conversion audit: source remains unchanged, invoice gets an independent number, source link is unique and conversion is atomic inside one PostgreSQL function.
- RLS/RPC static audit: client cannot directly insert/update documents or line items; exposed privileged RPCs derive tenant ownership from `auth.uid()`; internal SECURITY DEFINER helpers are revoked from client roles and use a fixed search path.
- Catalog foreign-key ownership validation added in document create/update RPC paths.
- Supabase SSR auth confirmation: **implemented** — `/auth/confirm` verifies the email OTP token hash server-side; proxy cookie refresh also forwards current SSR cache headers.

## Build-environment limitation

The generation container could not resolve `registry.npmjs.org` (DNS/network is disabled). `npm install` was attempted and timed out, so dependencies could not be installed in that environment. Consequently the following dependency-requiring commands could not be truthfully completed there:

```bash
npm run typecheck
npm run lint
npm run build
```

Run those three commands after `npm install` on a normal networked machine. This is an external environment blocker, not a claim that a production build has already passed.

## Supabase runtime limitation

No user Supabase project/credentials were provided to the generation environment, so the migration/RLS/RPCs were statically audited but not executed against a live project. Apply the migration to a test Supabase project and smoke-test signup, cross-user isolation, create/edit/duplicate/convert/delete and printing before production use.

## v2 invoice + branding upgrade

Added after the initial MVP audit:

- inline New Customer modal in the shared document editor
- editable invoice number with database uniqueness checks
- upgraded race-safe auto-number helper that skips manually occupied future numbers
- premium document preview and explicit A4 portrait print sizing
- removed the JasimFlow-generated footer watermark
- direct PNG/JPG/WebP company-logo upload via owner-scoped Supabase Storage
- logo removal preserves old storage objects so historical company snapshots do not break

Static re-audit after these changes:

- 49 TS/TSX source/config files parsed with TypeScript parser: **0 syntax diagnostics**
- native `<button>` tags missing an explicit `type`: **0**
- full dependency-aware typecheck/build could not be executed in the generation container because npm package download timed out; run `npm run typecheck`, `npm run lint`, and `npm run build` in the user's already-installed local project after applying the upgrade.

## v4 focused audit

- Removed the document-editor CCTV/IT instructional copy and the separate Catalog Preset column.
- Replaced the wide 1280px line-item table with a responsive two-row item card; Qty, Unit, Rate and Amount no longer require horizontal scrolling in the editor.
- Product remains the primary line name; Description is stored separately and both are rendered in document output.
- Saved catalog products remain available through Product-field autocomplete and can auto-fill description/unit/rate without a dedicated preset column.
- Existing-document template selection now persists immediately through an owner-checked `set_document_template` SECURITY DEFINER RPC; new documents persist the template on save.
- Added `0004_editor_reliability.sql` to explicitly persist Product and Description independently in create/update RPCs.
- Static TypeScript/TSX syntax parse: 49 files, 0 syntax diagnostics.
- Native `<button>` audit: 0 buttons missing an explicit `type` attribute.
- Full dependency typecheck/build was not run in the packaging environment because the archive intentionally excludes `node_modules` and package installation timed out; run `npm install`, `npm run typecheck`, `npm run lint`, and `npm run build` on the target machine.
