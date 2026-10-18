import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  loadExerciseData,
  type StoredExercise,
} from "../lib/exerciseData";
import type { BodyPart, SubCategory } from "../types/workout";
import ExerciseList from "./ExerciseList";

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

  function handleRetry() {
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
      <h2>種目一覧</h2>
      <p>種目：{setupState.exercises.length}件</p>
      <p>分類：{setupState.subCategories.length}件</p>

      <ExerciseList
        exercises={setupState.exercises}
        filteredExercises={setupState.exercises}
        bodyPartLabels={bodyPartLabels}
        subCategories={setupState.subCategories}
      />
    </section>
  );
}

export default UserDataSetup;