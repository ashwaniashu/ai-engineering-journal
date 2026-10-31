# Supabase setup

The site remains static on GitHub Pages. Supabase provides email/password
authentication and the database API. The browser uses only the project's
publishable (or legacy `anon`) key; Postgres grants and RLS enforce access.

## What this implementation protects

- The existing three article files remain public HTML.
- Bookmarks are stored per user in `public.bookmarks`.
- The premium article preview is public, but its body is fetched from
  `public.premium_articles` only after sign-in. Its body is not committed to
  this repository or placed in the public HTML.
- Any authenticated user can read a published premium article. This is a
  login gate, not a payment or subscription system.
- No browser page uses a `service_role` or secret key.

## Configure a Supabase project

1. Create a Supabase project and enable Email under **Authentication → Sign In
   / Providers**. Keep email confirmation enabled for public signups. Set an
   appropriate minimum password length and enable leaked-password protection
   if available for your project.
2. Set **Authentication → URL Configuration → Site URL** to:
   `https://ashwaniashu.github.io/ai-engineering-journal/`
3. Add these exact redirect URLs to the allowed redirect list:
   - `https://ashwaniashu.github.io/ai-engineering-journal/account.html`
   - `https://ashwaniashu.github.io/ai-engineering-journal/account.html?recovery=1`
4. Open **SQL Editor**, run
   [`supabase/migrations/20261031000000_auth_bookmarks_premium.sql`](./supabase/migrations/20261031000000_auth_bookmarks_premium.sql),
   and confirm both tables have RLS enabled.
5. In **Project Settings → API Keys**, copy the project URL and the
   publishable key (or legacy anon key) into `supabase-config.js`:

   ```js
   window.AI_JOURNAL_SUPABASE_CONFIG = Object.freeze({
     url: "https://YOUR-PROJECT-REF.supabase.co",
     anonKey: "YOUR-PUBLISHABLE-OR-ANON-KEY"
   });
   ```

   The publishable/anon key is intended for browser use. **Never use or publish
   a `service_role` key, secret key, database password, or personal access
   token.** The app rejects recognizable service-role keys, but that is only a
   guardrail; choose the correct key in the Supabase dashboard. Configure the
   Supabase project's API security and RLS as the actual boundary.
6. Add your premium article in the Supabase SQL Editor. Keep its body in
   Supabase—not in a committed SQL seed, HTML file, or JavaScript file. For
   example, replace the sample values before running:

   ```sql
   insert into public.premium_articles (slug, title, excerpt, body, published)
   values (
     'agentic-systems-production',
     'Production Agentic AI Systems: Architecture and Evaluation',
     'A short public-safe summary of the article.',
     'Paste your premium article text here. Separate paragraphs with blank lines.',
     true
   );
   ```

   To revise it later, update the row through the SQL Editor. Set `published`
   to `false` to withdraw it. The SQL Editor uses an administrative database
   role; never put that role's credentials in the website.
7. Deploy the site files to GitHub Pages. Until `supabase-config.js` contains a
   project URL and publishable/anon key, account features show a setup message
   and stay unavailable.

## Authentication flows

- Sign-up sends Supabase's confirmation email when email confirmation is on.
- Login uses Supabase Auth and its browser session persistence/refresh.
- Password reset redirects to the account page's recovery form. Make sure both
  allowed redirect URLs above are configured.
- Bookmarks are created, listed, and removed through the authenticated
  Supabase client. The database policy also checks `auth.uid()`, so changing
  the client-sent `user_id` cannot access another user's rows.

For a public-facing signup form, configure suitable Supabase Auth rate limits
and CAPTCHA/anti-bot protection in the Supabase project. This static site does
not implement billing, roles, paid subscriptions, or abuse monitoring.

## RLS policies and privileges

The migration revokes browser-role privileges before granting only required
operations:

| Table | Anonymous | Authenticated |
|---|---|---|
| `bookmarks` | No table access | Read/insert/delete own rows only |
| `premium_articles` | No table access | Read published rows only |

There are no client write policies for premium content and no update grant for
bookmarks. The website never fetches premium body text before Supabase Auth
returns a signed-in session. Even if a visitor bypasses that UI check and calls
the REST API directly, PostgreSQL grants and RLS remain in force.

## Test the database policies

The pgTAP tests in [`supabase/tests/`](./supabase/tests/) exercise anonymous
denials, bookmark ownership and cross-user isolation, premium publication
visibility, and denial of client writes. Install the Supabase CLI and Docker.
Because this repository already has a `supabase/` folder but does not include
the CLI's `config.toml`, create a temporary CLI project and copy in the
migration/tests before running them from PowerShell at the repository root:

```powershell
$repo = (Get-Location).Path
$testProject = Join-Path $env:TEMP ("ai-journal-rls-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $testProject | Out-Null
Push-Location $testProject
supabase init
Copy-Item (Join-Path $repo "supabase\migrations\*.sql") ".\supabase\migrations\"
Copy-Item (Join-Path $repo "supabase\tests\*.sql") ".\supabase\tests\"
supabase start
supabase test db
Pop-Location
```

`supabase test db` applies the copied migration and rolls test fixtures back.
The CLI/Docker are not required to serve the static GitHub Pages site.

For a test against a configured Supabase project, create two disposable,
email-confirmed test users and insert a published premium article with slug
`agentic-systems-production`. Set these environment variables in the
PowerShell session (do not commit them):

```powershell
$env:SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co"
$env:SUPABASE_ANON_KEY = "YOUR-PUBLISHABLE-OR-ANON-KEY"
$env:SUPABASE_TEST_USER_A_EMAIL = "test-a@example.com"
$env:SUPABASE_TEST_USER_A_PASSWORD = "TEST-USER-A-PASSWORD"
$env:SUPABASE_TEST_USER_B_EMAIL = "test-b@example.com"
$env:SUPABASE_TEST_USER_B_PASSWORD = "TEST-USER-B-PASSWORD"
node --test tests/supabase-rls.test.mjs
```

The integration test authenticates both users, confirms anonymous premium and
bookmark access is denied/empty, confirms a signed-in user can read the
published premium row and create a bookmark, and confirms another user cannot
read, delete, or spoof that bookmark. It removes its temporary bookmark. It
refuses recognizable service-role/secret keys. Use disposable accounts only.

## Before launch

- Test signup, confirmation, login, reset email, password update, logout,
  bookmarks, and premium access in the deployed site.
- Verify the exact recovery redirect URL in Supabase Auth settings.
- Review Supabase Auth logs and configure provider rate limits.
- No actual Supabase project credentials are included in this repository, so
  database policies cannot be exercised against your hosted project until you
  configure it.
