# JasimFlow

JasimFlow is a lightweight quotation and invoice web app for small businesses. It intentionally focuses on creating, saving, converting, tracking and printing professional documents rather than becoming a full accounting suite.

## Features

- Supabase email/password authentication; one user maps to one business.
- Dashboard with quotation/invoice counts, recent documents and outstanding invoice value.
- Customer CRUD with search, historical document snapshots, and inline new-customer creation from document editors.
- Reusable Items / Services CRUD with search; custom document lines remain supported.
- Shared responsive quotation/invoice editor with dynamic, reorderable line items.
- Percentage/fixed discounts, tax/VAT, decimal quantity/rate and live decimal-safe preview totals.
- PostgreSQL `NUMERIC` remains authoritative for stored totals.
- Race-safe independent `QUO-0001` / `INV-0001` numbering with configurable prefixes; invoice numbers can also be manually edited with uniqueness protection.
- Atomic quotation -> invoice conversion and duplicate protection.
- Duplicate document actions and invoice Paid/Unpaid actions.
- Premium A4 preview with browser Print -> Save as PDF; no JasimFlow watermark is added.
- Tenant-isolated RLS plus ownership checks inside privileged RPCs.
- Historical customer, company and line-item snapshot data.
- Direct company-logo upload (PNG/JPG/WebP, up to 2 MB) through an owner-scoped Supabase Storage bucket.

## Technology

- Next.js 16 App Router + TypeScript
- React 19
- Tailwind CSS 4
- Supabase Auth/PostgreSQL + `@supabase/ssr`
- Zod
- Lucide React

No external web fonts are required.

## 1. Prerequisites

- Node.js 20.9+ (Node 22 LTS recommended)
- npm
- A Supabase project
- Optional: Supabase CLI if you prefer applying migrations from the terminal

## 2. Install

```bash
npm install
cp .env.example .env.local
```

Set:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Use the Supabase publishable key; never expose a secret/service-role key in `NEXT_PUBLIC_*` variables.

## 3. Database setup

Apply migrations in order:

```text
supabase/migrations/0001_init.sql
supabase/migrations/0002_invoice_customization_and_logo_storage.sql
supabase/migrations/0003_it_products_and_templates.sql
supabase/migrations/0004_editor_reliability.sql
```

For an existing installation, run only the migrations that have not already succeeded. For a working v3 database, run **only** `0004_editor_reliability.sql`.

### With Supabase CLI

Link the local directory to your project and run your normal migration workflow, for example:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

### With Supabase SQL Editor

Open the migration file, paste it into the project's SQL Editor and run it once.

The migration creates:

- `businesses`
- `document_counters`
- `customers`
- `catalog_items`
- `documents`
- `document_items`
- RLS policies
- signup business-provisioning trigger
- secure document RPCs
- optional `seed_demo_data()` RPC
- `company-logos` Storage bucket and owner-scoped upload policies (migration 0002)

## 4. Auth settings

In Supabase Auth, enable Email provider. If email confirmation is enabled, new users are sent to the login screen with a confirmation message until they verify their email.

## 5. Run locally

```bash
npm run dev
```

Open `http://localhost:3000`.

After signing up, go to **Settings** and enter company identity, upload a company logo, set currency/tax defaults, document prefixes, terms and payment details.

## 6. Demo data

After signing in, go to **Settings -> Seed demo data**. It creates example customers, catalog items, one quotation and one invoice only when the business has no customers yet.

Because the seed RPC is user-scoped through `auth.uid()`, it should be invoked from an authenticated app session rather than directly from an admin SQL session.

## 7. Quality commands

```bash
npm run typecheck
npm run lint
npm run build
```

`npm run typecheck` uses `tsc --noEmit`. Next.js 16 uses `proxy.ts` rather than the deprecated `middleware.ts` convention.

## Money calculation contract

The UI preview and database use the same order:

1. Each line = `round(quantity * unit_price, 2)`
2. Subtotal = sum of rounded lines
3. Discount = fixed or percentage, rounded to 2 decimals and capped at subtotal
4. Taxable base = `max(0, subtotal - discount)`
5. Tax = `round(taxable_base * tax_rate / 100, 2)`
6. Grand total = taxable base + tax

Input quantity/rates and percentage values support up to four decimal places. Stored monetary totals use PostgreSQL `NUMERIC(18,2)`.

## Security model

- RLS is enabled on every tenant-owned table.
- `businesses.owner_user_id = auth.uid()` is the tenant boundary.
- Customers/catalog are RLS-protected direct CRUD.
- Documents and document items are read directly but created/updated through audited RPCs.
- `SECURITY DEFINER` helpers are revoked from client roles unless they are intended public RPCs.
- Public RPCs derive the business from `auth.uid()`; they do not trust a client-supplied `business_id`.
- Catalog references are validated as belonging to the caller's business.
- Customer and catalog deletion cannot destroy historical document content because snapshots are stored on the document and document lines.

## Numbering

Quotation and invoice counters are independent. The database locks the relevant counter row with `FOR UPDATE` before incrementing it. Padding is a **minimum of four digits** (`0001` ... `9999`, then `10000`), so numbering remains valid beyond 9,999 documents. Invoice numbers can be manually edited; a per-business/type unique constraint rejects duplicates, and automatic numbering skips manually occupied future numbers.

## Quotation -> invoice conversion

Conversion is one PostgreSQL transaction. It:

- verifies ownership
- never mutates the source quotation
- creates a new invoice number
- copies customer/company snapshots and all lines
- copies discount/tax/notes/terms
- sets `source_document_id`
- protects against duplicate conversion with a unique partial index

## Printing / PDF

Open a document preview and choose **Print / PDF**. Print CSS hides app navigation/actions and uses A4 page rules. Browser-native **Save as PDF** is the intended MVP PDF path; no screenshot/canvas PDF library is used.

## Deployment

Vercel is the simplest Next.js deployment target:

1. Push this source to Git.
2. Import the repository into Vercel.
3. Add both Supabase environment variables.
4. Ensure the migration is already applied to the production Supabase project.
5. Deploy.

Any Node-compatible Next.js host works as long as environment variables and HTTPS are configured correctly.

## Known MVP limitations

- No inventory, accounting ledger, expenses, recurring invoices, payment gateway or e-signature.
- Overdue is derived in the UI when an unpaid invoice passes its due date; it can also be explicitly stored as an invoice status.
- Browser print is used for PDF rather than a dedicated server-side PDF renderer.

See `AUDIT.md` for the verification performed in the build environment used to generate this source archive.

## Supabase setup

### Authentication URL configuration

In **Supabase Dashboard → Authentication → URL Configuration**:

- Set **Site URL** to your app origin (for local development, usually `http://localhost:3000`).
- Add the same local/production origins to the allowed redirect URLs as needed.

For SSR email confirmation, update the **Confirm signup** email template link to:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

The app handles that link in `src/app/auth/confirm/route.ts` and exchanges the token hash for a server-side session before redirecting to `/dashboard`.



## v3 — CCTV / IT workflow + premium templates

For an existing v2 database, run only `supabase/migrations/0003_it_products_and_templates.sql` after the v2 migration. v3 adds a separate **Product** field plus **Description / Specification** on every document line, changes the normal new-line unit to **pcs**, expands useful CCTV/IT units, and stores one of six A4 document templates per quotation/invoice: Executive Navy, Tech Blue, Minimal White, Graphite Pro, Emerald Ledger, and Copper Classic. The desktop product name is **JasimFlow**.

Do not rerun `0001_init.sql` or `0002_invoice_customization_and_logo_storage.sql` on a database where they already succeeded.


## v4 — faster line items + reliable templates

For an existing v3 database, run only `supabase/migrations/0004_editor_reliability.sql`. v4 removes the separate Catalog Preset column, uses a compact no-horizontal-scroll line-item editor, labels the second field simply **Description**, keeps **pcs** as the default unit, persists Product and Description explicitly, and adds an owner-checked RPC so template changes on existing documents are saved immediately.
