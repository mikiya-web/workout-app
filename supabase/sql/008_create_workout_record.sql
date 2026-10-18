begin;

create function public.create_workout_record(
  p_id uuid,
  p_date date,
  p_exercise_id uuid,
  p_expected_exercise_revision integer,
  p_memo text,
  p_sets jsonb,
  p_body_weight double precision,
  p_expected_daily_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_exercise public.exercises%rowtype;
  v_record public.workout_records%rowtype;
  v_daily_info public.daily_infos%rowtype;

  v_item jsonb;
  v_set_id uuid;
  v_weight double precision;
  v_reps numeric;
  v_order integer := 0;
  v_seen_ids uuid[] := array[]::uuid[];

  v_normalized_sets jsonb := '[]'::jsonb;
  v_existing_sets jsonb;
  v_saved_sets jsonb;
begin
  if v_user_id is null then
    raise exception 'ログインが必要です。'
      using errcode = '42501';
  end if;

  if p_id is null or p_exercise_id is null then
    raise exception '記録IDと種目IDが必要です。'
      using errcode = '22023';
  end if;

  if p_date is null
    or p_date < date '0001-01-01'
    or p_date > date '9999-12-31'
  then
    raise exception '実在する正しい日付を選んでください。'
      using errcode = '22023';
  end if;

  if p_memo is null then
    raise exception 'メモは文字列で送信してください。空文字は使用できます。'
      using errcode = '22023';
  end if;

  if p_expected_exercise_revision is null
    or p_expected_exercise_revision < 1
    or p_expected_daily_revision is null
    or p_expected_daily_revision < 0
  then
    raise exception '正しい更新番号が必要です。'
      using errcode = '22023';
  end if;

  if p_body_weight is not null
    and not (
      p_body_weight > 0
      and p_body_weight < 'Infinity'::double precision
    )
  then
    raise exception '体重は0より大きい有限数値で入力してください。'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_sets) is distinct from 'array' then
    raise exception 'セットは配列で送信してください。'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_sets) < 1 then
    raise exception '最低1セット必要です。'
      using errcode = '22023';
  end if;

  -- 全セットを検証し、比較・保存に使う形へそろえる
  for v_item in
    select value from jsonb_array_elements(p_sets)
  loop
    if jsonb_typeof(v_item) is distinct from 'object' then
      raise exception 'セットの形式が正しくありません。'
        using errcode = '22023';
    end if;

    if jsonb_typeof(v_item -> 'id') is distinct from 'string'
      or jsonb_typeof(v_item -> 'weight') is distinct from 'number'
      or jsonb_typeof(v_item -> 'reps') is distinct from 'number'
    then
      raise exception '各セットのID・重量・回数が必要です。'
        using errcode = '22023';
    end if;

    v_set_id := (v_item ->> 'id')::uuid;
    v_weight := (v_item ->> 'weight')::double precision;
    v_reps := (v_item ->> 'reps')::numeric;

    if v_set_id = any(v_seen_ids) then
      raise exception '同じ記録内でセットIDが重複しています。'
        using errcode = '22023';
    end if;

    if not (
      v_weight >= 0
      and v_weight < 'Infinity'::double precision
    ) then
      raise exception '重量は0以上の有限数値で入力してください。'
        using errcode = '22023';
    end if;

    if v_reps < 1
      or v_reps > 2147483647
      or v_reps <> trunc(v_reps)
    then
      raise exception '回数は1以上の保存可能な整数で入力してください。'
        using errcode = '22023';
    end if;

    v_seen_ids := array_append(v_seen_ids, v_set_id);
    v_order := v_order + 1;

    v_normalized_sets := v_normalized_sets || jsonb_build_array(
      jsonb_build_object(
        'id', v_set_id,
        'weight', v_weight,
        'reps', v_reps::integer,
        'set_order', v_order
      )
    );
  end loop;

  -- 既存の追加・編集・削除と同じ順番でロックする
  perform 1
  from public.user_settings
  where user_id = v_user_id
    and initialized_at is not null
  for update;

  if not found then
    raise exception '初期データの準備が完了していません。';
  end if;

  -- 同じ記録IDでの再試行か確認する
  select *
  into v_record
  from public.workout_records
  where id = p_id
    and user_id = v_user_id
  for update;

  if found then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'weight', s.weight,
          'reps', s.reps,
          'set_order', s.set_order
        )
        order by s.set_order
      ),
      '[]'::jsonb
    )
    into v_existing_sets
    from public.workout_sets s
    where s.user_id = v_user_id
      and s.record_id = p_id;

    if v_record.revision <> 1
      or v_record.date is distinct from p_date
      or v_record.exercise_id is distinct from p_exercise_id
      or v_record.memo is distinct from p_memo
      or v_existing_sets is distinct from v_normalized_sets
    then
      raise exception
        '同じ記録IDの保存内容が変わっています。一覧を確認してください。'
        using errcode = 'P0001';
    end if;

    select *
    into v_daily_info
    from public.daily_infos
    where user_id = v_user_id
      and date = p_date;

    if not found then
      raise exception '保存済み記録の日付情報が見つかりません。';
    end if;

    -- 保存後に体重が変更されていたら、元の値へ戻さない
    if v_daily_info.body_weight is distinct from p_body_weight then
      raise exception
        '記録は保存済みですが、その日の体重が変更されています。一覧と体重を読み直してください。'
        using errcode = 'P0001';
    end if;

  else
    -- 新規保存時は、現在の種目設定と更新番号を確認する
    select *
    into v_exercise
    from public.exercises
    where id = p_exercise_id
      and user_id = v_user_id
    for update;

    if not found then
      raise exception '選択した種目が見つかりません。'
        using errcode = 'P0002';
    end if;

    if v_exercise.revision <> p_expected_exercise_revision then
      raise exception
        '選択した種目が別の画面で更新されています。最新データを読み直してください。'
        using errcode = 'P0001';
    end if;

    if v_exercise.uses_body_weight and p_body_weight is null then
      raise exception 'この種目を記録するには、その日の体重が必要です。'
        using errcode = '22023';
    end if;

    -- 他の自重記録に必要な体重を空欄にさせない
    if p_body_weight is null and exists (
      select 1
      from public.workout_records
      where user_id = v_user_id
        and date = p_date
        and uses_body_weight
    ) then
      raise exception
        'この日の自重種目の記録があるため、体重を空欄にはできません。'
        using errcode = '22023';
    end if;

    -- 既存の体重保存関数を使う。更新競合もここで確認する
    perform public.save_daily_info(
      p_date,
      p_body_weight,
      p_expected_daily_revision
    );

    insert into public.workout_records (
      id,
      user_id,
      date,
      exercise_id,
      memo,
      uses_body_weight
    )
    values (
      p_id,
      v_user_id,
      p_date,
      p_exercise_id,
      p_memo,
      v_exercise.uses_body_weight
    )
    returning * into v_record;

    insert into public.workout_sets (
      id,
      user_id,
      record_id,
      set_order,
      weight,
      reps
    )
    select
      (item ->> 'id')::uuid,
      v_user_id,
      p_id,
      (item ->> 'set_order')::integer,
      (item ->> 'weight')::double precision,
      (item ->> 'reps')::integer
    from jsonb_array_elements(v_normalized_sets) as sets(item);

    select *
    into v_daily_info
    from public.daily_infos
    where user_id = v_user_id
      and date = p_date;
  end if;

  -- 遅延していた体重との関係を、戻り値を作る前に確認する
  set constraints
    public.workout_records_daily_info_fk,
    public.workout_records_body_weight_fk
    immediate;

  set constraints
    public.workout_records_daily_info_fk,
    public.workout_records_body_weight_fk
    deferred;

  select coalesce(
    jsonb_agg(to_jsonb(s) order by s.set_order),
    '[]'::jsonb
  )
  into v_saved_sets
  from public.workout_sets s
  where s.user_id = v_user_id
    and s.record_id = p_id;

  return jsonb_build_object(
    'record', to_jsonb(v_record),
    'sets', v_saved_sets,
    'daily_info', to_jsonb(v_daily_info)
  );

exception
  when unique_violation then
    raise exception
      '同じ日付・種目の記録、または同じ記録ID・セットIDが登録されています。'
      using errcode = '23505';

  when foreign_key_violation then
    raise exception
      '種目・日付・体重の関係を確認できません。最新データを読み直してください。'
      using errcode = '23503';

  when invalid_text_representation then
    raise exception 'IDまたは数値の形式が正しくありません。'
      using errcode = '22023';

  when numeric_value_out_of_range then
    raise exception '数値が保存可能な範囲を超えています。'
      using errcode = '22023';
end;
$$;

revoke execute on function public.create_workout_record(
  uuid, date, uuid, integer, text, jsonb, double precision, integer
)
  from public, anon, authenticated;

grant execute on function public.create_workout_record(
  uuid, date, uuid, integer, text, jsonb, double precision, integer
)
  to authenticated;

commit;