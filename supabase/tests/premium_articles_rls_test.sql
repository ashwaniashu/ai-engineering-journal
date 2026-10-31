begin;
select plan(9);

insert into auth.users (id, email)
values ('33333333-3333-3333-3333-333333333333', 'premium-test@example.test');

insert into public.premium_articles (slug, title, excerpt, body, published)
values
  ('rls-test-published', 'RLS test article', 'Test excerpt', 'RLS test body', true),
  ('rls-test-unpublished', 'Unpublished test article', 'Test excerpt', 'Unpublished test body', false);

set local role anon;
select throws_ok(
  $$select body from public.premium_articles$$,
  '42501',
  null,
  'anonymous users cannot read premium article rows'
);
select throws_ok(
  $$insert into public.premium_articles (slug, title, excerpt, body)
    values ('anonymous-test', 'Test', 'Test', 'Test')$$,
  '42501',
  null,
  'anonymous users cannot insert premium articles'
);
select throws_ok(
  $$update public.premium_articles set published = false$$,
  '42501',
  null,
  'anonymous users cannot update premium articles'
);
select throws_ok(
  $$delete from public.premium_articles$$,
  '42501',
  null,
  'anonymous users cannot delete premium articles'
);

set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select results_eq(
  $$select body from public.premium_articles where slug = 'rls-test-published'$$,
  array['RLS test body'],
  'signed-in users can read published premium content'
);
select is_empty(
  $$select body from public.premium_articles where slug = 'rls-test-unpublished'$$,
  'signed-in users cannot read unpublished premium content'
);
select throws_ok(
  $$insert into public.premium_articles (slug, title, excerpt, body)
    values ('authenticated-test', 'Test', 'Test', 'Test')$$,
  '42501',
  null,
  'signed-in users cannot insert premium articles'
);
select throws_ok(
  $$update public.premium_articles set published = false$$,
  '42501',
  null,
  'signed-in users cannot update premium articles'
);
select throws_ok(
  $$delete from public.premium_articles$$,
  '42501',
  null,
  'signed-in users cannot delete premium articles'
);

select * from finish();
rollback;
