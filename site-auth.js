(() => {
  const config = window.AI_JOURNAL_SUPABASE_CONFIG;
  const accountSetupMessage = document.querySelector("#account-setup-message");
  const accountStatus = document.querySelector("#account-status");
  const siteStatus = document.querySelector("[data-site-status]");
  const signupForm = document.querySelector("#signup-form");
  const loginForm = document.querySelector("#login-form");
  const resetForm = document.querySelector("#reset-form");
  const recoveryForm = document.querySelector("#recovery-form");
  const accountSession = document.querySelector("#account-session");
  const accountEmail = document.querySelector("#account-email");
  const savedArticleList = document.querySelector("#saved-article-list");
  const savedEmpty = document.querySelector("#saved-empty");
  const premiumMessage = document.querySelector("#premium-access-message");
  const premiumContent = document.querySelector("#premium-content");
  const premiumPage = document.querySelector("[data-premium-slug]");
  const bookmarkButtons = [...document.querySelectorAll("[data-bookmark-slug]")];
  const accountTabs = [...document.querySelectorAll("[data-account-view]")];
  const authViews = {
    login: document.querySelector("#login-form"),
    signup: document.querySelector("#signup-form"),
    reset: document.querySelector("#reset-form"),
    recovery: document.querySelector("#recovery-form")
  };
  let activeAccountView = new URLSearchParams(window.location.search).get("recovery") === "1"
    ? "recovery"
    : "login";

  const articleLinks = {
    "rag-pipeline": {
      title: "RAG Pipeline Architecture",
      url: "articles/rag-pipeline.html"
    },
    "ai-agents": {
      title: "AI Agents: Tools and Control Loops",
      url: "articles/ai-agents.html"
    },
    "ai-system-design": {
      title: "GenAI System Design",
      url: "articles/ai-system-design.html"
    },
    "agentic-systems-production": {
      title: "Production Agentic AI Systems",
      url: "articles/premium.html"
    }
  };

  function showMessage(element, message, isError = false, isNeutral = false) {
    if (!element) return;
    element.textContent = message;
    element.hidden = !message;
    element.classList.toggle("is-error", isError);
    element.classList.toggle("is-success", Boolean(message) && !isError && !isNeutral);
  }

  function showSiteStatus(message, isError = false) {
    showMessage(siteStatus, message, isError);
  }

  function setAccountView(view) {
    if (!authViews[view]) return;
    activeAccountView = view;
    Object.entries(authViews).forEach(([name, form]) => {
      if (form) form.hidden = name !== activeAccountView;
    });
    accountTabs.forEach(tab => {
      const selected = tab.dataset.accountView === activeAccountView;
      tab.setAttribute("aria-pressed", String(selected));
      tab.classList.toggle("is-active", selected);
    });
    setAccountMessage("");
  }

  accountTabs.forEach(tab => {
    tab.addEventListener("click", () => setAccountView(tab.dataset.accountView));
  });
  setAccountView(activeAccountView);

  function logServiceError(action, error) {
    console.error(`[AI Engineering Journal] ${action} failed.`, {
      code: error?.code || "unknown",
      status: error?.status || "unknown"
    });
  }

  function friendlyAuthError(error) {
    const code = String(error?.code || "").toLowerCase();
    const message = String(error?.message || "").toLowerCase();
    if (code.includes("invalid_credentials") || message.includes("invalid login credentials")) {
      return "We couldn’t sign you in with those details. Check your email and password, then try again.";
    }
    if (code.includes("email_not_confirmed") || message.includes("email not confirmed")) {
      return "Please confirm your email address using the link we sent before signing in.";
    }
    if (code.includes("user_already_exists") || message.includes("already registered")) {
      return "An account may already be registered with this email. Try signing in or resetting your password.";
    }
    if (code.includes("weak_password") || message.includes("password should")) {
      return "Choose a stronger password that meets the account security requirements.";
    }
    if (code.includes("rate_limit") || message.includes("rate limit") || message.includes("too many")) {
      return "Too many attempts were made in a short time. Please wait a moment before trying again.";
    }
    if (code.includes("otp_expired") || message.includes("expired")) {
      return "This link has expired. Request a new email and try again.";
    }
    if (code.includes("invalid_email") || message.includes("email") && message.includes("valid")) {
      return "Enter a valid email address and try again.";
    }
    return "We couldn’t complete that request. Please check your details and try again.";
  }

  function isServerKey(key) {
    if (key.startsWith("sb_secret_")) return true;
    const parts = key.split(".");
    if (parts.length !== 3) return false;
    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      return payload.role === "service_role";
    } catch {
      return false;
    }
  }

  const configIsReady =
    typeof config?.url === "string" &&
    typeof config?.anonKey === "string" &&
    config.url.startsWith("https://") &&
    config.anonKey.length > 20 &&
    !isServerKey(config.anonKey);

  if (!configIsReady || !window.supabase?.createClient) {
    const message = !configIsReady
      ? "Sign-in and saved articles are not available right now. Please try again later."
      : "We couldn’t connect to your account. Please check your connection and try again.";
    showMessage(accountSetupMessage, message, false, true);
    bookmarkButtons.forEach(button => {
      button.disabled = true;
      button.title = "Account services are not currently available";
    });
    document.querySelectorAll("form button[type='submit'], #logout-button")
      .forEach(button => { button.disabled = true; });
    if (premiumMessage) showMessage(premiumMessage, "Member access is temporarily unavailable. Please try again later.", true);
    return;
  }

  const client = window.supabase.createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      persistSession: true
    }
  });
  let currentUser = null;
  let bookmarkedSlugs = new Set();
  let recoveringPassword = activeAccountView === "recovery";
  let loadingBookmarks = false;
  let bookmarkRequest = 0;

  function setAccountMessage(message, isError = false) {
    showMessage(accountStatus, message, isError);
  }

  function renderSavedArticles() {
    if (!savedArticleList || !savedEmpty) return;
    savedArticleList.replaceChildren();

    const articles = [...bookmarkedSlugs]
      .map(slug => ({ slug, article: articleLinks[slug] }))
      .filter(item => item.article);

    savedEmpty.hidden = articles.length > 0;
    savedEmpty.textContent = loadingBookmarks
      ? "Loading your saved articles…"
      : "Your reading list is empty for now. Save an article from any guide to keep it here.";
    articles.forEach(({ slug, article }) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = article.url;
      link.textContent = article.title;
      item.append(link);

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "text-button";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", () => removeBookmark(slug));
      item.append(" ", removeButton);
      savedArticleList.append(item);
    });
  }

  function updateAccountView() {
    if (accountSession) accountSession.hidden = !currentUser || recoveringPassword;
    if (accountEmail && currentUser) accountEmail.textContent = currentUser.email || "Signed-in user";
    Object.entries(authViews).forEach(([name, form]) => {
      if (form) form.hidden = (Boolean(currentUser) && !recoveringPassword) || name !== activeAccountView;
    });
    const authSwitch = document.querySelector(".auth-switch");
    if (authSwitch) authSwitch.hidden = Boolean(currentUser) || recoveringPassword;

    bookmarkButtons.forEach(button => {
      const slug = button.dataset.bookmarkSlug;
      const saved = bookmarkedSlugs.has(slug);
      button.textContent = saved ? "In your reading list · Remove" : "Save to reading list";
      button.setAttribute("aria-pressed", String(saved));
      button.disabled = loadingBookmarks;
    });
    renderSavedArticles();
    if (!currentUser && premiumContent) premiumContent.replaceChildren();
    const premiumSignin = document.querySelector(".premium-signin");
    if (premiumSignin) premiumSignin.hidden = Boolean(currentUser);
    if (!currentUser && premiumMessage) {
      showMessage(premiumMessage, "Sign in to continue reading this guide.", false, true);
    }
  }

  async function loadBookmarks() {
    if (!currentUser) {
      bookmarkedSlugs = new Set();
      loadingBookmarks = false;
      updateAccountView();
      return;
    }

    const userId = currentUser.id;
    const requestId = ++bookmarkRequest;
    loadingBookmarks = true;
    updateAccountView();
    const { data, error } = await client
      .from("bookmarks")
      .select("article_slug")
      .eq("user_id", userId);
    if (requestId !== bookmarkRequest || currentUser?.id !== userId) return;
    loadingBookmarks = false;
    if (error) {
      updateAccountView();
      throw error;
    }

    bookmarkedSlugs = new Set((data || []).map(row => row.article_slug));
    updateAccountView();
  }

  async function loadPremiumArticle() {
    if (!currentUser || !premiumPage || !premiumContent || !premiumMessage) return;
    const userId = currentUser.id;
    showMessage(premiumMessage, "Checking access…");
    premiumContent.replaceChildren();

    let data;
    let error;
    try {
      ({ data, error } = await client
        .from("premium_articles")
        .select("title, excerpt, body")
        .eq("slug", premiumPage.dataset.premiumSlug)
        .eq("published", true)
        .maybeSingle());
    } catch (requestError) {
      if (currentUser?.id !== userId) return;
      logServiceError("Loading the member article", requestError);
      showMessage(premiumMessage, "We couldn’t load this article. Please check your connection and try again.", true);
      return;
    }
    if (currentUser?.id !== userId) return;

    if (error) {
      logServiceError("Loading the member article", error);
      showMessage(premiumMessage, "We couldn’t load this article. Please try again in a moment.", true);
      return;
    }
    if (!data) {
      showMessage(premiumMessage, "This guide isn’t available just yet. Please check back soon.");
      return;
    }

    const heading = document.createElement("h2");
    heading.textContent = data.title;
    premiumContent.append(heading);

    const excerpt = document.createElement("p");
    excerpt.className = "premium-excerpt";
    excerpt.textContent = data.excerpt;
    premiumContent.append(excerpt);

    data.body.split(/\r?\n\s*\r?\n/).filter(Boolean).forEach(text => {
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      premiumContent.append(paragraph);
    });

    showMessage(premiumMessage, "You’re signed in. Enjoy the article.");
    const signin = document.querySelector(".premium-signin");
    if (signin) signin.hidden = true;
  }

  async function removeBookmark(slug) {
    if (!currentUser) return;
    const userId = currentUser.id;
    let error;
    try {
      ({ error } = await client
        .from("bookmarks")
        .delete()
        .eq("user_id", userId)
        .eq("article_slug", slug));
    } catch (requestError) {
      logServiceError("Removing a saved article", requestError);
      showSiteStatus("We couldn’t update your reading list. Please check your connection and try again.", true);
      return;
    }
    if (currentUser?.id !== userId) return;
    if (error) {
      logServiceError("Removing a saved article", error);
      showSiteStatus("We couldn’t remove that article from your reading list. Please try again.", true);
      return;
    }
    bookmarkedSlugs.delete(slug);
    updateAccountView();
    showSiteStatus("Article removed from your reading list.");
  }

  bookmarkButtons.forEach(button => {
    button.addEventListener("click", async () => {
      if (!currentUser) {
        showSiteStatus("Please sign in to save articles to your reading list.");
        return;
      }

      button.disabled = true;
      const slug = button.dataset.bookmarkSlug;
      const userId = currentUser.id;
      let result;
      try {
        result = bookmarkedSlugs.has(slug)
          ? await client.from("bookmarks").delete()
            .eq("user_id", userId).eq("article_slug", slug)
          : await client.from("bookmarks").insert({
            user_id: userId,
            article_slug: slug
          });
      } catch (error) {
        logServiceError("Updating your reading list", error);
        button.disabled = false;
        showSiteStatus("We couldn’t update your reading list. Please check your connection and try again.", true);
        return;
      }
      button.disabled = false;
      if (currentUser?.id !== userId) return;

      if (result.error) {
        logServiceError("Updating your reading list", result.error);
        showSiteStatus("We couldn’t update your reading list. Please try again.", true);
        return;
      }
      if (bookmarkedSlugs.has(slug)) bookmarkedSlugs.delete(slug);
      else bookmarkedSlugs.add(slug);
      updateAccountView();
      showSiteStatus(bookmarkedSlugs.has(slug)
        ? "Article saved to your reading list."
        : "Article removed from your reading list.");
    });
  });

  function handleForm(form, action, pendingLabel) {
    if (!form) return;
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      const originalLabel = submit?.textContent;
      if (submit) {
        submit.disabled = true;
        submit.textContent = pendingLabel;
      }
      form.setAttribute("aria-busy", "true");
      setAccountMessage("");
      const actionName = {
        "signup-form": "Account registration",
        "login-form": "Account sign-in",
        "reset-form": "Password reset",
        "recovery-form": "Password update"
      }[form.id] || "Account request";

      try {
        const result = await action(new FormData(form));
        if (result.error) {
          logServiceError(actionName, result.error);
          setAccountMessage(friendlyAuthError(result.error), true);
        } else if (result.message) {
          setAccountMessage(result.message);
          form.reset();
        }
      } catch (error) {
        logServiceError(actionName, error);
        setAccountMessage("We couldn’t complete your request. Please check your connection and try again.", true);
      } finally {
        form.removeAttribute("aria-busy");
        if (submit) {
          submit.disabled = false;
          submit.textContent = originalLabel;
        }
      }
    }, "Creating account…");
  }

  handleForm(signupForm, async formData => {
    const { data, error } = await client.auth.signUp({
      email: String(formData.get("email")).trim(),
      password: String(formData.get("password")),
      options: { emailRedirectTo: new URL("account.html", document.baseURI).href }
    }, "Signing in…");
    if (error) return { error };
    return {
      message: data.session
        ? "Your account is ready. You’re signed in."
        : "Your account request is complete. Check your email for a confirmation link before signing in."
    };
  }, "Sending instructions…");

  handleForm(loginForm, async formData => {
    const { error } = await client.auth.signInWithPassword({
      email: String(formData.get("email")).trim(),
      password: String(formData.get("password"))
    });
    return { error, message: error ? "" : "You’re signed in. Your reading list is ready." };
  });

  handleForm(resetForm, async formData => {
    const redirectTo = new URL("account.html?recovery=1", document.baseURI).href;
    const { error } = await client.auth.resetPasswordForEmail(
      String(formData.get("email")).trim(),
      { redirectTo }
    );
    return {
      error,
      message: error ? "" : "If an account matches that email, password reset instructions are on their way."
    };
  });

  handleForm(recoveryForm, async formData => {
    const { error } = await client.auth.updateUser({
      password: String(formData.get("password"))
    });
    if (!error) {
      recoveringPassword = false;
      setAccountView("login");
      window.history.replaceState(null, "", window.location.pathname);
      updateAccountView();
    }
    return { error, message: error ? "" : "Your password has been updated. You can continue to your account." };
  }, "Updating password…");

  document.querySelector("#logout-button")?.addEventListener("click", async event => {
    event.currentTarget.disabled = true;
    let error;
    try {
      ({ error } = await client.auth.signOut());
    } catch (requestError) {
      logServiceError("Signing out", requestError);
      setAccountMessage("We couldn’t sign you out. Please check your connection and try again.", true);
      event.currentTarget.disabled = false;
      return;
    }
    event.currentTarget.disabled = false;
    if (error) {
      logServiceError("Signing out", error);
      setAccountMessage("We couldn’t sign you out. Please try again.", true);
      return;
    }
    setAccountMessage("You’ve signed out securely.");
  });

  client.auth.onAuthStateChange((event, session) => {
    const nextUser = session?.user || null;
    if (currentUser?.id !== nextUser?.id) {
      bookmarkRequest++;
      bookmarkedSlugs = new Set();
      loadingBookmarks = false;
    }
    currentUser = nextUser;
    if (event === "PASSWORD_RECOVERY") {
      recoveringPassword = true;
      activeAccountView = "recovery";
    }
    updateAccountView();
    window.setTimeout(() => {
      loadBookmarks().catch(error => {
        logServiceError("Loading your reading list", error);
        showSiteStatus("We couldn’t load your reading list. Please refresh the page or try again shortly.", true);
      });
      if (currentUser && premiumPage) loadPremiumArticle();
    }, 0);
  });
})();
