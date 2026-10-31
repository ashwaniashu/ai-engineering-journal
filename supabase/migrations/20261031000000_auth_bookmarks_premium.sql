create table public.bookmarks (
  user_id uuid not null references auth.users (id) on delete cascade,
  article_slug text not null check (article_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  primary key (user_id, article_slug)
);

alter table public.bookmarks enable row level security;

revoke all on table public.bookmarks from public, anon, authenticated;
grant select, insert, delete on table public.bookmarks to authenticated;

create policy "Users read their own bookmarks"
  on public.bookmarks
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users add their own bookmarks"
  on public.bookmarks
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users remove their own bookmarks"
  on public.bookmarks
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create index bookmarks_article_slug_idx on public.bookmarks (article_slug);

create table public.premium_articles (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  excerpt text not null,
  body text not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.premium_articles enable row level security;

revoke all on table public.premium_articles from public, anon, authenticated;
grant select on public.premium_articles to authenticated;

create policy "Authenticated users read published premium articles"
  on public.premium_articles
  for select
  to authenticated
  using ((select auth.uid()) is not null and published = true);
