begin;

-- 本人の種目を、更新番号を確認して編集する
create function public.update_exercise(
  p_id uuid,
  p_expected_revision integer,
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

  if p_id is null
    or p_expected_revision is null
    or p_expected_revision < 1
  then
    raise exception '種目IDと正しい更新番号が必要です。'
      using errcode = '22023';
  end if;

  if v_name is null or v_name = '' then
    raise exception '種目名を入力してください。'
      using errcode = '22023';
  end if;

  if p_body_part is null
    or p_body_part not in (
      'chest', 'back', 'shoulders', 'biceps',
      'triceps', 'legs', 'abs', 'other'
    )
  then
    raise exception '正しい部位を選んでください。'
      using errcode = '22023';
  end if;

  if p_uses_body_weight is null then
    raise exception '体重を含める設定が必要です。'
      using errcode = '22023';
  end if;

  -- 追加処理と同じ順番で、本人の管理行をロックする
  perform 1
  from public.user_settings
  where user_id = v_user_id
    and initialized_at is not null
  for update;

  if not found then
    raise exception '初期データの準備が完了していません。';
  end if;

  -- 本人の種目だけを取得し、確認から更新までロックする
  select *
  into v_exercise
  from public.exercises
  where id = p_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception '編集できる種目が見つかりません。一覧を確認してください。'
      using errcode = 'P0002';
  end if;

  if v_exercise.revision <> p_expected_revision then
    -- 直前の保存と同じ状態なら、再更新せず結果だけ返す
    -- bigintへの変換は、比較時の整数の桁あふれを避けるため
    if v_exercise.revision::bigint =
        p_expected_revision::bigint + 1
      and v_exercise.name is not distinct from v_name
      and v_exercise.body_part is not distinct from p_body_part
      and v_exercise.sub_category_id is not distinct from p_sub_category_id
      and v_exercise.uses_body_weight is not distinct from p_uses_body_weight
    then
      return to_jsonb(v_exercise);
    end if;

    raise exception
      'この種目は別の画面で更新されています。入力内容を控え、最新データを読み直してから編集してください。'
      using errcode = 'P0001';
  end if;

  -- 分類が本人のもので、選択した部位と一致するか確認する
  if p_sub_category_id is not null then
    perform 1
    from public.sub_categories
    where id = p_sub_category_id
      and user_id = v_user_id
      and body_part = p_body_part;

    if not found then
      raise exception
        '選択した分類が存在しないか、持ち主・部位が一致しません。'
        using errcode = '23503';
    end if;
  end if;

  update public.exercises
  set
    name = v_name,
    body_part = p_body_part,
    sub_category_id = p_sub_category_id,
    uses_body_weight = p_uses_body_weight,
    revision = revision + 1
  where id = p_id
    and user_id = v_user_id
    and revision = p_expected_revision
  returning * into v_exercise;

  if not found then
    raise exception
      'この種目は更新されています。最新データを読み直してください。'
      using errcode = 'P0001';
  end if;

  return to_jsonb(v_exercise);

exception
  when unique_violation then
    raise exception '同じ名前の種目が登録されています。'
      using errcode = '23505';

  when foreign_key_violation then
    raise exception
      '選択した分類が存在しないか、持ち主・部位が一致しません。'
      using errcode = '23503';
end;
$$;

-- テーブルへの直接のUPDATE権限は与えず、関数経由で更新する
revoke execute on function public.update_exercise(
  uuid, integer, text, text, uuid, boolean
)
  from public, anon, authenticated;

grant execute on function public.update_exercise(
  uuid, integer, text, text, uuid, boolean
)
  to authenticated;

commit;