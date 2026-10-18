begin;

-- 分類を追加する
create function public.create_sub_category(
  p_id uuid,
  p_name text,
  p_body_part text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(p_name);
  v_category public.sub_categories%rowtype;
begin
  if v_user_id is null then
    raise exception 'ログインが必要です。'
      using errcode = '42501';
  end if;

  if p_id is null or v_name is null or v_name = '' then
    raise exception '分類名と追加操作のIDが必要です。'
      using errcode = '22023';
  end if;

  -- 初期登録済みの本人の管理行をロックする
  perform 1
  from public.user_settings
  where user_id = v_user_id
    and initialized_at is not null
  for update;

  if not found then
    raise exception '初期データの準備が完了していません。';
  end if;

  -- 同じIDでの再試行なら、保存済みの結果を返す
  select *
  into v_category
  from public.sub_categories
  where id = p_id
    and user_id = v_user_id;

  if found then
    if v_category.name is distinct from v_name
      or v_category.body_part is distinct from p_body_part
    then
      raise exception
        '同じ追加操作の内容が変わっています。一覧を確認してください。';
    end if;

    return to_jsonb(v_category);
  end if;

  insert into public.sub_categories (
    id,
    user_id,
    name,
    body_part
  )
  values (
    p_id,
    v_user_id,
    v_name,
    p_body_part
  )
  returning * into v_category;

  return to_jsonb(v_category);

exception
  when unique_violation then
    raise exception '同じ部位に同名の分類、または同じIDが登録されています。'
      using errcode = '23505';
end;
$$;

-- 種目を追加する
create function public.create_exercise(
  p_id uuid,
  p_name text,
  p_body_part text,
  p_sub_category_id uuid,
  p_uses_body_weight boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(p_name);
  v_exercise public.exercises%rowtype;
begin
  if v_user_id is null then
    raise exception 'ログインが必要です。'
      using errcode = '42501';
  end if;

  if p_id is null or v_name is null or v_name = '' then
    raise exception '種目名と追加操作のIDが必要です。'
      using errcode = '22023';
  end if;

  -- 初期登録済みの本人の管理行をロックする
  perform 1
  from public.user_settings
  where user_id = v_user_id
    and initialized_at is not null
  for update;

  if not found then
    raise exception '初期データの準備が完了していません。';
  end if;

  -- 同じIDでの再試行なら、保存済みの結果を返す
  select *
  into v_exercise
  from public.exercises
  where id = p_id
    and user_id = v_user_id;

  if found then
    if v_exercise.name is distinct from v_name
      or v_exercise.body_part is distinct from p_body_part
      or v_exercise.sub_category_id is distinct from p_sub_category_id
      or v_exercise.uses_body_weight is distinct from p_uses_body_weight
    then
      raise exception
        '同じ追加操作の内容が変わっています。一覧を確認してください。';
    end if;

    return to_jsonb(v_exercise);
  end if;

  insert into public.exercises (
    id,
    user_id,
    name,
    body_part,
    sub_category_id,
    uses_body_weight
  )
  values (
    p_id,
    v_user_id,
    v_name,
    p_body_part,
    p_sub_category_id,
    p_uses_body_weight
  )
  returning * into v_exercise;

  return to_jsonb(v_exercise);

exception
  when unique_violation then
    raise exception '同名の種目、または同じIDが登録されています。'
      using errcode = '23505';

  when foreign_key_violation then
    raise exception '選択した分類が存在しないか、持ち主・部位が一致しません。'
      using errcode = '23503';
end;
$$;

-- 関数を呼べるのはログイン済みユーザーだけ
revoke execute on function public.create_sub_category(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.create_sub_category(uuid, text, text)
  to authenticated;

revoke execute on function public.create_exercise(
  uuid, text, text, uuid, boolean
)
  from public, anon, authenticated;

grant execute on function public.create_exercise(
  uuid, text, text, uuid, boolean
)
  to authenticated;

commit;