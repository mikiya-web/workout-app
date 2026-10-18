import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type UserDataSetupProps = {
  userId: string;
};

type SetupState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      exerciseCount: number;
      subCategoryCount: number;
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
        // DB側の初期登録処理を呼び出す
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

        // 初期登録が成功してから、本人のデータ件数を取得する
        const [exercisesResult, subCategoriesResult] =
          await Promise.all([
            supabase
              .from("exercises")
              .select("id", { count: "exact", head: true })
              .eq("user_id", userId),

            supabase
              .from("sub_categories")
              .select("id", { count: "exact", head: true })
              .eq("user_id", userId),
          ]);

        if (!active) {
          return;
        }

        if (exercisesResult.error) {
          throw new Error(
            `種目の読み込みに失敗しました：${exercisesResult.error.message}`
          );
        }

        if (subCategoriesResult.error) {
          throw new Error(
            `分類の読み込みに失敗しました：${subCategoriesResult.error.message}`
          );
        }

        // 件数が取得できない場合を「0件」として扱わない
        if (
          exercisesResult.count === null ||
          subCategoriesResult.count === null
        ) {
          throw new Error("データの件数を取得できませんでした。");
        }

        setSetupState({
          status: "ready",
          exerciseCount: exercisesResult.count,
          subCategoryCount: subCategoriesResult.count,
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
    return <p role="status">データを準備しています。</p>;
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
      <h2>登録データ</h2>
      <p>種目：{setupState.exerciseCount}件</p>
      <p>分類：{setupState.subCategoryCount}件</p>
    </section>
  );
}

export default UserDataSetup;