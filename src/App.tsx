import "./App.css";
import {
  type WorkoutRecord,
  type Exercise,
  type DailyInfo,
  type BodyPart,
  type SubCategory,
  type WorkoutSetInput,
  type WorkoutSet,
} from "./types/workout";
import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import RecordList from "./components/RecordList";
import ExerciseList from "./components/ExerciseList";
import ExerciseForm from "./components/ExerciseForm";
import RecordForm from "./components/RecordForm";
import { Route, Routes, Link, useNavigate } from "react-router";

// ========================================
// 読み込み結果の型
// data：読み込んだデータ
// error：読み込みエラーの説明文。問題がなければ空文字
// ========================================

type RecordsLoadResult = {
  data: WorkoutRecord[];
  error: string;
};

type ExercisesLoadResult = {
  data: Exercise[];
  error: string;
};

type SubCategoriesLoadResult = {
  data: SubCategory[];
  error: string;
};

type DailyInfosLoadResult = {
  data: DailyInfo[];
  error: string;
};

// ========================================
// 初期データ
// 対応するlocalStorageのキーが存在しない場合に使う
// 保存済みデータが空配列なら、初期データに戻さない
// ========================================

// 初期表示用のトレーニング記録
const sampleRecords: WorkoutRecord[] = [
  {
    id: "record-1",
    date: "2026-10-04",
    exerciseId: "exercise-1",
    sets: [
      { id: "set-1", weight: 100, reps: 8 },
      { id: "set-2", weight: 100, reps: 7 },
    ],
    memo: "最後のセットがきつかった",
    usesBodyWeight: false,
  },
  {
    id: "record-2",
    date: "2026-10-05",
    exerciseId: "exercise-1",
    sets: [{ id: "set-3", weight: 105, reps: 6 }],
    memo: "",
    usesBodyWeight: false,
  },
];

// 初期登録されている分類
const sampleSubCategories: SubCategory[] = [
  { id: "chest-upper", name: "上部", bodyPart: "chest" },
  { id: "chest-middle", name: "中部", bodyPart: "chest" },
  { id: "chest-lower", name: "下部", bodyPart: "chest" },
  { id: "back-width", name: "広がり", bodyPart: "back" },
  { id: "back-thickness", name: "厚み", bodyPart: "back" },
  { id: "shoulders-front", name: "フロント", bodyPart: "shoulders" },
  { id: "shoulders-side", name: "サイド", bodyPart: "shoulders" },
  { id: "shoulders-rear", name: "リア", bodyPart: "shoulders" },
  { id: "legs-quads", name: "四頭筋", bodyPart: "legs" },
  { id: "legs-hamstrings", name: "ハムストリングス", bodyPart: "legs" },
  { id: "legs-glutes", name: "お尻", bodyPart: "legs" },
  { id: "legs-inner", name: "内もも", bodyPart: "legs" },
  { id: "legs-calves", name: "ふくらはぎ", bodyPart: "legs" },
];

// 初期登録されている種目
const sampleExercises: Exercise[] = [
  {
    id: "exercise-1",
    name: "ベンチプレス",
    bodyPart: "chest",
    subCategoryId: null,
    usesBodyWeight: false,
  },
  {
    id: "exercise-2",
    name: "懸垂",
    bodyPart: "back",
    subCategoryId: "back-width",
    usesBodyWeight: true,
  },
  {
    id: "exercise-3",
    name: "サイドレイズ",
    bodyPart: "shoulders",
    subCategoryId: "shoulders-side",
    usesBodyWeight: false,
  },
  {
    id: "exercise-4",
    name: "ダンベルカール",
    bodyPart: "biceps",
    subCategoryId: null,
    usesBodyWeight: false,
  },
  {
    id: "exercise-5",
    name: "ケーブルプレスダウン",
    bodyPart: "triceps",
    subCategoryId: null,
    usesBodyWeight: false,
  },
  {
    id: "exercise-6",
    name: "スクワット",
    bodyPart: "legs",
    subCategoryId: "legs-quads",
    usesBodyWeight: false,
  },
  {
    id: "exercise-7",
    name: "アブドミナルクランチ（マシン）",
    bodyPart: "abs",
    subCategoryId: null,
    usesBodyWeight: false,
  },
];

// 初期表示用の日付別体重
const sampleDailyInfos: DailyInfo[] = [
  {
    date: "2026-10-04",
    bodyWeight: 70,
  },
];

// データ内の部位名を、画面表示用の日本語に対応させる
const bodyPartLabels: Record<BodyPart, string> = {
  chest: "胸",
  back: "背中",
  shoulders: "肩",
  biceps: "上腕二頭筋",
  triceps: "上腕三頭筋",
  legs: "脚",
  abs: "腹",
  other: "その他",
};

// ========================================
// 保存データの型・値を確認する関数
// unknown：まだ中身の型が分からない値
// value is ○○：trueなら、その値を○○型として扱える
// ========================================

// 日付別体重の形式を確認する
// 日付は実在日付、体重はnullまたは0より大きい有限数値
function isDailyInfo(value: unknown): value is DailyInfo {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  if (!("date" in value) || !("bodyWeight" in value)) {
    return false;
  }

  if (
    typeof value.date !== "string" ||
    !(isValidDate(value.date))
  ) {
    return false;
  }

  if (
    value.bodyWeight === null ||
    (
      typeof value.bodyWeight === "number" &&
      Number.isFinite(value.bodyWeight) &&
      value.bodyWeight > 0
    )
  ) {
    return true;
  }

  return false;
}

// 定義済みの8種類の部位のどれかに一致するか確認する
function isBodyPart(value: unknown): value is BodyPart {
  if (
    value === "chest" ||
    value === "back" ||
    value === "shoulders" ||
    value === "biceps" ||
    value === "triceps" ||
    value === "legs" ||
    value === "abs" ||
    value === "other"
  ) {
    return true;
  }

  return false;
}

// 分類データのID・名前・部位が正しい形式か確認する
function isSubCategory(value: unknown): value is SubCategory {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  if (
    !("id" in value) ||
    !("name" in value) ||
    !("bodyPart" in value)
  ) {
    return false;
  }

  if (
    typeof value.id === "string" &&
    value.id.trim() !== "" &&
    typeof value.name === "string" &&
    value.name.trim() !== ""
  ) {
    if (isBodyPart(value.bodyPart)) {
      return true;
    }

    return false;
  }

  return false;
}

// 種目データのID・名前・部位・分類ID・自重計算設定を確認する
// 分類IDの参照先が存在するかは、別の整合性チェックで確認する
function isExercise(value: unknown): value is Exercise {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  if (
    !("id" in value) ||
    !("name" in value) ||
    !("bodyPart" in value) ||
    !("subCategoryId" in value) ||
    !("usesBodyWeight" in value)
  ) {
    return false;
  }

  if (
    typeof value.id === "string" &&
    value.id.trim() !== "" &&
    typeof value.name === "string" &&
    value.name.trim() !== "" &&
    isBodyPart(value.bodyPart) &&
    (
      value.subCategoryId === null ||
      (
        typeof value.subCategoryId === "string" &&
        value.subCategoryId.trim() !== ""
      )
    ) &&
    typeof value.usesBodyWeight === "boolean"
  ) {
    return true;
  }

  return false;
}

// 保存済みセットの形式を確認する
// 重量は0以上の有限数値、回数は1以上の整数
function isWorkoutSet(value: unknown): value is WorkoutSet {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  if (
    !("id" in value) ||
    !("weight" in value) ||
    !("reps" in value)
  ) {
    return false;
  }

  if (
    typeof value.id === "string" &&
    value.id.trim() !== "" &&
    typeof value.weight === "number" &&
    Number.isFinite(value.weight) &&
    value.weight >= 0 &&
    typeof value.reps === "number" &&
    Number.isInteger(value.reps) &&
    value.reps >= 1
  ) {
    return true;
  }

  return false;
}

// 記録全体の形式を確認する
// 日付の実在・最低1セット・すべてのセットの内容も検証する
function isWorkoutRecord(value: unknown): value is WorkoutRecord {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  if (
    !("id" in value) ||
    !("date" in value) ||
    !("exerciseId" in value) ||
    !("sets" in value) ||
    !("memo" in value) ||
    !("usesBodyWeight" in value)
  ) {
    return false;
  }

  if (
    typeof value.id === "string" &&
    value.id.trim() !== "" &&
    typeof value.date === "string" &&
    isValidDate(value.date) &&
    typeof value.exerciseId === "string" &&
    value.exerciseId.trim() !== "" &&
    Array.isArray(value.sets) &&
    value.sets.length >= 1 &&
    value.sets.every(isWorkoutSet) &&
    typeof value.memo === "string" &&
    typeof value.usesBodyWeight === "boolean"
  ) {
    return true;
  }

  return false;
}

// ========================================
// localStorageから読み込む関数
// キーなし：初期データを返す
// 正常：読み込んだデータを返す。空配列もそのまま使う
// 異常：空配列とエラー文を返す
// ========================================

// 記録を読み込み、配列と各記録の形式を検証する
function loadRecords(): RecordsLoadResult {
  try {
    const savedRecord = localStorage.getItem("records");

    if (savedRecord === null) {
      return { data: sampleRecords, error: "" };
    }

    const parsedRecords: unknown = JSON.parse(savedRecord);

    if (
      Array.isArray(parsedRecords) &&
      parsedRecords.every(isWorkoutRecord)
    ) {
      return { data: parsedRecords, error: "" };
    }

    return {
      data: [],
      error: "保存された記録の形式が正しくないため、読み込めませんでした。",
    };
  } catch {
    return {
      data: [],
      error: "記録の読み込みに失敗しました。",
    };
  }
}

// 種目を読み込み、配列と各種目の形式を検証する
function loadExercises(): ExercisesLoadResult {
  try {
    const savedExercise = localStorage.getItem("exercises");

    if (savedExercise === null) {
      return { data: sampleExercises, error: "" };
    }

    const parsedExercises: unknown = JSON.parse(savedExercise);

    if (
      Array.isArray(parsedExercises) &&
      parsedExercises.every(isExercise)
    ) {
      return { data: parsedExercises, error: "" };
    }

    return {
      data: [],
      error: "保存された種目の形式が正しくないため、読み込めませんでした。",
    };
  } catch {
    return {
      data: [],
      error: "種目の読み込みに失敗しました。",
    };
  }
}

// 分類を読み込み、配列と各分類の形式を検証する
function loadSubCategories(): SubCategoriesLoadResult {
  try {
    const savedSubCategories = localStorage.getItem("subCategories");

    if (savedSubCategories === null) {
      return { data: sampleSubCategories, error: "" };
    }

    const parsedSubCategories: unknown = JSON.parse(savedSubCategories);

    if (
      Array.isArray(parsedSubCategories) &&
      parsedSubCategories.every(isSubCategory)
    ) {
      return { data: parsedSubCategories, error: "" };
    }

    return {
      data: [],
      error: "保存された分類の形式が正しくないため、読み込めませんでした。",
    };
  } catch {
    return {
      data: [],
      error: "分類の読み込みに失敗しました。",
    };
  }
}

// 日付別体重を読み込み、配列と各要素の形式を検証する
function loadDailyInfos(): DailyInfosLoadResult {
  try {
    const savedDailyInfos = localStorage.getItem("dailyInfos");

    if (savedDailyInfos === null) {
      return { data: sampleDailyInfos, error: "" };
    }

    const parsedDailyInfos: unknown = JSON.parse(savedDailyInfos);

    if (
      Array.isArray(parsedDailyInfos) &&
      parsedDailyInfos.every(isDailyInfo)
    ) {
      return { data: parsedDailyInfos, error: "" };
    }

    return {
      data: [],
      error: "保存された日付情報の形式が正しくないため、読み込めませんでした。",
    };
  } catch {
    return {
      data: [],
      error: "日付情報の読み込みに失敗しました。",
    };
  }
}

// ========================================
// 日付・データ同士の整合性を確認する関数
// ========================================

// YYYY-MM-DD形式で、年1〜9999の実在する日付か確認する
// うるう年も考慮する。未来の日付は禁止しない
function isValidDate(value: string): boolean {
  if (!(/^\d{4}-\d{2}-\d{2}$/.test(value))) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (
    year > 9999 ||
    year < 1 ||
    month > 12 ||
    month < 1 ||
    day < 1
  ) {
    return false;
  }

  const isLeapYear: boolean =
    year % 400 === 0 ||
    (year % 4 === 0 && year % 100 !== 0);

  const daysInMonth = [
    31,
    isLeapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return day <= daysInMonth[month - 1];
}

// 読み込んだデータ同士に矛盾や重複がないか確認する
// 最初に見つけた問題の説明文を返し、問題がなければ空文字を返す
function getDataIntegrityError(
  exercises: Exercise[],
  subCategories: SubCategory[],
  records: WorkoutRecord[],
  dailyInfos: DailyInfo[]
): string {
  // それぞれのデータを識別するID・日付の重複を確認する
  if (hasDuplicate(exercises.map((exercise) => exercise.id)) === true) {
    return "種目のIDが重複しています。";
  }

  if (hasDuplicate(subCategories.map((subCategory) => subCategory.id))) {
    return "分類のIDが重複しています。";
  }

  if (hasDuplicate(records.map((record) => record.id))) {
    return "記録のIDが重複しています。";
  }

  if (hasDuplicate(dailyInfos.map((dailyInfo) => dailyInfo.date))) {
    return "日付情報の日付が重複しています。";
  }

  // 種目名は、前後の空白を除いて比較する
  if (hasDuplicate(exercises.map((exercise) => exercise.name.trim()))) {
    return "種目名が重複しています。";
  }

  // 分類名は、同じ部位の中でだけ重複を禁止する
  if (
    hasDuplicate(
      subCategories.map((subCategory) =>
        JSON.stringify([
          subCategory.bodyPart,
          subCategory.name.trim(),
        ])
      )
    )
  ) {
    return "同じ部位内で分類名が重複しています。";
  }

  // 同じ日付・同じ種目の記録は1件まで
  if (
    hasDuplicate(
      records.map((record) =>
        JSON.stringify([record.date, record.exerciseId])
      )
    )
  ) {
    return "同じ日付・種目の記録が重複しています。";
  }

  // 種目に設定された分類が存在し、部位も一致するか確認する
  for (const exercise of exercises) {
    if (exercise.subCategoryId !== null) {
      const hasMatchingSubCategory = subCategories.some((subCategory) => {
        return (
          subCategory.id === exercise.subCategoryId &&
          subCategory.bodyPart === exercise.bodyPart
        );
      });

      if (!hasMatchingSubCategory) {
        return "種目に設定された分類が存在しないか、部位が一致しません。";
      }
    }
  }

  for (const record of records) {
    // セットIDの重複は、1件の記録の中で確認する
    if (hasDuplicate(record.sets.map((set) => set.id)) === true) {
      return "同じ記録内でセットのIDが重複しています。";
    }

    // 記録が参照する種目が存在するか確認する
    const hasMatchingExercise = exercises.some((exercise) => {
      return exercise.id === record.exerciseId;
    });

    if (!hasMatchingExercise) {
      return "記録に対応する種目が見つかりません。";
    }

    // 自重計算する記録には、その日の体重が必要
    if (record.usesBodyWeight) {
      const hasBodyWeight = dailyInfos.some((dailyInfo) => {
        return (
          dailyInfo.date === record.date &&
          dailyInfo.bodyWeight !== null
        );
      });

      if (!hasBodyWeight) {
        return "自重計算の記録に必要な体重が登録されていません。";
      }
    }
  }

  return "";
}

// 文字列の配列に重複が含まれているか確認する
// Setは重複を取り除くため、件数が減っていれば重複がある
function hasDuplicate(values: string[]): boolean {
  const uniqueValues = new Set(values);

  if (values.length !== uniqueValues.size) {
    return true;
  }

  return false;
}

// ========================================
// アプリ本体
// データ・入力途中の値・操作する関数をAppで管理する
// 画面を切り替えてもAppが残るため、入力途中のstateを保持できる
// ========================================

function App() {
  // 関数の処理中に画面を移動するための関数
  const navigate = useNavigate();

  // ----------------------------------------
  // 初回読み込み結果
  // 操作中のデータとは分けて、起動時の読み込み結果を保持する
  // ----------------------------------------

  // 最初に読み込んだ記録データと読み込みエラー
  const [recordsLoadResult] = useState<RecordsLoadResult>(
    () => loadRecords()
  );

  // 最初に読み込んだ種目データと読み込みエラー
  const [exercisesLoadResult] = useState<ExercisesLoadResult>(
    () => loadExercises()
  );

  // 最初に読み込んだ日付別体重データと読み込みエラー
  const [dailyInfosLoadResult] = useState<DailyInfosLoadResult>(
    () => loadDailyInfos()
  );

  // 最初に読み込んだ分類データと読み込みエラー
  const [subCategoriesLoadResult] = useState<SubCategoriesLoadResult>(
    () => loadSubCategories()
  );

  // 4種類のうち、どれかの読み込みが失敗しているか
  const hasDataLoadError =
    recordsLoadResult.error !== "" ||
    exercisesLoadResult.error !== "" ||
    dailyInfosLoadResult.error !== "" ||
    subCategoriesLoadResult.error !== "";

  // 読み込みに成功した場合だけ、データ間の整合性を確認する
  // 検証対象は初回読み込み結果であり、編集中のstateではない
  const dataIntegrityError = hasDataLoadError === true
    ? ""
    : getDataIntegrityError(
      exercisesLoadResult.data,
      subCategoriesLoadResult.data,
      recordsLoadResult.data,
      dailyInfosLoadResult.data
    );

  // 読み込みまたは整合性に問題があるか
  // trueなら通常画面を表示せず、すべての自動保存を停止する
  const hasLoadError =
    hasDataLoadError === true ||
    dataIntegrityError !== "";

  // ----------------------------------------
  // 保存エラーと再試行
  // 空文字は「保存エラーなし」を表す
  // ----------------------------------------

  // 記録をlocalStorageに保存できなかったときのエラー文
  const [recordsSaveError, setRecordsSaveError] = useState<string>("");

  // 種目をlocalStorageに保存できなかったときのエラー文
  const [exercisesSaveError, setExercisesSaveError] = useState<string>("");

  // 分類をlocalStorageに保存できなかったときのエラー文
  const [subCategoriesSaveError, setSubCategoriesSaveError] =
    useState<string>("");

  // 日付別体重をlocalStorageに保存できなかったときのエラー文
  const [dailyInfosSaveError, setDailyInfosSaveError] =
    useState<string>("");

  // この数値を増やすことで、4つの保存用Effectを再実行する
  const [saveRetryCount, setSaveRetryCount] = useState<number>(0);

  // どれかの保存が失敗しているか。再試行ボタンの表示に使う
  const haveSaveError =
    recordsSaveError !== "" ||
    exercisesSaveError !== "" ||
    subCategoriesSaveError !== "" ||
    dailyInfosSaveError !== "";

  // ----------------------------------------
  // 記録データと自動保存
  // ----------------------------------------

  // 確定したトレーニング記録の一覧。追加・編集・削除の対象
  // state更新後、下のEffectでlocalStorageへの保存を試みる
  const [records, setRecords] = useState<WorkoutRecord[]>(
    recordsLoadResult.data
  );

  // 初回表示後・記録の変更時・再試行時に記録を保存する
  // 読み込みエラー中は保存せず、元の保存内容を保護する
  /* eslint-disable react-hooks/set-state-in-effect -- localStorageへの保存結果をエラー表示に反映するため */
  useEffect(() => {
    if (hasLoadError) {
      return;
    }

    try {
      localStorage.setItem("records", JSON.stringify(records));
      setRecordsSaveError("");
    } catch {
      setRecordsSaveError(
        "記録をブラウザに保存できませんでした。最新の変更は、再読み込みや画面を閉じると失われる可能性があります。"
      );
    }
  }, [records, hasLoadError, saveRetryCount]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ----------------------------------------
  // 種目データと自動保存
  // ----------------------------------------

  // 登録された種目の一覧。名前・部位・分類・自重計算設定を持つ
  const [exercises, setExercises] = useState<Exercise[]>(
    exercisesLoadResult.data
  );

  // 初回表示後・種目の変更時・再試行時に種目を保存する
  /* eslint-disable react-hooks/set-state-in-effect -- localStorageへの保存結果をエラー表示に反映するため */
  useEffect(() => {
    if (hasLoadError) {
      return;
    }

    try {
      localStorage.setItem("exercises", JSON.stringify(exercises));
      setExercisesSaveError("");
    } catch {
      setExercisesSaveError(
        "種目をブラウザに保存できませんでした。最新の変更は、再読み込みや画面を閉じると失われる可能性があります。"
      );
    }
  }, [exercises, hasLoadError, saveRetryCount]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ----------------------------------------
  // 種目フォームの入力値と編集状態
  // ----------------------------------------

  // 種目フォームで入力中の種目名
  const [exerciseName, setExerciseName] = useState<string>("");

  // 種目フォームで選択中の部位
  const [exerciseBodyPart, setExerciseBodyPart] =
    useState<BodyPart>("chest");

  // 登録・編集中の種目を自重計算する設定にするか
  const [exerciseUsesBodyWeight, setExerciseUsesBodyWeight] =
    useState<boolean>(false);

  // 種目の追加・編集時に表示する入力エラー
  const [exerciseError, setExerciseError] = useState<string>("");

  // 編集中の種目ID。nullなら新規追加モード
  const [editingExerciseId, setEditingExerciseId] =
    useState<string | null>(null);

  // ----------------------------------------
  // 種目一覧の検索・絞り込み
  // ----------------------------------------

  // 種目管理画面で種目名を検索するための入力文字列
  const [exerciseSearchText, setExerciseSearchText] =
    useState<string>("");

  // 種目管理画面の部位フィルター。"all"なら全部位
  const [exerciseFilterBodyPart, setExerciseFilterBodyPart] =
    useState<BodyPart | "all">("all");

  // ----------------------------------------
  // 記録フォームの入力値
  // ----------------------------------------

  // 選択中の日付。体重の読み込み・保存先の日付にも使う
  const [recordDate, setRecordDate] = useState<string>("");

  // 選択中の種目ID。空文字なら未選択
  const [recordExerciseId, setRecordExerciseId] = useState<string>("");

  // 入力中のメモ
  const [recordMemo, setRecordMemo] = useState<string>("");

  // 入力中のセット一覧。空欄を扱うため重量・回数は文字列
  // 最初は空欄のセットを1つ用意する
  const [recordSets, setRecordSets] = useState<WorkoutSetInput[]>(
    () => [
      {
        id: crypto.randomUUID(),
        weight: "",
        reps: "",
      },
    ]
  );

  // ----------------------------------------
  // 日付別体重データと自動保存
  // ----------------------------------------

  // 確定した日付別体重。同じ日の複数の記録から共通で使う
  const [dailyInfos, setDailyInfos] = useState<DailyInfo[]>(
    dailyInfosLoadResult.data
  );

  // 初回表示後・日付別体重の変更時・再試行時に保存する
  /* eslint-disable react-hooks/set-state-in-effect -- localStorageへの保存結果をエラー表示に反映するため */
  useEffect(() => {
    if (hasLoadError) {
      return;
    }

    try {
      localStorage.setItem("dailyInfos", JSON.stringify(dailyInfos));
      setDailyInfosSaveError("");
    } catch {
      setDailyInfosSaveError(
        "日付情報をブラウザに保存できませんでした。最新の変更は、再読み込みや画面を閉じると失われる可能性があります。"
      );
    }
  }, [dailyInfos, hasLoadError, saveRetryCount]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 記録フォームで入力中の体重。空欄を扱うため文字列
  // dailyInfosは確定済みデータ、こちらは保存前の入力値
  const [recordBodyWeight, setRecordBodyWeight] = useState<string>("");

  // 記録の保存・体重だけ保存の際に表示する入力エラー
  const [recordError, setRecordError] = useState<string>("");

  // 編集中の記録ID。nullなら新規追加モード
  const [editingRecordId, setEditingRecordId] =
    useState<string | null>(null);

  // ----------------------------------------
  // 分類データと自動保存
  // ----------------------------------------

  // 初期分類と、利用者が追加した分類の一覧
  const [subCategories, setSubCategories] = useState<SubCategory[]>(
    subCategoriesLoadResult.data
  );

  // 初回表示後・分類の変更時・再試行時に分類を保存する
  /* eslint-disable react-hooks/set-state-in-effect -- localStorageへの保存結果をエラー表示に反映するため */
  useEffect(() => {
    if (hasLoadError) {
      return;
    }

    try {
      localStorage.setItem("subCategories", JSON.stringify(subCategories));
      setSubCategoriesSaveError("");
    } catch {
      setSubCategoriesSaveError(
        "分類をブラウザに保存できませんでした。最新の変更は、再読み込みや画面を閉じると失われる可能性があります。"
      );
    }
  }, [subCategories, hasLoadError, saveRetryCount]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ----------------------------------------
  // 種目フォームの分類選択・分類追加欄
  // ----------------------------------------

  // 選択中の分類ID。空文字なら分類なし
  const [exerciseSubCategoryId, setExerciseSubCategoryId] =
    useState<string>("");

  // 分類追加欄で入力中の分類名
  const [subCategoryName, setSubCategoryName] = useState<string>("");

  // 分類追加時に表示する入力エラー
  const [subCategoryError, setSubCategoryError] = useState<string>("");

  // ----------------------------------------
  // ホームの記録一覧の検索・絞り込み
  // ----------------------------------------

  // 記録を種目名で検索するための入力文字列
  const [recordSearchText, setRecordSearchText] = useState<string>("");

  // 記録一覧の部位フィルター。"all"なら全部位
  const [recordFilterBodyPart, setRecordFilterBodyPart] =
    useState<BodyPart | "all">("all");

  // 記録一覧の日付フィルター。空文字なら日付で絞り込まない
  const [recordFilterDate, setRecordFilterDate] = useState<string>("");

  // 記録一覧の分類フィルター。空文字ならすべての分類
  const [recordFilterSubCategoryId, setRecordFilterSubCategoryId] =
    useState<string>("");

  // ----------------------------------------
  // 表示する記録を、現在のstateから計算する
  // これらはstateではなく、並べ替え・絞り込みの結果
  // ----------------------------------------

  // records自体を変更せず、コピーを日付の新しい順に並べる
  const sortedRecords = [...records].sort((a, b) => {
    return b.date.localeCompare(a.date);
  });

  // 記録一覧で選択中の部位に対応する、分類フィルターの候補
  const recordFilterSubCategories = subCategories.filter((subCategory) => {
    return subCategory.bodyPart === recordFilterBodyPart;
  });

  // 日付・種目名・部位・分類の条件に合う記録だけを取り出す
  const filteredRecords = sortedRecords.filter((sortedRecord) => {
    if (
      recordFilterDate !== "" &&
      recordFilterDate !== sortedRecord.date
    ) {
      return false;
    }

    const searchText = recordSearchText.trim().toLowerCase();

    // 記録に保存されている種目IDから、現在の種目情報を探す
    const exercise = exercises.find((item) => {
      return item.id === sortedRecord.exerciseId;
    });

    // 種目が見つからない場合は、種目に関する絞り込みがないときだけ表示する
    if (exercise === undefined) {
      return (
        searchText === "" &&
        recordFilterBodyPart === "all" &&
        recordFilterSubCategoryId === ""
      );
    }

    const matchesName =
      searchText === "" ||
      exercise.name.toLocaleLowerCase().includes(searchText);

    const matchesBodyPart =
      recordFilterBodyPart === "all" ||
      exercise.bodyPart === recordFilterBodyPart;

    const matchesSubCategory =
      recordFilterSubCategoryId === "" ||
      recordFilterSubCategoryId === exercise.subCategoryId;

    return matchesName && matchesBodyPart && matchesSubCategory;
  });

  // ----------------------------------------
  // 記録の削除
  // ----------------------------------------

  // 確認ダイアログの承認後に記録を削除する
  // 削除対象を編集中なら編集もキャンセルする。日付別体重は残す
  function handleDeleteRecord(id: string) {
    const confirmed = window.confirm("この記録を削除しますか？");

    if (confirmed === false) {
      return;
    }

    setRecords((prev) => {
      return prev.filter((record) => {
        return record.id !== id;
      });
    });

    if (id === editingRecordId) {
      handleCancelRecordEdit();
    }
  }

  // ----------------------------------------
  // 種目の追加・編集・削除
  // ----------------------------------------

  // 種目フォームの入力を検証し、新規追加または既存種目の更新を行う
  // 更新後はフォームを初期状態に戻す
  function handleSubmitExercise(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const name = exerciseName.trim();

    if (name === "") {
      return setExerciseError("種目名を入力してください。");
    }

    // 編集中の自分自身を除き、同名の種目がないか確認する
    if (
      exercises.some((exercise) => {
        return (
          exercise.name === name &&
          exercise.id !== editingExerciseId
        );
      })
    ) {
      return setExerciseError("同じ名前の種目が登録されています。");
    }

    // 入力欄では空文字、保存データではnullを「分類なし」として使う
    const subCategoryId =
      exerciseSubCategoryId === "" ? null : exerciseSubCategoryId;

    if (subCategoryId !== null) {
      const isValidSubCategory = subCategories.some((subCategory) => {
        return (
          subCategory.id === exerciseSubCategoryId &&
          subCategory.bodyPart === exerciseBodyPart
        );
      });

      if (isValidSubCategory === false) {
        return setExerciseError("選択した部位に合う分類を選んでください。");
      }
    }

    if (editingExerciseId === null) {
      // 新規追加：新しいIDで種目を作り、配列の末尾に追加する
      const newExercise: Exercise = {
        id: crypto.randomUUID(),
        name: name,
        bodyPart: exerciseBodyPart,
        subCategoryId: subCategoryId,
        usesBodyWeight: exerciseUsesBodyWeight,
      };

      setExercises((prev) => [...prev, newExercise]);
    } else {
      // 編集：対象の種目だけ内容を更新する
      setExercises((prev) => {
        return prev.map((item) => {
          if (editingExerciseId === item.id) {
            return {
              ...item,
              name: name,
              bodyPart: exerciseBodyPart,
              subCategoryId: subCategoryId,
              usesBodyWeight: exerciseUsesBodyWeight,
            };
          } else {
            return item;
          }
        });
      });
    }

    resetExerciseForm();
  }

  // 記録で使われている種目は削除を拒否する
  // 未使用なら確認後に削除し、編集中の対象ならフォームもリセットする
  function handleDeleteExercise(id: string) {
    if (
      records.some((record) => {
        return record.exerciseId === id;
      }) === true
    ) {
      return window.alert("記録で使われている種目は削除できません。");
    } else {
      const confirmed = window.confirm("この種目を削除しますか？");

      if (confirmed === false) {
        return;
      }

      setExercises((prev) => {
        return prev.filter((item) => {
          return item.id !== id;
        });
      });

      if (editingExerciseId === id) {
        resetExerciseForm();
      }
    }
  }

  // 選んだ種目の情報をフォームへ入れ、編集モードに切り替える
  // 分類追加欄や、前の操作のエラーはクリアする
  function handleEditExercise(exercise: Exercise) {
    setEditingExerciseId(exercise.id);
    setExerciseName(exercise.name);
    setExerciseBodyPart(exercise.bodyPart);
    setExerciseSubCategoryId(
      exercise.subCategoryId === null ? "" : exercise.subCategoryId
    );
    setExerciseUsesBodyWeight(exercise.usesBodyWeight);
    setExerciseError("");
    setSubCategoryName("");
    setSubCategoryError("");
  }

  // 種目フォームを新規追加用の初期状態へ戻す
  // 登録済みの種目データは変更しない
  function resetExerciseForm() {
    setEditingExerciseId(null);
    setExerciseName("");
    setExerciseBodyPart("chest");
    setExerciseSubCategoryId("");
    setExerciseUsesBodyWeight(false);
    setExerciseError("");
    setSubCategoryName("");
    setSubCategoryError("");
  }

  // 種目管理画面の検索文字列・部位条件に合う種目だけを取り出す
  const filteredExercises = exercises.filter((exercise) => {
    const matchesName = exercise.name
      .toLocaleLowerCase()
      .includes(exerciseSearchText.trim().toLocaleLowerCase());

    const matchesBodyPart =
      exerciseFilterBodyPart === "all" ||
      exercise.bodyPart === exerciseFilterBodyPart;

    return matchesName && matchesBodyPart;
  });

  // ----------------------------------------
  // 記録フォームのセット操作
  // この段階では入力中の値だけを変更し、recordsには反映しない
  // ----------------------------------------

  // 指定したセットの重量または回数を更新する
  // fieldには"weight"か"reps"だけを渡せる
  function handleChangeSet(
    id: string,
    field: "weight" | "reps",
    value: string
  ) {
    setRecordSets((prev) => {
      return prev.map((item) => {
        if (item.id === id) {
          return { ...item, [field]: value };
        } else {
          return item;
        }
      });
    });
  }

  // 重量・回数が空欄のセットを1つ追加する
  function handleAddSet() {
    const newSet = {
      id: crypto.randomUUID(),
      weight: "",
      reps: "",
    };

    setRecordSets((prev) => [...prev, newSet]);
  }

  // 指定したセットを削除する。ただし最低1セットは残す
  function handleDeleteSet(id: string) {
    setRecordSets((prev) => {
      if (prev.length <= 1) {
        return prev;
      } else {
        return prev.filter((item) => {
          return item.id !== id;
        });
      }
    });
  }

  // 入力日付を変更し、その日の確定済み体重を入力欄へ読み込む
  // 体重が未登録またはnullなら、体重入力欄を空にする
  function handleChangeRecordDate(date: string) {
    setRecordDate(date);

    const dailyInfo = dailyInfos.find((item) => {
      return item.date === date;
    });

    if (dailyInfo !== undefined && dailyInfo.bodyWeight !== null) {
      setRecordBodyWeight(String(dailyInfo.bodyWeight));
    } else {
      setRecordBodyWeight("");
    }
  }

  // ----------------------------------------
  // 記録の追加・更新
  // ----------------------------------------

  // 入力を検証し、記録と日付別体重のstateを更新する
  // 更新後はフォームをリセットしてホームへ戻る
  // localStorageへの実際の保存は、各stateの保存用Effectが担当する
  function handleSubmitRecord(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // 日付の形式と実在を確認する
    if (recordDate === "" || !(isValidDate(recordDate))) {
      return setRecordError("実在する正しい日付を選んでください。");
    }

    // フォームで選択された種目の情報を取得する
    const selectedExercise = exercises.find((exercise) => {
      return exercise.id === recordExerciseId;
    });

    if (selectedExercise === undefined) {
      return setRecordError("種目を選んでください。");
    }

    // 編集モードなら、編集対象の元の記録を取得する
    const editingRecord = records.find((record) => {
      return record.id === editingRecordId;
    });

    if (editingRecordId !== null && editingRecord === undefined) {
      return setRecordError("編集対象の記録が見つかりません。");
    }

    // 同じ種目の記録を編集するときは、記録に保存された計算方法を維持する
    // 新規追加または種目変更の場合は、選択先の種目設定を使う
    const usesBodyWeight =
      editingRecord !== undefined &&
        editingRecord.exerciseId === selectedExercise.id
        ? editingRecord.usesBodyWeight
        : selectedExercise.usesBodyWeight;

    // 自分自身を除き、同じ日付・種目の記録がないか確認する
    const hasDuplicateRecord = records.some((record) => {
      return (
        record.exerciseId === selectedExercise.id &&
        record.date === recordDate &&
        record.id !== editingRecordId
      );
    });

    if (hasDuplicateRecord === true) {
      return setRecordError(
        "この日付・種目の記録は登録済みです。既存の記録を編集してセットを追加してください。"
      );
    }

    if (recordSets.length === 0) {
      return setRecordError("最低1セット必要です。");
    }

    // 全セットについて、空欄・重量・回数を検証する
    for (const set of recordSets) {
      if (set.weight.trim() === "" || set.reps.trim() === "") {
        return setRecordError("各セットの重量と回数を入力してください");
      }

      // ここでの数値変換は、入力チェックに使うため
      const weight = Number(set.weight);
      const reps = Number(set.reps);

      if (!Number.isFinite(weight) || weight < 0) {
        return setRecordError("重量は0以上の数値で入力してください。");
      }

      if (!Number.isInteger(reps) || reps < 1) {
        return setRecordError("回数は1以上の整数で入力してください。");
      }
    }

    // 体重の空欄はnull、それ以外は数値に変換する
    const bodyWeight =
      recordBodyWeight.trim() === "" ? null : Number(recordBodyWeight);

    if (
      bodyWeight !== null &&
      (!Number.isFinite(bodyWeight) || bodyWeight <= 0)
    ) {
      return setRecordError("体重は0より大きい数値で入力してください。");
    }

    // 今回保存する記録が自重計算なら体重は必須
    if (usesBodyWeight === true && bodyWeight === null) {
      return setRecordError(
        "この種目を記録するには、その日の体重を入力してください。"
      );
    }

    // 同じ日に、今回の編集対象以外の自重記録があるか確認する
    const hasDuplicateRecordUsesWeight = records.some((record) => {
      return (
        record.date === recordDate &&
        record.usesBodyWeight === true &&
        record.id !== editingRecordId
      );
    });

    // 他の自重記録の計算に必要な体重を、空欄で上書きさせない
    if (hasDuplicateRecordUsesWeight === true && bodyWeight === null) {
      return setRecordError(
        "この日には体重を使う記録があるため、体重を空欄にできません。"
      );
    }

    setRecordError("");

    // 入力チェックを通過したセットを、保存用の数値データへ変換する
    const sets = recordSets.map((recordSet) => {
      return {
        id: recordSet.id,
        weight: Number(recordSet.weight),
        reps: Number(recordSet.reps),
      };
    });

    // 新規ならIDを発行し、編集なら元のIDを維持する
    const recordToSave: WorkoutRecord = {
      id: editingRecordId === null
        ? crypto.randomUUID()
        : editingRecordId,
      date: recordDate,
      exerciseId: selectedExercise.id,
      sets: sets,
      memo: recordMemo,
      usesBodyWeight: usesBodyWeight,
    };

    // 新規追加または、編集対象の記録だけを更新する
    setRecords((prev) => {
      if (editingRecordId === null) {
        return [
          ...prev,
          recordToSave,
        ];
      } else {
        return prev.map((item) => {
          if (item.id === editingRecordId) {
            return {
              ...item,
              date: recordToSave.date,
              exerciseId: recordToSave.exerciseId,
              sets: recordToSave.sets,
              memo: recordToSave.memo,
              usesBodyWeight: recordToSave.usesBodyWeight,
            };
          } else {
            return item;
          }
        });
      }
    });

    // 同じ日付の体重が登録済みなら更新し、なければ追加する
    setDailyInfos((prev) => {
      const checkedDate = prev.some((item) => {
        return item.date === recordDate;
      });

      if (checkedDate === true) {
        return prev.map((item) => {
          if (item.date === recordDate) {
            return {
              ...item,
              bodyWeight: bodyWeight,
            };
          } else {
            return item;
          }
        });
      } else {
        return [
          ...prev,
          {
            date: recordDate,
            bodyWeight: bodyWeight,
          },
        ];
      }
    });

    resetRecordForm();
    navigate("/");
  }

  // ----------------------------------------
  // 体重だけ保存
  // ----------------------------------------

  // 日付と体重を検証し、その日の体重だけを更新する
  // 記録やセットは保存せず、記録入力画面に残る
  function handleSaveBodyWeight() {
    setRecordError("");

    if (recordDate === "" || !(isValidDate(recordDate))) {
      return setRecordError("実在する正しい日付を選んでください。");
    }

    const bodyWeight =
      recordBodyWeight.trim() === "" ? null : Number(recordBodyWeight);

    if (
      bodyWeight !== null &&
      (!Number.isFinite(bodyWeight) || bodyWeight <= 0)
    ) {
      return setRecordError("体重は0より大きい数値で入力してください。");
    }

    // その日の自重記録に必要な体重を、空欄で上書きさせない
    if (
      bodyWeight === null &&
      records.some((record) => {
        return record.date === recordDate && record.usesBodyWeight === true;
      })
    ) {
      return setRecordError(
        "この日の自重種目の記録があるため、体重を空欄にはできません。"
      );
    }

    setDailyInfos((prev) => {
      const hasDailyInfo = prev.some((info) => {
        return info.date === recordDate;
      });

      if (hasDailyInfo) {
        return prev.map((info) => {
          if (info.date === recordDate) {
            return { ...info, bodyWeight: bodyWeight };
          }

          return info;
        });
      }

      return [
        ...prev,
        {
          date: recordDate,
          bodyWeight: bodyWeight,
        },
      ];
    });
  }

  // ----------------------------------------
  // 記録の編集開始・フォームリセット・編集キャンセル
  // ----------------------------------------

  // 選んだ記録をフォームへ読み込み、記録入力画面へ移動する
  // 保存データの重量・回数は数値なので、入力欄用に文字列へ変換する
  function handleEditRecord(record: WorkoutRecord) {
    setEditingRecordId(record.id);
    handleChangeRecordDate(record.date);
    setRecordExerciseId(record.exerciseId);
    setRecordMemo(record.memo);
    setRecordSets(
      record.sets.map((item) => {
        return {
          ...item,
          weight: String(item.weight),
          reps: String(item.reps),
        };
      })
    );
    setRecordError("");
    navigate("/records");
  }

  // 記録フォームを新規追加用に戻す
  // 日付・体重は残し、セットは空欄1つにする。この関数自体は画面移動しない
  function resetRecordForm() {
    setEditingRecordId(null);
    setRecordExerciseId("");
    setRecordMemo("");
    setRecordSets([
      {
        id: crypto.randomUUID(),
        weight: "",
        reps: "",
      },
    ]);
    setRecordError("");
  }

  // 編集中の入力をリセットし、現在選択中の日付の確定済み体重を読み直す
  // 記録の変更は保存せず、ホームへ戻る
  function handleCancelRecordEdit() {
    resetRecordForm();
    handleChangeRecordDate(recordDate);
    navigate("/");
  }

  // ----------------------------------------
  // 記録フォームで使う自重計算設定
  // ----------------------------------------

  // フォームで選択中の種目。見つからなければundefined
  const formSelectExercise = exercises.find((exercise) => {
    return exercise.id === recordExerciseId;
  });

  // 編集中の元の記録。新規追加時や見つからない場合はundefined
  const formEditingRecord = records.find((record) => {
    return record.id === editingRecordId;
  });

  // 現在のフォームで自重計算を使うか。入力ラベルや案内の表示に使う
  // 同じ種目の記録を編集中なら、元の記録の設定を優先する
  let formUsesBodyWeight: boolean;

  if (formSelectExercise === undefined) {
    formUsesBodyWeight = false;
  } else if (
    formEditingRecord !== undefined &&
    formEditingRecord.exerciseId === formSelectExercise.id
  ) {
    formUsesBodyWeight = formEditingRecord.usesBodyWeight;
  } else {
    formUsesBodyWeight = formSelectExercise.usesBodyWeight;
  }

  // ----------------------------------------
  // 分類の候補・追加
  // ----------------------------------------

  // 種目フォームで選択中の部位に対応する分類の選択肢
  const availableSubCategories = subCategories.filter((item) => {
    return item.bodyPart === exerciseBodyPart;
  });

  // 空欄・同じ部位内の同名重複を検証し、新しい分類を追加する
  // 追加した分類を自動選択し、分類追加欄とエラーをクリアする
  function handleAddSubCategory() {
    const name = subCategoryName.trim();

    if (name === "") {
      return setSubCategoryError("分類名を入力してください。");
    }

    if (
      subCategories.some((subCategory) => {
        return (
          subCategory.name === name &&
          subCategory.bodyPart === exerciseBodyPart
        );
      }) === true
    ) {
      return setSubCategoryError(
        "この部位には同じ名前の分類が登録されています。"
      );
    }

    const newSubCategory: SubCategory = {
      id: crypto.randomUUID(),
      name: name,
      bodyPart: exerciseBodyPart,
    };

    setSubCategories((prev) => [...prev, newSubCategory]);
    setExerciseSubCategoryId(newSubCategory.id);
    setSubCategoryError("");
    setSubCategoryName("");
  }

  // ----------------------------------------
  // 読み込みエラー画面
  // すべてのHookより後で分岐する
  // 通常画面を表示せず、追加・編集・削除の操作を止める
  // ----------------------------------------

  if (hasLoadError) {
    return (
      <>
        <h2>保存データを読み込めませんでした</h2>

        {recordsLoadResult.error !== "" && (
          <p role="alert">{recordsLoadResult.error}</p>
        )}

        {exercisesLoadResult.error !== "" && (
          <p role="alert">{exercisesLoadResult.error}</p>
        )}

        {subCategoriesLoadResult.error !== "" && (
          <p role="alert">{subCategoriesLoadResult.error}</p>
        )}

        {dailyInfosLoadResult.error !== "" && (
          <p role="alert">{dailyInfosLoadResult.error}</p>
        )}

        <p>
          保存内容を保護するため、すべての自動保存と追加・編集・削除を停止しています。
        </p>

        {dataIntegrityError !== "" && (
          <p role="alert">{dataIntegrityError}</p>
        )}
      </>
    );
  }

  // ----------------------------------------
  // 通常画面
  // 共通部分はRoutesの外、画面ごとの内容は各Routeの中に置く
  // ----------------------------------------

  return (
    <>
      <h1 className="app-title">筋トレ管理アプリ</h1>

      {/* 全画面共通のナビ。入力値をリセットせずに画面を移動する */}
      <nav className="app-nav">
        <Link to="/">ホーム</Link>
        <Link to="/records">記録入力</Link>
        <Link to="/exercises">種目管理</Link>
      </nav>

      {/* 保存エラーは、どの画面でも確認できる位置に表示する */}
      {recordsSaveError !== "" && (
        <p role="alert">{recordsSaveError}</p>
      )}

      {exercisesSaveError !== "" && (
        <p role="alert">{exercisesSaveError}</p>
      )}

      {subCategoriesSaveError !== "" && (
        <p role="alert">{subCategoriesSaveError}</p>
      )}

      {dailyInfosSaveError !== "" && (
        <p role="alert">{dailyInfosSaveError}</p>
      )}

      {/* 数値を増やして、4つの保存用Effectを再実行する */}
      {haveSaveError === true && (
        <button
          type="button"
          onClick={() => setSaveRetryCount((prev) => prev + 1)}
        >
          保存を再試行
        </button>
      )}

      <Routes>
        {/* ホーム：記録の検索・絞り込み・一覧表示 */}
        <Route
          path="/"
          element={
            <>
              <h2>記録一覧</h2>

              {/* 検索・絞り込みの入力欄をまとめる */}
              <div className="filter-panel record-filter-panel">
                <label className="form-field">
                  種目名で記録を検索
                  <input
                    type="text"
                    value={recordSearchText}
                    onChange={(e) => setRecordSearchText(e.target.value)}
                  />
                </label>

                <label className="form-field">
                  部位で記録を絞り込み
                  <select
                    value={recordFilterBodyPart}
                    onChange={(e) => {
                      setRecordFilterBodyPart(e.target.value as BodyPart | "all");

                      // 部位を変えたら、前の部位の分類選択を解除する
                      setRecordFilterSubCategoryId("");
                    }}
                  >
                    <option value="all">全部位</option>
                    <option value="chest">胸</option>
                    <option value="back">背中</option>
                    <option value="shoulders">肩</option>
                    <option value="biceps">上腕二頭筋</option>
                    <option value="triceps">上腕三頭筋</option>
                    <option value="legs">脚</option>
                    <option value="abs">腹</option>
                    <option value="other">その他</option>
                  </select>
                </label>

                <label className="form-field">
                  分類で記録を絞り込み
                  <select
                    value={recordFilterSubCategoryId}
                    onChange={(e) => setRecordFilterSubCategoryId(e.target.value)}
                    disabled={recordFilterBodyPart === "all"}
                  >
                    <option value="">すべての分類</option>
                    {recordFilterSubCategories.map((item) => {
                      return (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      );
                    })}
                  </select>
                </label>

                <label className="form-field">
                  日付で絞り込み
                  <input
                    type="date"
                    value={recordFilterDate}
                    onChange={(e) => setRecordFilterDate(e.target.value)}
                  />
                </label>

                <div className="form-actions record-filter-actions">
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => setRecordFilterDate("")}
                  >
                    日付の絞り込みを解除
                  </button>
                </div>
              </div>

              <RecordList
                records={records}
                filteredRecords={filteredRecords}
                exercises={exercises}
                dailyInfos={dailyInfos}
                onDeleteRecord={handleDeleteRecord}
                onEditRecord={handleEditRecord}
              />
            </>
          }
        />

        {/* 記録入力：新規追加と編集で同じフォームを使う */}
        <Route
          path="/records"
          element={
            <>
              {/* 入力途中のstateを残したまま種目管理へ移動する */}
              <p>
                <Link to="/exercises">種目を追加・管理する</Link>
              </p>

              <details className="usage-guide">
                <summary>重量の入力方法・ボリュームについて</summary>

                <ul>
                  <li>
                    ダンベル種目は片手分の重量を入力してください。
                    両手分に2倍する必要はありません。
                  </li>
                  <li>
                    自重計算の記録は、その日の体重と追加重量を使います。
                    自重のみの場合は追加重量に0を入力してください。
                  </li>
                  <li>
                    合計ボリュームは、各セットの「重量×回数」の合計です。
                    自重計算では「体重＋追加重量」を重量として使います。
                  </li>
                  <li>
                    ボリュームは同じ種目のトレーニング量を比較する目安です。
                    厳密な身体への負荷を表すものではありません。
                  </li>
                </ul>
              </details>

              {/* 入力値と操作関数を渡し、フォームの表示を任せる */}
              <RecordForm
                onSubmitRecord={handleSubmitRecord}
                editingRecordId={editingRecordId}
                recordDate={recordDate}
                onChangeRecordDate={handleChangeRecordDate}
                recordBodyWeight={recordBodyWeight}
                setRecordBodyWeight={setRecordBodyWeight}
                onSaveBodyWeight={handleSaveBodyWeight}
                recordExerciseId={recordExerciseId}
                setRecordExerciseId={setRecordExerciseId}
                exercises={exercises}
                formUsesBodyWeight={formUsesBodyWeight}
                recordSets={recordSets}
                onChangeSet={handleChangeSet}
                onDeleteSet={handleDeleteSet}
                onAddSet={handleAddSet}
                recordMemo={recordMemo}
                setRecordMemo={setRecordMemo}
                recordError={recordError}
                onCancelRecordEdit={handleCancelRecordEdit}
              />
            </>
          }
        />

        {/* 種目管理：種目フォーム・検索・絞り込み・種目一覧 */}
        <Route
          path="/exercises"
          element={
            <>
              <p>
                <Link to="/records">記録入力へ戻る</Link>
              </p>

              {/* 種目・分類の入力値と操作関数を渡す */}
              <ExerciseForm
                onSubmitExercise={handleSubmitExercise}
                exerciseName={exerciseName}
                setExerciseName={setExerciseName}
                exerciseBodyPart={exerciseBodyPart}
                setExerciseBodyPart={setExerciseBodyPart}
                exerciseSubCategoryId={exerciseSubCategoryId}
                setExerciseSubCategoryId={setExerciseSubCategoryId}
                subCategoryName={subCategoryName}
                setSubCategoryName={setSubCategoryName}
                subCategoryError={subCategoryError}
                setSubCategoryError={setSubCategoryError}
                availableSubCategories={availableSubCategories}
                onAddSubCategory={handleAddSubCategory}
                exerciseUsesBodyWeight={exerciseUsesBodyWeight}
                setExerciseUsesBodyWeight={setExerciseUsesBodyWeight}
                exerciseError={exerciseError}
                editingExerciseId={editingExerciseId}
                onResetExerciseForm={resetExerciseForm}
              />

              <h2>種目一覧</h2>

              {/* 種目一覧の検索・部位フィルター */}
              <div className="filter-panel">
                <label className="form-field">
                  種目名で検索
                  <input
                    type="text"
                    value={exerciseSearchText}
                    onChange={(e) => {
                      setExerciseSearchText(e.target.value);
                    }}
                  />
                </label>

                <label className="form-field">
                  部位で絞り込み
                  <select
                    value={exerciseFilterBodyPart}
                    onChange={(e) => {
                      setExerciseFilterBodyPart(e.target.value as BodyPart | "all");
                    }}
                  >
                    <option value="all">全部位</option>
                    <option value="chest">胸</option>
                    <option value="back">背中</option>
                    <option value="shoulders">肩</option>
                    <option value="biceps">上腕二頭筋</option>
                    <option value="triceps">上腕三頭筋</option>
                    <option value="legs">脚</option>
                    <option value="abs">腹</option>
                    <option value="other">その他</option>
                  </select>
                </label>
              </div>

              <ExerciseList
                exercises={exercises}
                filteredExercises={filteredExercises}
                bodyPartLabels={bodyPartLabels}
                subCategories={subCategories}
                onDeleteExercise={handleDeleteExercise}
                onEditExercise={handleEditExercise}
              />
            </>
          }
        />
      </Routes>
    </>
  );
}

export default App;