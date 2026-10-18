import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  loadExerciseData,
  type StoredExercise,
} from "../lib/exerciseData";
import type {
  BodyPart,
  Exercise,
  SubCategory,
} from "../types/workout";
import ExerciseList from "./ExerciseList";
import ExerciseCreateForm from "./ExerciseCreateForm";

type UserDataSetupProps = {
  userId: string;
};

type SetupState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      exercises: StoredExercise[];
      subCategories: SubCategory[];
    };

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

function UserDataSetup({ userId }: UserDataSetupProps) {
  const [setupState, setSetupState] = useState<SetupState>({
    status: "loading",
  });
  const [retryCount, setRetryCount] = useState(0);

  // 編集開始時のデータを保持する。revisionもここに含まれる
  const [editingExercise, setEditingExercise] =
    useState<StoredExercise | null>(null);
  const [isFormSaving, setIsFormSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function prepareUserData() {
      try {
        const { error: initializeError } =
          await supabase.rpc("initialize_user_data");

        if (!active) {
          return;
        }

        if (initializeError) {
          throw new Error(
            `初期データの準備に失敗しました：${initializeError.message}`
          );
        }

        const { exercises, subCategories } =
          await loadExerciseData(userId);

        if (!active) {
          return;
        }

        setSetupState({
          status: "ready",
          exercises,
          subCategories,
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setSetupState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "データの準備中に問題が発生しました。",
        });
      }
    }

    void prepareUserData();

    return () => {
      active = false;
    };
  }, [userId, retryCount]);

  function handleExerciseSaved(exercise: StoredExercise) {
    setSetupState((prev) => {
      if (prev.status !== "ready") {
        return prev;
      }

      // 新規追加・編集のどちらも、同じIDを保存結果で置き換える
      const exercises = [
        ...prev.exercises.filter((item) => item.id !== exercise.id),
        exercise,
      ].sort((a, b) => a.name.localeCompare(b.name, "ja"));

      return {
        ...prev,
        exercises,
      };
    });

    setEditingExercise(null);
    setIsFormSaving(false);
  }

  function handleSubCategoryCreated(subCategory: SubCategory) {
    setSetupState((prev) => {
      if (prev.status !== "ready") {
        return prev;
      }

      return {
        ...prev,
        subCategories: [
          ...prev.subCategories.filter(
            (item) => item.id !== subCategory.id
          ),
          subCategory,
        ],
      };
    });
  }

  function handleEditExercise(exercise: Exercise) {
    if (isFormSaving || setupState.status !== "ready") {
      return;
    }

    // 一覧のpropsはExercise型なので、revision付きの元データを探す
    const target = setupState.exercises.find(
      (item) => item.id === exercise.id
    );

    if (target === undefined) {
      return;
    }

    // 同じ種目の編集ボタンを再度押しても入力をリセットしない
    if (editingExercise?.id === target.id) {
      return;
    }

    setEditingExercise({ ...target });
  }

  function handleCancelEdit() {
    if (isFormSaving) {
      return;
    }

    setEditingExercise(null);
  }

  function handleRetry() {
    setEditingExercise(null);
    setIsFormSaving(false);
    setSetupState({ status: "loading" });
    setRetryCount((prev) => prev + 1);
  }

  if (setupState.status === "loading") {
    return <p role="status">データを読み込んでいます。</p>;
  }

  if (setupState.status === "error") {
    return (
      <section>
        <p role="alert">{setupState.message}</p>
        <button type="button" onClick={handleRetry}>
          再試行
        </button>
      </section>
    );
  }

  return (
    <section>
      <ExerciseCreateForm
        key={editingExercise?.id ?? "create"}
        userId={userId}
        exercises={setupState.exercises}
        subCategories={setupState.subCategories}
        editingExercise={editingExercise}
        onExerciseSaved={handleExerciseSaved}
        onSubCategoryCreated={handleSubCategoryCreated}
        onCancelEdit={handleCancelEdit}
        onSavingChange={setIsFormSaving}
      />

      <h2>種目一覧</h2>
      <p>種目：{setupState.exercises.length}件</p>
      <p>分類：{setupState.subCategories.length}件</p>

      <fieldset
        disabled={isFormSaving}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
        <ExerciseList
          exercises={setupState.exercises}
          filteredExercises={setupState.exercises}
          bodyPartLabels={bodyPartLabels}
          subCategories={setupState.subCategories}
          onEditExercise={handleEditExercise}
        />
      </fieldset>
    </section>
  );
}

export default UserDataSetup;