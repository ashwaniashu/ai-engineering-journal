begin;
select plan(13);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'bookmark-owner@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'bookmark-other@example.test');

insert into public.bookmarks (user_id, article_slug)
values ('22222222-2222-2222-2222-222222222222', 'other-users-bookmark');

set local role anon;
select throws_ok(
  $$select * from public.bookmarks$$,
  '42501',
  null,
  'anonymous users cannot read bookmarks'
);
select throws_ok(
  $$insert into public.bookmarks (user_id, article_slug)
    values ('11111111-1111-1111-1111-111111111111', 'anonymous-bookmark')$$,
  '42501',
  null,
  'anonymous users cannot create bookmarks'
);
select throws_ok(
  $$update public.bookmarks set article_slug = 'changed-bookmark'$$,
  '42501',
  null,
  'anonymous users cannot update bookmarks'
);
select throws_ok(
  $$delete from public.bookmarks$$,
  '42501',
  null,
  'anonymous users cannot delete bookmarks'
);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select results_eq(
  $$insert into public.bookmarks (user_id, article_slug)
    values ('11111111-1111-1111-1111-111111111111', 'owners-bookmark')
    returning article_slug$$,
  array['owners-bookmark'],
  'a user can create their own bookmark'
);
select results_eq(
  $$select article_slug from public.bookmarks
    where article_slug = 'owners-bookmark'$$,
  array['owners-bookmark'],
  'a user can read their own bookmark'
);
select throws_ok(
  $$insert into public.bookmarks (user_id, article_slug)
    values ('22222222-2222-2222-2222-222222222222', 'spoofed-bookmark')$$,
  '42501',
  null,
  'a user cannot create a bookmark for another user'
);
select is_empty(
  $$select article_slug from public.bookmarks
    where article_slug = 'other-users-bookmark'$$,
  'a user cannot read another users bookmark'
);

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select is_empty(
  $$select article_slug from public.bookmarks
    where article_slug = 'owners-bookmark'$$,
  'another user cannot read the owners bookmark'
);
select is_empty(
  $$delete from public.bookmarks
    where user_id = '11111111-1111-1111-1111-111111111111'
      and article_slug = 'owners-bookmark'
    returning article_slug$$,
  'another user cannot delete the owners bookmark'
);
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select results_eq(
  $$select article_slug from public.bookmarks
    where article_slug = 'owners-bookmark'$$,
  array['owners-bookmark'],
  'the denied delete leaves the owners bookmark intact'
);
select results_eq(
  $$delete from public.bookmarks
    where article_slug = 'owners-bookmark'
    returning article_slug$$,
  array['owners-bookmark'],
  'a user can remove their own bookmark'
);
select throws_ok(
  $$update public.bookmarks set article_slug = 'updated-bookmark'$$,
  '42501',
  null,
  'signed-in users cannot update bookmarks'
);

select * from finish();
rollback;
