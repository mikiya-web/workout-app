begin;

-- 分類
create table public.sub_categories (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id) on delete cascade,

  name text not null,

  body_part text not null,

  constraint sub_categories_name_check
    check (name = btrim(name) and name <> ''),

  constraint sub_categories_body_part_check
    check (
      body_part in (
        'chest', 'back', 'shoulders', 'biceps',
        'triceps', 'legs', 'abs', 'other'
      )
    ),

  -- 同じユーザー・部位内で分類名を重複させない
  constraint sub_categories_name_unique
    unique (user_id, body_part, name),

  -- 種目から、持ち主・分類ID・部位をまとめて参照するため
  constraint sub_categories_owner_id_body_unique
    unique (user_id, id, body_part)
);

-- 種目
create table public.exercises (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id) on delete cascade,

  name text not null,

  body_part text not null,

  sub_category_id uuid,

  uses_body_weight boolean not null default false,

  revision integer not null default 1,

  constraint exercises_name_check
    check (name = btrim(name) and name <> ''),

  constraint exercises_body_part_check
    check (
      body_part in (
        'chest', 'back', 'shoulders', 'biceps',
        'triceps', 'legs', 'abs', 'other'
      )
    ),

  constraint exercises_revision_check
    check (revision >= 1),

  -- 同じユーザー内で種目名を重複させない
  constraint exercises_name_unique
    unique (user_id, name),

  -- 後で記録から、持ち主と種目IDをまとめて参照するため
  constraint exercises_owner_id_unique
    unique (user_id, id),

  -- 分類が同じユーザーのもので、部位も一致することを保証する
  -- sub_category_idがnullなら、分類なしとして許可する
  constraint exercises_sub_category_fk
    foreign key (user_id, sub_category_id, body_part)
    references public.sub_categories (user_id, id, body_part)
);

-- 分類を参照する種目を検索するための索引
create index exercises_sub_category_idx
  on public.exercises (user_id, sub_category_id, body_part);

-- 行単位のアクセス制限を有効にする
alter table public.sub_categories enable row level security;
alter table public.exercises enable row level security;

-- アプリからの権限は、まず読み取りだけ許可する
revoke all on table public.sub_categories
  from public, anon, authenticated;

revoke all on table public.exercises
  from public, anon, authenticated;

grant select on table public.sub_categories to authenticated;
grant select on table public.exercises to authenticated;

-- ログイン中のユーザー自身の分類だけ読める
create policy sub_categories_select_own
  on public.sub_categories
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- ログイン中のユーザー自身の種目だけ読める
create policy exercises_select_own
  on public.exercises
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

commit;