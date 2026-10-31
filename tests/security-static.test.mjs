import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const config = await readFile(new URL("../supabase-config.js", import.meta.url), "utf8");
const migration = await readFile(
  new URL("../supabase/migrations/20261031000000_auth_bookmarks_premium.sql", import.meta.url),
  "utf8"
);
const premiumPage = await readFile(new URL("../articles/premium.html", import.meta.url), "utf8");
const authClient = await readFile(new URL("../site-auth.js", import.meta.url), "utf8");
const bookmarkTests = await readFile(new URL("../supabase/tests/bookmarks_rls_test.sql", import.meta.url), "utf8");
const premiumTests = await readFile(new URL("../supabase/tests/premium_articles_rls_test.sql", import.meta.url), "utf8");

test("public configuration has no server credential", () => {
  assert.match(config, /url:\s*"https:\/\/[^"]+\.supabase\.co"/);
  assert.match(config, /anonKey:\s*"[^"]+"/);
  assert.doesNotMatch(config, /sb_secret_|service_role/i);
});

test("database migration enables RLS and grants least privilege", () => {
  assert.match(migration, /alter table public\.bookmarks enable row level security/i);
  assert.match(migration, /revoke all on table public\.bookmarks from public, anon, authenticated/i);
  assert.match(migration, /grant select, insert, delete on table public\.bookmarks to authenticated/i);
  assert.match(migration, /using\s*\(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.match(migration, /with check\s*\(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.doesNotMatch(migration, /grant[^;]*update[^;]*bookmarks/i);

  assert.match(migration, /alter table public\.premium_articles enable row level security/i);
  assert.match(migration, /revoke all on table public\.premium_articles from public, anon, authenticated/i);
  assert.match(migration, /grant select on public\.premium_articles to authenticated/i);
  assert.match(migration, /published\s*=\s*true/i);
  assert.doesNotMatch(migration, /create policy[^;]*on public\.premium_articles[^;]*for (insert|update|delete)/i);
});

test("premium article body is not shipped in public HTML or client code", () => {
  assert.match(premiumPage, /name="robots" content="noindex,follow"/);
  assert.match(premiumPage, /id="premium-content"[^>]*><\/section>/);
  assert.match(authClient, /\.from\("premium_articles"\)/);
  assert.match(authClient, /paragraph\.textContent = text/);
});

test("pgTAP coverage includes cross-user isolation and anonymous denial", () => {
  assert.match(bookmarkTests, /anonymous users cannot read bookmarks/i);
  assert.match(bookmarkTests, /cannot create a bookmark for another user/i);
  assert.match(bookmarkTests, /another user cannot delete the owners bookmark/i);
  assert.match(premiumTests, /anonymous users cannot read premium article rows/i);
  assert.match(premiumTests, /signed-in users can read published premium content/i);
  assert.match(premiumTests, /cannot read unpublished premium content/i);
  assert.match(premiumTests, /cannot update premium articles/i);
});
