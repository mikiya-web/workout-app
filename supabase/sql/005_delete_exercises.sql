begin;

-- 本人の種目を、更新番号を確認して削除する
create function public.delete_exercise(
  p_id uuid,
  p_expected_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
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

  -- 追加・編集と同じ順番で、本人の管理行をロックする
  perform 1
  from public.user_settings
  where user_id = v_user_id
    and initialized_at is not null
  for update;

  if not found then
    raise exception '初期データの準備が完了していません。';
  end if;

  -- 本人の種目だけを取得する
  select *
  into v_exercise
  from public.exercises
  where id = p_id
    and user_id = v_user_id
  for update;

  -- 再試行時にすでに削除済みなら、完了として返す
  -- 他人の種目の存在は調べず、変更もしない
  if not found then
    return jsonb_build_object(
      'id', p_id,
      'deleted', true
    );
  end if;

  if v_exercise.revision <> p_expected_revision then
    raise exception
      'この種目は別の画面で更新されています。最新データを読み直してから削除してください。'
      using errcode = 'P0001';
  end if;

  delete from public.exercises
  where id = p_id
    and user_id = v_user_id
    and revision = p_expected_revision;

  if not found then
    raise exception
      '種目の状態が変わっています。最新データを読み直してください。'
      using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'id', p_id,
    'deleted', true
  );

exception
  when foreign_key_violation then
    raise exception
      'この種目は他のデータから参照されているため削除できません。'
      using errcode = '23503';
end;
$$;

-- テーブルへの直接のDELETE権限は与えず、関数経由で削除する
revoke execute on function public.delete_exercise(uuid, integer)
  from public, anon, authenticated;

grant execute on function public.delete_exercise(uuid, integer)
  to authenticated;

commit;