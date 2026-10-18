begin;

-- ユーザーごとの初期登録完了状態
create table public.user_settings (
  user_id uuid primary key
    references auth.users(id) on delete cascade,

  initialized_at timestamptz
);

alter table public.user_settings enable row level security;

revoke all on table public.user_settings
  from public, anon, authenticated;

grant select on table public.user_settings to authenticated;

create policy user_settings_select_own
  on public.user_settings
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- ログイン中の本人の初期データを登録する
create function public.initialize_user_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_initialized_at timestamptz;
begin
  -- 未ログインの呼び出しは拒否する
  if v_user_id is null then
    raise exception 'ログインが必要です。'
      using errcode = '42501';
  end if;

  -- 管理行を用意する。同時に呼ばれても1行だけ作る
  insert into public.user_settings (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  -- 同じユーザーの初期登録を同時に進めないようにする
  select initialized_at
  into v_initialized_at
  from public.user_settings
  where user_id = v_user_id
  for update;

  -- 登録済みなら何も追加しない
  if v_initialized_at is not null then
    return;
  end if;

  -- 分類13件
  insert into public.sub_categories (
    user_id,
    name,
    body_part
  )
  values
    (v_user_id, '上部', 'chest'),
    (v_user_id, '中部', 'chest'),
    (v_user_id, '下部', 'chest'),
    (v_user_id, '広がり', 'back'),
    (v_user_id, '厚み', 'back'),
    (v_user_id, 'フロント', 'shoulders'),
    (v_user_id, 'サイド', 'shoulders'),
    (v_user_id, 'リア', 'shoulders'),
    (v_user_id, '四頭筋', 'legs'),
    (v_user_id, 'ハムストリングス', 'legs'),
    (v_user_id, 'お尻', 'legs'),
    (v_user_id, '内もも', 'legs'),
    (v_user_id, 'ふくらはぎ', 'legs');

  -- 種目7件。登録した本人の分類と紐付ける
  insert into public.exercises (
    user_id,
    name,
    body_part,
    sub_category_id,
    uses_body_weight
  )
  select
    v_user_id,
    initial.name,
    initial.body_part,
    category.id,
    initial.uses_body_weight
  from (
    values
      ('ベンチプレス', 'chest', null::text, false),
      ('懸垂', 'back', '広がり', true),
      ('サイドレイズ', 'shoulders', 'サイド', false),
      ('ダンベルカール', 'biceps', null::text, false),
      ('ケーブルプレスダウン', 'triceps', null::text, false),
      ('スクワット', 'legs', '四頭筋', false),
      ('アブドミナルクランチ（マシン）', 'abs', null::text, false)
  ) as initial (
    name,
    body_part,
    sub_category_name,
    uses_body_weight
  )
  left join public.sub_categories as category
    on category.user_id = v_user_id
    and category.body_part = initial.body_part
    and category.name = initial.sub_category_name;

  -- 全件登録できた場合だけ、完了日時を記録する
  update public.user_settings
  set initialized_at = now()
  where user_id = v_user_id;
end;
$$;

-- この関数はログイン済みユーザーだけ呼べる
revoke execute on function public.initialize_user_data()
  from public, anon, authenticated;

grant execute on function public.initialize_user_data()
  to authenticated;

commit;