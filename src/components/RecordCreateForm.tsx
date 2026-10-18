import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type {
  WorkoutRecord,
  WorkoutSetInput,
} from "../types/workout";
import type { StoredExercise } from "../lib/exerciseData";
import {
  isValidDailyInfoDate,
  loadDailyInfos,
  saveDailyInfo,
  type StoredDailyInfo,
} from "../lib/dailyInfoData";
import {
  createWorkoutRecord,
  loadWorkoutRecords,
  updateWorkoutRecord,
  type CreateWorkoutRecordInput,
  type StoredWorkoutRecord,
  type WorkoutRecordSaveResult,
} from "../lib/workoutRecordData";
import RecordForm from "./RecordForm";
import RecordList from "./RecordList";

type RecordCreateFormProps = {
  userId: string;
  exercises: StoredExercise[];
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready" };

type PendingRecord = {
  signature: string;
  data: CreateWorkoutRecordInput;
};

function getToday(): string {
  const today = new Date();
  const year = String(today.getFullYear()).padStart(4, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createEmptySet(): WorkoutSetInput {
  return {
    id: crypto.randomUUID(),
    weight: "",
    reps: "",
  };
}

function RecordCreateForm({
  userId,
  exercises,
}: RecordCreateFormProps) {
  const [loadState, setLoadState] = useState<LoadState>({
    status: "loading",
  });
  const [retryCount, setRetryCount] = useState(0);

  const [dailyInfos, setDailyInfos] =
    useState<StoredDailyInfo[]>([]);
  const [records, setRecords] =
    useState<StoredWorkoutRecord[]>([]);

  const [editingRecord, setEditingRecord] =
    useState<StoredWorkoutRecord | null>(null);

  const [recordDate, setRecordDate] = useState(getToday);
  const [recordBodyWeight, setRecordBodyWeight] = useState("");
  const [expectedDailyRevision, setExpectedDailyRevision] =
    useState(0);

  const [recordExerciseId, setRecordExerciseId] = useState("");
  const [recordSets, setRecordSets] = useState<WorkoutSetInput[]>(
    () => [createEmptySet()]
  );
  const [recordMemo, setRecordMemo] = useState("");
  const [recordError, setRecordError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const savingRef = useRef(false);
  const mountedRef = useRef(false);
  const pendingRecordRef = useRef<PendingRecord | null>(null);

  const selectedExercise = exercises.find(
    (exercise) => exercise.id === recordExerciseId
  );

  // 同じ種目を編集するときは、記録に保存した計算方法を維持する
  const formUsesBodyWeight =
    editingRecord !== null &&
    editingRecord.exerciseId === recordExerciseId
      ? editingRecord.usesBodyWeight
      : selectedExercise?.usesBodyWeight ?? false;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function prepareRecordData() {
      try {
        const [loadedDailyInfos, loadedRecords] = await Promise.all([
          loadDailyInfos(userId),
          loadWorkoutRecords(userId),
        ]);

        if (!active) {
          return;
        }

        // 記録に対応する日付データと、自重計算に必要な体重を確認する
        const dailyInfoByDate = new Map(
          loadedDailyInfos.map((info) => [info.date, info])
        );

        for (const record of loadedRecords) {
          const dailyInfo = dailyInfoByDate.get(record.date);

          if (dailyInfo === undefined) {
            throw new Error(
              "記録に対応する日付データが見つかりません。再試行してください。"
            );
          }

          if (record.usesBodyWeight && dailyInfo.bodyWeight === null) {
            throw new Error(
              "自重記録に必要な体重が見つかりません。再試行してください。"
            );
          }
        }

        const initialDate = getToday();
        const initialDailyInfo = dailyInfoByDate.get(initialDate);

        setDailyInfos(loadedDailyInfos);
        setRecords(loadedRecords);
        setRecordDate(initialDate);
        setRecordBodyWeight(
          initialDailyInfo?.bodyWeight == null
            ? ""
            : String(initialDailyInfo.bodyWeight)
        );
        setExpectedDailyRevision(initialDailyInfo?.revision ?? 0);
        setLoadState({ status: "ready" });
      } catch (error) {
        if (!active) {
          return;
        }

        setLoadState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "記録・日付別体重の読み込みに失敗しました。",
        });
      }
    }

    void prepareRecordData();

    return () => {
      active = false;
    };
  }, [userId, retryCount]);

  function handleEditRecord(record: WorkoutRecord) {
    if (savingRef.current || loadState.status !== "ready") {
      return;
    }

    const target = records.find((item) => item.id === record.id);

    if (target === undefined || editingRecord?.id === target.id) {
      return;
    }

    const dailyInfo = dailyInfos.find(
      (info) => info.date === target.date
    );

    // 編集開始時の内容と更新番号を保持する
    setEditingRecord({
      ...target,
      sets: target.sets.map((set) => ({ ...set })),
    });

    setRecordDate(target.date);
    setRecordBodyWeight(
      dailyInfo?.bodyWeight == null
        ? ""
        : String(dailyInfo.bodyWeight)
    );
    setExpectedDailyRevision(dailyInfo?.revision ?? 0);
    setRecordExerciseId(target.exerciseId);

    // 保存値はnumber、入力欄ではstringとして扱う
    setRecordSets(
      target.sets.map((set) => ({
        id: set.id,
        weight: String(set.weight),
        reps: String(set.reps),
      }))
    );

    setRecordMemo(target.memo);
    setRecordError("");
    setSuccessMessage("");
    pendingRecordRef.current = null;
  }

  function handleCancelRecordEdit() {
    if (savingRef.current) {
      return;
    }

    const dailyInfo = dailyInfos.find(
      (info) => info.date === recordDate
    );

    setEditingRecord(null);
    setRecordExerciseId("");
    setRecordSets([createEmptySet()]);
    setRecordMemo("");
    setRecordBodyWeight(
      dailyInfo?.bodyWeight == null
        ? ""
        : String(dailyInfo.bodyWeight)
    );
    setExpectedDailyRevision(dailyInfo?.revision ?? 0);
    setRecordError("");
    setSuccessMessage("");
    pendingRecordRef.current = null;
  }

  function handleChangeRecordDate(date: string) {
    if (savingRef.current) {
      return;
    }

    const dailyInfo = dailyInfos.find(
      (info) => info.date === date
    );

    setRecordDate(date);
    setRecordBodyWeight(
      dailyInfo?.bodyWeight == null
        ? ""
        : String(dailyInfo.bodyWeight)
    );
    setExpectedDailyRevision(dailyInfo?.revision ?? 0);
    setRecordError("");
    setSuccessMessage("");
  }

  function applySavedDailyInfo(dailyInfo: StoredDailyInfo) {
    setDailyInfos((prev) => [
      ...prev.filter((info) => info.date !== dailyInfo.date),
      dailyInfo,
    ]);

    setExpectedDailyRevision(dailyInfo.revision);
    setRecordBodyWeight(
      dailyInfo.bodyWeight === null
        ? ""
        : String(dailyInfo.bodyWeight)
    );
  }

  function readBodyWeight(): number | null {
    if (!isValidDailyInfoDate(recordDate)) {
      throw new Error("実在する正しい日付を選んでください。");
    }

    const bodyWeight =
      recordBodyWeight.trim() === ""
        ? null
        : Number(recordBodyWeight);

    if (
      bodyWeight !== null &&
      (!Number.isFinite(bodyWeight) || bodyWeight <= 0)
    ) {
      throw new Error("体重は0より大きい数値で入力してください。");
    }

    return bodyWeight;
  }

  function handleChangeSet(
    id: string,
    field: "weight" | "reps",
    value: string
  ) {
    if (savingRef.current) {
      return;
    }

    setRecordSets((prev) =>
      prev.map((set) =>
        set.id === id ? { ...set, [field]: value } : set
      )
    );
  }

  function handleAddSet() {
    if (savingRef.current) {
      return;
    }

    setRecordSets((prev) => [...prev, createEmptySet()]);
  }

  function handleDeleteSet(id: string) {
    if (savingRef.current) {
      return;
    }

    setRecordSets((prev) =>
      prev.length <= 1
        ? prev
        : prev.filter((set) => set.id !== id)
    );
  }

  async function handleSaveBodyWeight() {
    if (savingRef.current || loadState.status !== "ready") {
      return;
    }

    setRecordError("");
    setSuccessMessage("");

    savingRef.current = true;
    setIsSaving(true);

    try {
      const bodyWeight = readBodyWeight();

      const savedDailyInfo = await saveDailyInfo(
        { date: recordDate, bodyWeight },
        expectedDailyRevision,
        userId
      );

      if (!mountedRef.current) {
        return;
      }

      applySavedDailyInfo(savedDailyInfo);
      setSuccessMessage(`${recordDate}の体重を保存しました。`);
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setRecordError(
        error instanceof Error
          ? error.message
          : "体重の保存に失敗しました。"
      );
    } finally {
      savingRef.current = false;

      if (mountedRef.current) {
        setIsSaving(false);
      }
    }
  }

  async function handleSubmitRecord(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (savingRef.current || loadState.status !== "ready") {
      return;
    }

    setRecordError("");
    setSuccessMessage("");

    savingRef.current = true;
    setIsSaving(true);

    try {
      const bodyWeight = readBodyWeight();

      if (selectedExercise === undefined) {
        throw new Error("種目を選んでください。");
      }

      if (formUsesBodyWeight && bodyWeight === null) {
        throw new Error(
          "この種目を記録するには、その日の体重を入力してください。"
        );
      }

      if (recordSets.length < 1) {
        throw new Error("最低1セット必要です。");
      }

      const sets = recordSets.map((set) => {
        if (set.weight.trim() === "" || set.reps.trim() === "") {
          throw new Error(
            "各セットの重量と回数を入力してください。"
          );
        }

        const weight = Number(set.weight);
        const reps = Number(set.reps);

        if (!Number.isFinite(weight) || weight < 0) {
          throw new Error("重量は0以上の数値で入力してください。");
        }

        if (
          !Number.isInteger(reps) ||
          reps < 1 ||
          reps > 2147483647
        ) {
          throw new Error(
            "回数は1以上の保存可能な整数で入力してください。"
          );
        }

        return {
          id: set.id,
          weight,
          reps,
        };
      });

      const payload = {
        date: recordDate,
        exerciseId: selectedExercise.id,
        expectedExerciseRevision: selectedExercise.revision,
        memo: recordMemo,
        sets,
        bodyWeight,
        expectedDailyRevision,
      };

      let result: WorkoutRecordSaveResult;

      if (editingRecord !== null) {
        // 編集開始時の記録IDと更新番号を送る
        result = await updateWorkoutRecord(
          {
            ...payload,
            id: editingRecord.id,
            expectedRevision: editingRecord.revision,
          },
          userId
        );
      } else {
        const signature = JSON.stringify(payload);

        // 同じ内容の新規追加を再試行するときは、同じ記録IDを使う
        if (pendingRecordRef.current?.signature !== signature) {
          pendingRecordRef.current = {
            signature,
            data: {
              id: crypto.randomUUID(),
              ...payload,
            },
          };
        }

        result = await createWorkoutRecord(
          pendingRecordRef.current.data,
          userId
        );
      }

      if (!mountedRef.current) {
        return;
      }

      applySavedDailyInfo(result.dailyInfo);

      // DBから受け取った保存済みの記録だけを一覧へ反映する
      setRecords((prev) =>
        [
          ...prev.filter((record) => record.id !== result.record.id),
          result.record,
        ].sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            a.id.localeCompare(b.id)
        )
      );

      pendingRecordRef.current = null;

      // 成功した場合だけ編集を終了し、追加フォームへ戻す
      setEditingRecord(null);
      setRecordExerciseId("");
      setRecordSets([createEmptySet()]);
      setRecordMemo("");
      setSuccessMessage(
        `${result.record.date}の「${selectedExercise.name}」を` +
          `${result.record.sets.length}セット` +
          `${editingRecord === null ? "保存" : "更新"}しました。`
      );
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      // 保存に失敗しても、編集対象・入力・再試行用データは残す
      setRecordError(
        error instanceof Error
          ? error.message
          : "記録の保存に失敗しました。"
      );
    } finally {
      savingRef.current = false;

      if (mountedRef.current) {
        setIsSaving(false);
      }
    }
  }

  if (loadState.status === "loading") {
    return <p role="status">記録フォームを準備しています。</p>;
  }

  if (loadState.status === "error") {
    return (
      <section>
        <p role="alert">{loadState.message}</p>
        <button
          type="button"
          onClick={() => {
            setLoadState({ status: "loading" });
            setRetryCount((prev) => prev + 1);
          }}
        >
          再試行
        </button>
      </section>
    );
  }

  return (
    <section>
      {successMessage !== "" && (
        <p role="status">{successMessage}</p>
      )}

      <RecordForm
        onSubmitRecord={handleSubmitRecord}
        editingRecordId={editingRecord?.id ?? null}
        recordDate={recordDate}
        onChangeRecordDate={handleChangeRecordDate}
        recordBodyWeight={recordBodyWeight}
        setRecordBodyWeight={setRecordBodyWeight}
        onSaveBodyWeight={() => {
          void handleSaveBodyWeight();
        }}
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
        isSaving={isSaving}
      />

      <h2>記録一覧</h2>
      <p>記録：{records.length}件</p>

      <fieldset
        disabled={isSaving}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
        <RecordList
          records={records}
          filteredRecords={records}
          exercises={exercises}
          dailyInfos={dailyInfos}
          onEditRecord={handleEditRecord}
        />
      </fieldset>
    </section>
  );
}

export default RecordCreateForm;