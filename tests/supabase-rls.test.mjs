import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const config = {
  url: process.env.SUPABASE_URL?.replace(/\/+$/, ""),
  key: process.env.SUPABASE_ANON_KEY,
  userAEmail: process.env.SUPABASE_TEST_USER_A_EMAIL,
  userAPassword: process.env.SUPABASE_TEST_USER_A_PASSWORD,
  userBEmail: process.env.SUPABASE_TEST_USER_B_EMAIL,
  userBPassword: process.env.SUPABASE_TEST_USER_B_PASSWORD,
  premiumSlug: process.env.SUPABASE_TEST_PREMIUM_SLUG || "agentic-systems-production"
};

const requiredVariables = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_TEST_USER_A_EMAIL",
  "SUPABASE_TEST_USER_A_PASSWORD",
  "SUPABASE_TEST_USER_B_EMAIL",
  "SUPABASE_TEST_USER_B_PASSWORD"
];
const missingVariables = requiredVariables.filter(name => !process.env[name]);

function isServiceRoleKey(key) {
  if (key.startsWith("sb_secret_")) return true;
  const payload = key.split(".")[1];
  if (!payload) return false;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return claims.role === "service_role";
  } catch {
    return false;
  }
}

async function signIn(email, password) {
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: config.key,
      "content-type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  assert.equal(response.status, 200, "test account sign-in must succeed");
  return data;
}

function restRequest(path, token, options = {}) {
  return fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.key,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
}

async function expectDeniedOrEmpty(response, description) {
  if (!response.ok) {
    assert.ok(
      [401, 403].includes(response.status),
      `${description}: expected permission denial, received HTTP ${response.status}`
    );
    return;
  }
  const rows = await response.json();
  assert.deepEqual(rows, [], description);
}

test("Supabase RLS protects premium articles and per-user bookmarks", {
  skip: missingVariables.length
    ? `Set integration-test environment variables: ${missingVariables.join(", ")}`
    : false
}, async () => {
  assert.equal(isServiceRoleKey(config.key), false, "Use only a publishable/anon key in this test");

  const [userA, userB] = await Promise.all([
    signIn(config.userAEmail, config.userAPassword),
    signIn(config.userBEmail, config.userBPassword)
  ]);
  assert.ok(userA.user?.id && userA.access_token, "test user A must authenticate");
  assert.ok(userB.user?.id && userB.access_token, "test user B must authenticate");

  const slug = `rls-test-${randomUUID()}`;
  let bookmarkCreated = false;

  try {
    const anonymousPremium = await restRequest(
      `premium_articles?select=slug%2Cbody&slug=eq.${encodeURIComponent(config.premiumSlug)}&published=eq.true`,
      config.key
    );
    await expectDeniedOrEmpty(anonymousPremium, "anonymous users must not read premium content");

    const anonymousBookmarks = await restRequest("bookmarks?select=user_id%2Carticle_slug", config.key);
    await expectDeniedOrEmpty(anonymousBookmarks, "anonymous users must not read bookmarks");

    const anonymousWrite = await restRequest("bookmarks", config.key, {
      method: "POST",
      body: JSON.stringify({ user_id: userA.user.id, article_slug: slug })
    });
    assert.equal(anonymousWrite.ok, false, "anonymous users must not create bookmarks");

    const premiumForUser = await restRequest(
      `premium_articles?select=slug%2Cbody&slug=eq.${encodeURIComponent(config.premiumSlug)}&published=eq.true`,
      userA.access_token
    );
    assert.equal(premiumForUser.status, 200, "authenticated users can request published premium content");
    const premiumRows = await premiumForUser.json();
    assert.equal(premiumRows.length, 1, "the configured published premium article must be returned");
    assert.ok(premiumRows[0].body.length > 0, "the premium body must be available to authenticated users");

    const ownBookmark = await restRequest("bookmarks", userA.access_token, {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ user_id: userA.user.id, article_slug: slug })
    });
    assert.equal(ownBookmark.status, 201, "a user can create their own bookmark");
    bookmarkCreated = true;

    const spoofedBookmark = await restRequest("bookmarks", userA.access_token, {
      method: "POST",
      body: JSON.stringify({ user_id: userB.user.id, article_slug: `${slug}-spoof` })
    });
    assert.equal(spoofedBookmark.ok, false, "a user cannot create a bookmark for another user");

    const userBRead = await restRequest(
      `bookmarks?select=article_slug&user_id=eq.${userA.user.id}&article_slug=eq.${slug}`,
      userB.access_token
    );
    assert.equal(userBRead.status, 200);
    assert.deepEqual(await userBRead.json(), [], "users cannot read another user's bookmarks");

    const userBDelete = await restRequest(
      `bookmarks?user_id=eq.${userA.user.id}&article_slug=eq.${slug}`,
      userB.access_token,
      { method: "DELETE", headers: { prefer: "return=representation" } }
    );
    assert.equal(userBDelete.status, 200);
    assert.deepEqual(await userBDelete.json(), [], "users cannot delete another user's bookmark");

    const ownerStillHasBookmark = await restRequest(
      `bookmarks?select=article_slug&user_id=eq.${userA.user.id}&article_slug=eq.${slug}`,
      userA.access_token
    );
    assert.deepEqual(await ownerStillHasBookmark.json(), [{ article_slug: slug }]);
  } finally {
    if (bookmarkCreated) {
      const cleanup = await restRequest(
        `bookmarks?user_id=eq.${userA.user.id}&article_slug=eq.${slug}`,
        userA.access_token,
        { method: "DELETE" }
      );
      assert.equal(cleanup.status, 204, "the integration test must remove its own bookmark");
    }
  }
});
