import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import {
    deleteExercise,
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
import RecordCreateForm from "./RecordCreateForm";

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

    const [editingExercise, setEditingExercise] =
        useState<StoredExercise | null>(null);
    const [isFormSaving, setIsFormSaving] = useState(false);

    const [deletingExerciseId, setDeletingExerciseId] =
        useState<string | null>(null);
    const [deleteError, setDeleteError] = useState("");

    // stateが画面へ反映される前の連続操作も防ぐ
    const formSavingRef = useRef(false);
    const deletingRef = useRef(false);

    // ログアウトなどで画面が終了した後の結果反映を防ぐ
    const mountedRef = useRef(false);

    const isBusy = isFormSaving || deletingExerciseId !== null;

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;
        };
    }, []);

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

    function handleFormSavingChange(isSaving: boolean) {
        formSavingRef.current = isSaving;
        setIsFormSaving(isSaving);
    }

    function handleExerciseSaved(exercise: StoredExercise) {
        setSetupState((prev) => {
            if (prev.status !== "ready") {
                return prev;
            }

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
        handleFormSavingChange(false);
        setDeleteError("");
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
        if (
            formSavingRef.current ||
            deletingRef.current ||
            setupState.status !== "ready"
        ) {
            return;
        }

        const target = setupState.exercises.find(
            (item) => item.id === exercise.id
        );

        if (target === undefined) {
            return;
        }

        if (editingExercise?.id === target.id) {
            return;
        }

        setDeleteError("");
        setEditingExercise({ ...target });
    }

    function handleCancelEdit() {
        if (formSavingRef.current || deletingRef.current) {
            return;
        }

        setEditingExercise(null);
    }

    async function handleDeleteExercise(id: string) {
        if (
            formSavingRef.current ||
            deletingRef.current ||
            setupState.status !== "ready"
        ) {
            return;
        }

        const target = setupState.exercises.find(
            (exercise) => exercise.id === id
        );

        if (target === undefined) {
            return;
        }

        const confirmed = window.confirm(
            `「${target.name}」を削除しますか？この操作は元に戻せません。`
        );

        if (!confirmed) {
            return;
        }

        deletingRef.current = true;
        setDeletingExerciseId(id);
        setDeleteError("");

        try {
            await deleteExercise(target);

            if (!mountedRef.current) {
                return;
            }

            // 削除完了を確認した後にだけ、一覧から取り除く
            setSetupState((prev) => {
                if (prev.status !== "ready") {
                    return prev;
                }

                return {
                    ...prev,
                    exercises: prev.exercises.filter(
                        (exercise) => exercise.id !== id
                    ),
                };
            });

            // 編集中の種目を削除した場合は、追加フォームへ戻す
            setEditingExercise((prev) =>
                prev?.id === id ? null : prev
            );
        } catch (error) {
            if (!mountedRef.current) {
                return;
            }

            // 一覧や編集中の入力は残し、エラーだけ表示する
            setDeleteError(
                error instanceof Error
                    ? error.message
                    : "種目の削除に失敗しました。"
            );
        } finally {
            deletingRef.current = false;

            if (mountedRef.current) {
                setDeletingExerciseId(null);
            }
        }
    }

    function handleRetry() {
        setEditingExercise(null);
        handleFormSavingChange(false);
        setDeleteError("");
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
            <RecordCreateForm
                key={userId}
                userId={userId}
                exercises={setupState.exercises}
                isExerciseBusy={isBusy}
            >

                {/* 削除中もフォームは残し、操作だけを止める */}
                <fieldset
                    disabled={deletingExerciseId !== null}
                    style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
                >
                    <ExerciseCreateForm
                        key={editingExercise?.id ?? "create"}
                        userId={userId}
                        exercises={setupState.exercises}
                        subCategories={setupState.subCategories}
                        editingExercise={editingExercise}
                        onExerciseSaved={handleExerciseSaved}
                        onSubCategoryCreated={handleSubCategoryCreated}
                        onCancelEdit={handleCancelEdit}
                        onSavingChange={handleFormSavingChange}
                    />
                </fieldset>

                <h2>種目一覧</h2>
                <p>種目：{setupState.exercises.length}件</p>
                <p>分類：{setupState.subCategories.length}件</p>

                {deletingExerciseId !== null && (
                    <p role="status">種目を削除しています。</p>
                )}

                {deleteError !== "" && (
                    <p className="form-error" role="alert">
                        {deleteError}
                    </p>
                )}

                <fieldset
                    disabled={isBusy}
                    style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
                >
                    <ExerciseList
                        exercises={setupState.exercises}
                        filteredExercises={setupState.exercises}
                        bodyPartLabels={bodyPartLabels}
                        subCategories={setupState.subCategories}
                        onEditExercise={handleEditExercise}
                        onDeleteExercise={(id) => {
                            void handleDeleteExercise(id);
                        }}
                    />
                </fieldset>
            </RecordCreateForm>
        </section>
    );
}

export default UserDataSetup;