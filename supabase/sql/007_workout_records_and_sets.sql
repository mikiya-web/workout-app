begin;

-- 体重が登録されているかを、DBが自動計算する
alter table public.daily_infos
  add column has_body_weight boolean
    generated always as (body_weight is not null) stored;

-- 自重記録から、ユーザー・日付・体重登録の有無を参照するため
alter table public.daily_infos
  add constraint daily_infos_owner_date_weight_unique
    unique (user_id, date, has_body_weight);

-- トレーニング記録
create table public.workout_records (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id) on delete cascade,

  date date not null,

  exercise_id uuid not null,

  memo text not null default '',

  uses_body_weight boolean not null,

  revision integer not null default 1,

  -- 自重記録ならtrue、通常の記録ならnullを自動設定する
  required_body_weight boolean
    generated always as (
      case
        when uses_body_weight then true
        else null::boolean
      end
    ) stored,

  constraint workout_records_date_check
    check (
      date >= date '0001-01-01'
      and date <= date '9999-12-31'
    ),

  constraint workout_records_revision_check
    check (revision >= 1),

  -- 同じユーザー・日付・種目の記録は1件まで
  constraint workout_records_date_exercise_unique
    unique (user_id, date, exercise_id),

  -- セットから持ち主と記録IDをまとめて参照するため
  constraint workout_records_owner_id_unique
    unique (user_id, id),

  -- 本人の種目だけ参照できる
  -- 記録に使われている種目の削除を禁止する
  constraint workout_records_exercise_fk
    foreign key (user_id, exercise_id)
    references public.exercises (user_id, id)
    on delete restrict,

  -- 通常の記録でも、その日の日付情報の行は必要
  constraint workout_records_daily_info_fk
    foreign key (user_id, date)
    references public.daily_infos (user_id, date)
    deferrable initially deferred,

  -- 自重記録は、体重が登録されている日だけ保存できる
  -- 通常の記録はrequired_body_weightがnullなので、この確認を省く
  constraint workout_records_body_weight_fk
    foreign key (user_id, date, required_body_weight)
    references public.daily_infos (
      user_id, date, has_body_weight
    )
    deferrable initially deferred
);

-- 各記録に所属するセット
create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null,

  record_id uuid not null,

  set_order integer not null,

  weight double precision not null,

  reps integer not null,

  constraint workout_sets_order_check
    check (set_order >= 1),

  constraint workout_sets_weight_check
    check (
      weight >= 0
      and weight < 'Infinity'::double precision
    ),

  constraint workout_sets_reps_check
    check (reps >= 1),

  -- 同じ記録内でセットの表示順を重複させない
  constraint workout_sets_record_order_unique
    unique (user_id, record_id, set_order),

  -- 本人の記録だけ参照できる
  -- 記録を削除したら、その記録のセットもまとめて削除する
  constraint workout_sets_record_fk
    foreign key (user_id, record_id)
    references public.workout_records (user_id, id)
    on delete cascade
);

-- 種目が記録で使われているかを確認するための索引
create index workout_records_exercise_idx
  on public.workout_records (user_id, exercise_id);

-- 日付別の表示と、体重との関係の確認に使う索引
create index workout_records_date_weight_idx
  on public.workout_records (
    user_id, date, required_body_weight
  );

-- 行単位のアクセス制限
alter table public.workout_records enable row level security;
alter table public.workout_sets enable row level security;

-- アプリから直接できるのは読み取りだけ
revoke all on table public.workout_records
  from public, anon, authenticated;

revoke all on table public.workout_sets
  from public, anon, authenticated;

grant select on table public.workout_records to authenticated;
grant select on table public.workout_sets to authenticated;

create policy workout_records_select_own
  on public.workout_records
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy workout_sets_select_own
  on public.workout_sets
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

commit;