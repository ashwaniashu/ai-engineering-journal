import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const config = await readFile(new URL("../supabase-config.js", import.meta.url), "utf8");
const migration = await readFile(
  new URL("../supabase/migrations/20261031000000_auth_bookmarks_premium.sql", import.meta.url),
  "utf8"
);
const premiumPage = await readFile(new URL("../articles/premium.html", import.meta.url), "utf8");
const agentsPage = await readFile(new URL("../articles/ai-agents.html", import.meta.url), "utf8");
const accountPage = await readFile(new URL("../account.html", import.meta.url), "utf8");
const homePage = await readFile(new URL("../index.html", import.meta.url), "utf8");
const homeScript = await readFile(new URL("../script.js", import.meta.url), "utf8");
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

test("public page copy uses plain language and hides infrastructure details", () => {
  const visibleCopy = [homePage, accountPage, premiumPage]
    .join("\n")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ");
  assert.doesNotMatch(visibleCopy, /\b(?:supabase|database|postgres|sql|rls)\b/i);
});

test("particle background initializes the slim engine and respects accessibility preferences", () => {
  assert.match(homePage, /id="hero-particles"[^>]*aria-hidden="true"/);
  assert.match(homePage, /@tsparticles\/slim@3\.9\.1/);
  assert.match(homeScript, /window\.loadSlim\(window\.tsParticles\)\.then/);
  assert.match(homeScript, /!reducedMotion && !saveData/);
});

test("homepage presents an editorial hero, featured guide, latest articles, and working topic links", () => {
  const hero = homePage.slice(homePage.indexOf('<section class="hero"'), homePage.indexOf("</section>"));
  const featured = homePage.slice(homePage.indexOf('<section class="featured-section"'), homePage.indexOf('<section id="articles"'));
  const latest = homePage.slice(homePage.indexOf('<section id="articles"'), homePage.indexOf('<section id="topics"'));
  const topics = homePage.slice(homePage.indexOf('<section id="topics"'), homePage.indexOf('<section id="about"'));

  assert.match(hero, /Beyond the Hype\.\s*<span>Into the Intelligence\.<\/span>/);
  assert.match(hero, /class="hero-art" aria-hidden="true"/);
  assert.match(hero, /class="primary-button" href="#articles"/);
  assert.match(featured, /href="articles\/rag-pipeline\.html"/);
  assert.match(featured, /data-topic="GenAI\|LLMs\|RAG\|Tutorials"/);
  assert.match(featured, /data-bookmark-slug="rag-pipeline"/);
  assert.equal((latest.match(/class="article-card"/g) || []).length, 3);
  assert.match(latest, /id="search"/);
  assert.match(latest, /data-topic="Harness Engineering"/);
  assert.match(topics, /href="articles\/rag-pipeline\.html"/);
  assert.match(topics, /href="articles\/ai-agents\.html"/);
  assert.match(topics, /<a href="articles\/ai-agents\.html">Multi-agent systems/);
  assert.match(topics, /href="articles\/ai-system-design\.html"/);
  assert.match(homeScript, /const featuredStory = document\.querySelector\("\.featured-story"\)/);
});

test("author profile and structured data use the supplied AI architect positioning", () => {
  const about = homePage.slice(homePage.indexOf('<section id="about"'));
  assert.match(about, /<h2>Ashwani Ashu<\/h2>/);
  assert.match(about, /AI Architect · Agentic Systems · Frontier AI/);
  assert.match(about, /agentic AI and reasoning engines/);
  assert.match(about, /Design intelligence\. Architect the future\./);
  assert.match(about, /href="https:\/\/www\.linkedin\.com\/in\/ashwani-kumar-ashu-839019b1\/"/);
  assert.match(homePage, /"jobTitle": "AI Architect"/);
  assert.match(homePage, /"name": "Ashwani Ashu"/);
  assert.match(homePage, /#ashwani-ashu/);
  assert.doesNotMatch(homePage, /Kumar Ashwani|#kumar-ashwani/);
});

test("harness engineering is covered in the agent guide and topic filters", () => {
  assert.match(homePage, /data-topic="Harness Engineering"/);
  assert.match(homePage, /Harness Engineering[^<]*<\/button>/);
  assert.match(homePage, /Harness Engineering\|Agentic AI/);
  assert.match(agentsPage, /name="description" content="[^"]*harness engineering/i);
  assert.match(agentsPage, /<h2>What is an AI agent harness\?<\/h2>/);
  assert.match(agentsPage, /An AI agent harness is the application and runtime around a model/);
  assert.match(agentsPage, /The model can propose a step; the harness decides whether and how that step is carried out\./);
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
