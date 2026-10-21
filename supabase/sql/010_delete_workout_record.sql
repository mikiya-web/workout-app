begin;

create function public.delete_workout_record(
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
  v_record public.workout_records%rowtype;
begin
  if v_user_id is null then
    raise exception 'ログインが必要です。'
      using errcode = '42501';
  end if;

  if p_id is null
    or p_expected_revision is null
    or p_expected_revision < 1
  then
    raise exception '記録IDと正しい更新番号が必要です。'
      using errcode = '22023';
  end if;

  -- 他の保存処理と同じ順番で、本人の管理行をロックする
  perform 1
  from public.user_settings
  where user_id = v_user_id
    and initialized_at is not null
  for update;

  if not found then
    raise exception '初期データの準備が完了していません。';
  end if;

  select *
  into v_record
  from public.workout_records
  where id = p_id
    and user_id = v_user_id
  for update;

  -- 本人の対象記録がなければ、削除済みとして扱う
  -- 他人の記録の有無は知らせず、変更もしない
  if not found then
    return jsonb_build_object(
      'id', p_id,
      'deleted', true
    );
  end if;

  if v_record.revision <> p_expected_revision then
    raise exception
      'この記録は別の画面で更新されています。最新データを読み直してから削除してください。'
      using errcode = 'P0001';
  end if;

  -- 所属するセットは外部キーのON DELETE CASCADEで削除される
  -- 日別体重は削除しない
  delete from public.workout_records
  where id = p_id
    and user_id = v_user_id
    and revision = p_expected_revision
  returning * into v_record;

  if not found then
    raise exception
      '記録の状態が変わっています。最新データを読み直してください。'
      using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'id', p_id,
    'deleted', true
  );
end;
$$;

revoke execute on function public.delete_workout_record(
  uuid, integer
)
  from public, anon, authenticated;

grant execute on function public.delete_workout_record(
  uuid, integer
)
  to authenticated;

commit;