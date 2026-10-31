AI Engineering Journal — site maintenance

This repository is the source for the GitHub Pages site:
https://ashwaniashu.github.io/ai-engineering-journal/

Account, bookmarks, premium content, and Supabase setup instructions are
documented in SUPABASE-SETUP.md. Do not publish a Supabase service-role/secret
key; only the project's publishable/anon key belongs in supabase-config.js.

Published pages:
- index.html: journal homepage and author information for Ashwani Ashu.
- articles/rag-pipeline.html: RAG pipeline architecture.
- articles/ai-agents.html: AI agent tools, state, and control loops.
- articles/ai-system-design.html: production GenAI system design.

When publishing a page:
1. Give it a distinct, accurate title, description, H1, canonical URL, and visible author attribution.
2. Link it from a relevant existing page and add useful contextual links to related guides.
3. Keep JSON-LD consistent with visible content; do not add unsupported dates, credentials, or author claims.
4. Add its canonical URL to sitemap.xml and check its links, metadata, structured data, and mobile layout.
5. Push the changes to the GitHub Pages deployment branch and confirm the published page loads.

robots.txt currently permits crawling and references sitemap.xml. Submit the sitemap in
Google Search Console after verifying the site property. Search indexing and rankings
are determined by Google and are not guaranteed by repository changes.
