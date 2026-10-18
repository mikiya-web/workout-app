import { supabase } from "./supabase";
import type {
  BodyPart,
  Exercise,
  SubCategory,
} from "../types/workout";

// 更新番号は、今後の編集時の競合チェックに使う
export type StoredExercise = Exercise & {
  revision: number;
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

function isBodyPart(value: unknown): value is BodyPart {
  return (
    value === "chest" ||
    value === "back" ||
    value === "shoulders" ||
    value === "biceps" ||
    value === "triceps" ||
    value === "legs" ||
    value === "abs" ||
    value === "other"
  );
}

function parseSubCategory(
  value: unknown,
  userId: string
): SubCategory {
  if (
    !isObject(value) ||
    !isNonEmptyString(value.id) ||
    value.user_id !== userId ||
    !isNonEmptyString(value.name) ||
    !isBodyPart(value.body_part)
  ) {
    throw new Error("取得した分類データの形式が正しくありません。");
  }

  return {
    id: value.id,
    name: value.name,
    bodyPart: value.body_part,
  };
}

function parseExercise(
  value: unknown,
  userId: string
): StoredExercise {
  if (
    !isObject(value) ||
    !isNonEmptyString(value.id) ||
    value.user_id !== userId ||
    !isNonEmptyString(value.name) ||
    !isBodyPart(value.body_part) ||
    !(
      value.sub_category_id === null ||
      isNonEmptyString(value.sub_category_id)
    ) ||
    typeof value.uses_body_weight !== "boolean" ||
    typeof value.revision !== "number" ||
    !Number.isInteger(value.revision) ||
    value.revision < 1
  ) {
    throw new Error("取得した種目データの形式が正しくありません。");
  }

  return {
    id: value.id,
    name: value.name,
    bodyPart: value.body_part,
    subCategoryId: value.sub_category_id,
    usesBodyWeight: value.uses_body_weight,
    revision: value.revision,
  };
}

// 取得件数の上限で、途中のデータが黙って欠けないように分割取得する
async function fetchAllRows(
  table: "exercises" | "sub_categories",
  columns: string,
  userId: string
): Promise<unknown[]> {
  const rows: unknown[] = [];
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
        `${table === "exercises" ? "種目" : "分類"}の読み込みに失敗しました：${error.message}`
      );
    }

    if (!Array.isArray(data)) {
      throw new Error("データの取得結果が正しくありません。");
    }

    rows.push(...data);

    if (data.length < pageSize) {
      return rows;
    }
  }
}

export async function loadExerciseData(userId: string): Promise<{
  exercises: StoredExercise[];
  subCategories: SubCategory[];
}> {
  const [exerciseRows, subCategoryRows] = await Promise.all([
    fetchAllRows(
      "exercises",
      "id,user_id,name,body_part,sub_category_id,uses_body_weight,revision",
      userId
    ),
    fetchAllRows(
      "sub_categories",
      "id,user_id,name,body_part",
      userId
    ),
  ]);

  const subCategories = subCategoryRows.map((row) =>
    parseSubCategory(row, userId)
  );

  const exercises = exerciseRows.map((row) =>
    parseExercise(row, userId)
  );

  // 種目が参照する分類と部位の対応も確認する
  for (const exercise of exercises) {
    if (exercise.subCategoryId === null) {
      continue;
    }

    const hasMatchingCategory = subCategories.some(
      (category) =>
        category.id === exercise.subCategoryId &&
        category.bodyPart === exercise.bodyPart
    );

    if (!hasMatchingCategory) {
      throw new Error(
        "種目に対応する分類が見つからないか、部位が一致しません。再試行してください。"
      );
    }
  }

  exercises.sort((a, b) => a.name.localeCompare(b.name, "ja"));

  return { exercises, subCategories };
}