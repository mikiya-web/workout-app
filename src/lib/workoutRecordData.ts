import { supabase } from "./supabase";
import type {
  WorkoutRecord,
  WorkoutSet,
} from "../types/workout";
import {
  isValidDailyInfoDate,
  parseDailyInfo,
  type StoredDailyInfo,
} from "./dailyInfoData";

export type StoredWorkoutRecord = WorkoutRecord & {
  revision: number;
};

// 新規保存に必要な情報
// 自重計算の設定はDB側で種目から取得する
export type CreateWorkoutRecordInput = {
  id: string;
  date: string;
  exerciseId: string;
  expectedExerciseRevision: number;
  memo: string;
  sets: WorkoutSet[];
  bodyWeight: number | null;
  expectedDailyRevision: number;
};

export type WorkoutRecordSaveResult = {
  record: StoredWorkoutRecord;
  dailyInfo: StoredDailyInfo;
};

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isPositiveInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 2147483647
  );
}

// 記録本体と、その記録に所属するセットを検証して組み立てる
function parseWorkoutRecord(
  recordValue: unknown,
  setsValue: unknown,
  userId: string
): StoredWorkoutRecord {
  if (
    !isObject(recordValue) ||
    !isNonEmptyString(recordValue.id) ||
    recordValue.user_id !== userId ||
    typeof recordValue.date !== "string" ||
    !isValidDailyInfoDate(recordValue.date) ||
    !isNonEmptyString(recordValue.exercise_id) ||
    typeof recordValue.memo !== "string" ||
    typeof recordValue.uses_body_weight !== "boolean" ||
    !isPositiveInteger(recordValue.revision)
  ) {
    throw new Error("取得した記録の形式が正しくありません。");
  }

  if (!Array.isArray(setsValue) || setsValue.length < 1) {
    throw new Error("記録には最低1セット必要です。");
  }

  const seenIds = new Set<string>();
  const seenOrders = new Set<number>();
  const orderedSets: Array<WorkoutSet & { setOrder: number }> = [];

  for (const value of setsValue) {
    if (
      !isObject(value) ||
      !isNonEmptyString(value.id) ||
      value.user_id !== userId ||
      value.record_id !== recordValue.id ||
      !isPositiveInteger(value.set_order) ||
      typeof value.weight !== "number" ||
      !Number.isFinite(value.weight) ||
      value.weight < 0 ||
      !isPositiveInteger(value.reps)
    ) {
      throw new Error(
        "取得したセットの形式または所属する記録が正しくありません。"
      );
    }

    if (seenIds.has(value.id) || seenOrders.has(value.set_order)) {
      throw new Error("セットのIDまたは表示順が重複しています。");
    }

    seenIds.add(value.id);
    seenOrders.add(value.set_order);

    orderedSets.push({
      id: value.id,
      weight: value.weight,
      reps: value.reps,
      setOrder: value.set_order,
    });
  }

  orderedSets.sort((a, b) => a.setOrder - b.setOrder);

  // 1、2、3…と、表示順が連続しているか確認する
  if (
    orderedSets.some((set, index) => set.setOrder !== index + 1)
  ) {
    throw new Error("セットの表示順が連続していません。");
  }

  return {
    id: recordValue.id,
    date: recordValue.date,
    exerciseId: recordValue.exercise_id,
    memo: recordValue.memo,
    usesBodyWeight: recordValue.uses_body_weight,
    revision: recordValue.revision,
    sets: orderedSets.map((set) => ({
      id: set.id,
      weight: set.weight,
      reps: set.reps,
    })),
  };
}

export async function createWorkoutRecord(
  input: CreateWorkoutRecordInput,
  userId: string
): Promise<WorkoutRecordSaveResult> {
  if (!isValidDailyInfoDate(input.date)) {
    throw new Error("実在する正しい日付を選んでください。");
  }

  if (!isPositiveInteger(input.expectedExerciseRevision)) {
    throw new Error("種目の更新番号が正しくありません。");
  }

  if (
    !Number.isInteger(input.expectedDailyRevision) ||
    input.expectedDailyRevision < 0 ||
    input.expectedDailyRevision > 2147483647
  ) {
    throw new Error("体重の更新番号が正しくありません。");
  }

  if (
    input.bodyWeight !== null &&
    (!Number.isFinite(input.bodyWeight) || input.bodyWeight <= 0)
  ) {
    throw new Error("体重は0より大きい数値で入力してください。");
  }

  if (input.sets.length < 1) {
    throw new Error("最低1セット必要です。");
  }

  const seenIds = new Set<string>();

  for (const set of input.sets) {
    if (
      !isNonEmptyString(set.id) ||
      seenIds.has(set.id) ||
      !Number.isFinite(set.weight) ||
      set.weight < 0 ||
      !isPositiveInteger(set.reps)
    ) {
      throw new Error(
        "セットのID・重量・回数を確認してください。"
      );
    }

    seenIds.add(set.id);
  }

  const { data, error } = await supabase.rpc(
    "create_workout_record",
    {
      p_id: input.id,
      p_date: input.date,
      p_exercise_id: input.exerciseId,
      p_expected_exercise_revision: input.expectedExerciseRevision,
      p_memo: input.memo,
      p_sets: input.sets.map((set) => ({
        id: set.id,
        weight: set.weight,
        reps: set.reps,
      })),
      p_body_weight: input.bodyWeight,
      p_expected_daily_revision: input.expectedDailyRevision,
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  if (!isObject(data)) {
    throw new Error("記録の保存結果が正しくありません。");
  }

  const record = parseWorkoutRecord(
    data.record,
    data.sets,
    userId
  );
  const dailyInfo = parseDailyInfo(data.daily_info, userId);

  // 保存結果が、今回送った記録と対応しているか確認する
  if (
    record.id !== input.id ||
    record.date !== input.date ||
    record.exerciseId !== input.exerciseId ||
    record.memo !== input.memo ||
    dailyInfo.date !== input.date ||
    dailyInfo.bodyWeight !== input.bodyWeight ||
    record.sets.length !== input.sets.length
  ) {
    throw new Error(
      "記録の保存結果が送信内容と一致しません。最新データを確認してください。"
    );
  }

  const setsMatch = record.sets.every((set, index) => {
    const submittedSet = input.sets[index];

    return (
      set.id === submittedSet.id &&
      set.weight === submittedSet.weight &&
      set.reps === submittedSet.reps
    );
  });

  if (!setsMatch) {
    throw new Error(
      "セットの保存結果が送信内容と一致しません。最新データを確認してください。"
    );
  }

  if (record.usesBodyWeight && dailyInfo.bodyWeight === null) {
    throw new Error(
      "自重記録に必要な体重を確認できません。"
    );
  }

  return { record, dailyInfo };
}

// 取得上限による欠落を避けるため、500件ずつ読み込む
async function fetchAllWorkoutRows(
  table: "workout_records" | "workout_sets",
  columns: string,
  userId: string
): Promise<unknown[]> {
  const rows: unknown[] = [];
  const seenIds = new Set<string>();
  const pageSize = 500;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq("user_id", userId)
      .order("id")
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(
        `${table === "workout_records" ? "記録" : "セット"}の読み込みに失敗しました：${error.message}`
      );
    }

    if (!Array.isArray(data)) {
      throw new Error("記録データの取得結果が正しくありません。");
    }

    for (const row of data) {
      if (
        !isObject(row) ||
        !isNonEmptyString(row.id) ||
        row.user_id !== userId
      ) {
        throw new Error(
          "取得した記録またはセットのID・所有者が正しくありません。"
        );
      }

      if (seenIds.has(row.id)) {
        throw new Error(
          "読み込み中にデータが変化した可能性があります。再試行してください。"
        );
      }

      seenIds.add(row.id);
      rows.push(row);
    }

    if (data.length < pageSize) {
      return rows;
    }
  }
}

// 記録とセットを取得し、画面で使う形にまとめる
export async function loadWorkoutRecords(
  userId: string
): Promise<StoredWorkoutRecord[]> {
  const [recordRows, setRows] = await Promise.all([
    fetchAllWorkoutRows(
      "workout_records",
      "id,user_id,date,exercise_id,memo,uses_body_weight,revision",
      userId
    ),
    fetchAllWorkoutRows(
      "workout_sets",
      "id,user_id,record_id,set_order,weight,reps",
      userId
    ),
  ]);

  const setsByRecordId = new Map<string, unknown[]>();

  for (const row of setRows) {
    if (!isObject(row) || !isNonEmptyString(row.record_id)) {
      throw new Error("セットに対応する記録IDが正しくありません。");
    }

    const groupedSets = setsByRecordId.get(row.record_id) ?? [];
    groupedSets.push(row);
    setsByRecordId.set(row.record_id, groupedSets);
  }

  const records: StoredWorkoutRecord[] = [];
  const seenDateExercises = new Set<string>();

  for (const row of recordRows) {
    if (!isObject(row) || !isNonEmptyString(row.id)) {
      throw new Error("取得した記録IDが正しくありません。");
    }

    const record = parseWorkoutRecord(
      row,
      setsByRecordId.get(row.id) ?? [],
      userId
    );

    const dateExerciseKey = JSON.stringify([
      record.date,
      record.exerciseId,
    ]);

    if (seenDateExercises.has(dateExerciseKey)) {
      throw new Error("同じ日付・種目の記録が重複しています。");
    }

    seenDateExercises.add(dateExerciseKey);
    records.push(record);
    setsByRecordId.delete(record.id);
  }

  // 対応する記録がないセットを、黙って無視しない
  if (setsByRecordId.size > 0) {
    throw new Error(
      "セットに対応する記録が見つかりません。最新データを再読み込みしてください。"
    );
  }

  // 新しい日付から表示し、同じ日付ではID順にそろえる
  records.sort(
    (a, b) =>
      b.date.localeCompare(a.date) || a.id.localeCompare(b.id)
  );

  return records;
}

// 新規保存の情報に、編集開始時の記録の更新番号を加える
export type UpdateWorkoutRecordInput = CreateWorkoutRecordInput & {
  expectedRevision: number;
};

export async function updateWorkoutRecord(
  input: UpdateWorkoutRecordInput,
  userId: string
): Promise<WorkoutRecordSaveResult> {
  if (
    !isNonEmptyString(input.id) ||
    !isNonEmptyString(input.exerciseId)
  ) {
    throw new Error("記録IDと種目IDが必要です。");
  }

  if (!isValidDailyInfoDate(input.date)) {
    throw new Error("実在する正しい日付を選んでください。");
  }

  if (
    !isPositiveInteger(input.expectedRevision) ||
    !isPositiveInteger(input.expectedExerciseRevision)
  ) {
    throw new Error("記録または種目の更新番号が正しくありません。");
  }

  if (
    !Number.isInteger(input.expectedDailyRevision) ||
    input.expectedDailyRevision < 0 ||
    input.expectedDailyRevision > 2147483647
  ) {
    throw new Error("体重の更新番号が正しくありません。");
  }

  if (
    input.bodyWeight !== null &&
    (!Number.isFinite(input.bodyWeight) || input.bodyWeight <= 0)
  ) {
    throw new Error("体重は0より大きい数値で入力してください。");
  }

  if (input.sets.length < 1) {
    throw new Error("最低1セット必要です。");
  }

  const seenIds = new Set<string>();

  for (const set of input.sets) {
    if (
      !isNonEmptyString(set.id) ||
      seenIds.has(set.id) ||
      !Number.isFinite(set.weight) ||
      set.weight < 0 ||
      !isPositiveInteger(set.reps)
    ) {
      throw new Error("セットのID・重量・回数を確認してください。");
    }

    seenIds.add(set.id);
  }

  const { data, error } = await supabase.rpc(
    "update_workout_record",
    {
      p_id: input.id,
      p_expected_revision: input.expectedRevision,
      p_date: input.date,
      p_exercise_id: input.exerciseId,
      p_expected_exercise_revision: input.expectedExerciseRevision,
      p_memo: input.memo,
      p_sets: input.sets.map((set) => ({
        id: set.id,
        weight: set.weight,
        reps: set.reps,
      })),
      p_body_weight: input.bodyWeight,
      p_expected_daily_revision: input.expectedDailyRevision,
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  if (!isObject(data)) {
    throw new Error("記録の更新結果が正しくありません。");
  }

  const record = parseWorkoutRecord(data.record, data.sets, userId);
  const dailyInfo = parseDailyInfo(data.daily_info, userId);

  // 対象の記録が、送信内容で1回更新されたことを確認する
  if (
    record.id !== input.id ||
    record.revision !== input.expectedRevision + 1 ||
    record.date !== input.date ||
    record.exerciseId !== input.exerciseId ||
    record.memo !== input.memo ||
    dailyInfo.date !== input.date ||
    dailyInfo.bodyWeight !== input.bodyWeight ||
    record.sets.length !== input.sets.length
  ) {
    throw new Error(
      "記録の更新結果が送信内容と一致しません。最新データを確認してください。"
    );
  }

  const setsMatch = record.sets.every((set, index) => {
    const submittedSet = input.sets[index];

    return (
      set.id === submittedSet.id &&
      set.weight === submittedSet.weight &&
      set.reps === submittedSet.reps
    );
  });

  if (!setsMatch) {
    throw new Error(
      "セットの更新結果が送信内容と一致しません。最新データを確認してください。"
    );
  }

  if (record.usesBodyWeight && dailyInfo.bodyWeight === null) {
    throw new Error("自重記録に必要な体重を確認できません。");
  }

  return { record, dailyInfo };
}
