begin;

-- ユーザーごと・日付ごとの体重
create table public.daily_infos (
  user_id uuid not null
    references auth.users(id) on delete cascade,

  date date not null,

  body_weight double precision,

  revision integer not null default 1,

  constraint daily_infos_pk
    primary key (user_id, date),

  constraint daily_infos_date_check
    check (
      date >= date '0001-01-01'
      and date <= date '9999-12-31'
    ),

  -- null、または0より大きい有限数値だけを許可する
  constraint daily_infos_body_weight_check
    check (
      body_weight is null
      or (
        body_weight > 0
        and body_weight < 'Infinity'::double precision
      )
    ),

  constraint daily_infos_revision_check
    check (revision >= 1)
);

alter table public.daily_infos enable row level security;

-- アプリからの直接操作は読み取りだけ
revoke all on table public.daily_infos
  from public, anon, authenticated;

grant select on table public.daily_infos to authenticated;

create policy daily_infos_select_own
  on public.daily_infos
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- 日付別体重を追加、または更新する
-- p_expected_revision = 0 は「読み込み時にその日の行がなかった」
create function public.save_daily_info(
  p_date date,
  p_body_weight double precision,
  p_expected_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_daily_info public.daily_infos%rowtype;
begin
  if v_user_id is null then
    raise exception 'ログインが必要です。'
      using errcode = '42501';
  end if;

  if p_date is null
    or p_date < date '0001-01-01'
    or p_date > date '9999-12-31'
  then
    raise exception '実在する正しい日付を選んでください。'
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

  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception '正しい更新番号が必要です。'
      using errcode = '22023';
  end if;

  -- 同じユーザーの追加・編集を順番に処理する
  -- 日付の行がまだない場合の同時追加も、このロックで調整する
  perform 1
  from public.user_settings
  where user_id = v_user_id
    and initialized_at is not null
  for update;

  if not found then
    raise exception '初期データの準備が完了していません。';
  end if;

  select *
  into v_daily_info
  from public.daily_infos
  where user_id = v_user_id
    and date = p_date
  for update;

  if not found then
    if p_expected_revision <> 0 then
      raise exception
        '日付別体重の状態が変わっています。最新データを読み直してください。'
        using errcode = 'P0001';
    end if;

    insert into public.daily_infos (
      user_id,
      date,
      body_weight
    )
    values (
      v_user_id,
      p_date,
      p_body_weight
    )
    returning * into v_daily_info;

    return to_jsonb(v_daily_info);
  end if;

  if v_daily_info.revision <> p_expected_revision then
    -- 保存済みの内容と一致し、番号が1つ進んでいれば再更新しない
    if v_daily_info.revision::bigint =
        p_expected_revision::bigint + 1
      and v_daily_info.body_weight is not distinct from p_body_weight
    then
      return to_jsonb(v_daily_info);
    end if;

    raise exception
      'この日の体重は別の画面で更新されています。入力内容を控え、最新データを読み直してください。'
      using errcode = 'P0001';
  end if;

  update public.daily_infos
  set
    body_weight = p_body_weight,
    revision = revision + 1
  where user_id = v_user_id
    and date = p_date
    and revision = p_expected_revision
  returning * into v_daily_info;

  if not found then
    raise exception
      '日付別体重の状態が変わっています。最新データを読み直してください。'
      using errcode = 'P0001';
  end if;

  return to_jsonb(v_daily_info);
end;
$$;

revoke execute on function public.save_daily_info(
  date, double precision, integer
)
  from public, anon, authenticated;

grant execute on function public.save_daily_info(
  date, double precision, integer
)
  to authenticated;

commit;