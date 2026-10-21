import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type {
  BodyPart,
  Exercise,
  SubCategory,
} from "../types/workout";
import {
  createExercise,
  createSubCategory,
  updateExercise,
  type StoredExercise,
} from "../lib/exerciseData";
import ExerciseForm from "./ExerciseForm";

type ExerciseCreateFormProps = {
  userId: string;
  exercises: StoredExercise[];
  subCategories: SubCategory[];
  editingExercise: StoredExercise | null;
  onExerciseSaved: (exercise: StoredExercise) => void;
  onSubCategoryCreated: (subCategory: SubCategory) => void;
  onCancelEdit: () => void;
  onSavingChange: (isSaving: boolean) => void;
};

type PendingAddition<T> = {
  signature: string;
  data: T;
};

function ExerciseCreateForm({
  userId,
  exercises,
  subCategories,
  editingExercise,
  onExerciseSaved,
  onSubCategoryCreated,
  onCancelEdit,
  onSavingChange,
}: ExerciseCreateFormProps) {
  // 親がkeyを切り替えるため、編集対象が変わると初期値から作り直される
  const [exerciseName, setExerciseName] = useState(
    editingExercise?.name ?? ""
  );
  const [exerciseBodyPart, setExerciseBodyPart] =
    useState<BodyPart>(editingExercise?.bodyPart ?? "chest");
  const [exerciseSubCategoryId, setExerciseSubCategoryId] =
    useState(editingExercise?.subCategoryId ?? "");
  const [exerciseUsesBodyWeight, setExerciseUsesBodyWeight] =
    useState(editingExercise?.usesBodyWeight ?? false);
  const [exerciseError, setExerciseError] = useState("");

  const [subCategoryName, setSubCategoryName] = useState("");
  const [subCategoryError, setSubCategoryError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const savingRef = useRef(false);
  const mountedRef = useRef(false);

  // 同じ入力で追加を再試行するときに、同じIDを使う
  const pendingExerciseRef =
    useRef<PendingAddition<Exercise> | null>(null);
  const pendingSubCategoryRef =
    useRef<PendingAddition<SubCategory> | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const availableSubCategories = subCategories.filter(
    (category) => category.bodyPart === exerciseBodyPart
  );

  function resetExerciseForm() {
    setExerciseName("");
    setExerciseBodyPart("chest");
    setExerciseSubCategoryId("");
    setExerciseUsesBodyWeight(false);
    setExerciseError("");
    setSubCategoryName("");
    setSubCategoryError("");
  }

  function handleCancelEdit() {
    if (savingRef.current) {
      return;
    }

    onCancelEdit();
  }

  async function handleSubmitExercise(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (savingRef.current) {
      return;
    }

    setExerciseError("");

    const name = exerciseName.trim();
    const subCategoryId =
      exerciseSubCategoryId === "" ? null : exerciseSubCategoryId;

    if (name === "") {
      setExerciseError("種目名を入力してください。");
      return;
    }

    // 編集中の種目自身は、同名チェックの対象から除外する
    if (
      exercises.some(
        (exercise) =>
          exercise.id !== editingExercise?.id &&
          exercise.name.trim() === name
      )
    ) {
      setExerciseError("同じ名前の種目が登録されています。");
      return;
    }

    if (
      subCategoryId !== null &&
      !availableSubCategories.some(
        (category) => category.id === subCategoryId
      )
    ) {
      setExerciseError("選択した部位に合う分類を選んでください。");
      return;
    }

    const input = {
      name,
      bodyPart: exerciseBodyPart,
      subCategoryId,
      usesBodyWeight: exerciseUsesBodyWeight,
    };

    // 新規追加の場合だけ、再試行用のUUIDを用意する
    if (editingExercise === null) {
      const signature = JSON.stringify([
        name,
        exerciseBodyPart,
        subCategoryId,
        exerciseUsesBodyWeight,
      ]);

      if (pendingExerciseRef.current?.signature !== signature) {
        pendingExerciseRef.current = {
          signature,
          data: {
            id: crypto.randomUUID(),
            ...input,
          },
        };
      }
    }

    savingRef.current = true;
    setIsSaving(true);
    onSavingChange(true);

    try {
      let savedExercise: StoredExercise;

      if (editingExercise !== null) {
        // 編集開始時のIDとrevisionを使って更新する
        savedExercise = await updateExercise(
          {
            id: editingExercise.id,
            revision: editingExercise.revision,
            ...input,
          },
          userId
        );
      } else {
        const pendingExercise = pendingExerciseRef.current;

        if (pendingExercise === null) {
          throw new Error("保存する種目データが見つかりません。");
        }

        savedExercise = await createExercise(
          pendingExercise.data,
          userId
        );
      }

      if (!mountedRef.current) {
        return;
      }

      pendingExerciseRef.current = null;

      if (editingExercise === null) {
        resetExerciseForm();
      }

      // DBから正常な保存結果を受け取った場合だけ一覧へ反映する
      onExerciseSaved(savedExercise);
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      // 入力内容はリセットせず、エラーだけ表示する
      setExerciseError(
        error instanceof Error
          ? error.message
          : "種目の保存に失敗しました。"
      );
    } finally {
      savingRef.current = false;

      if (mountedRef.current) {
        setIsSaving(false);
        onSavingChange(false);
      }
    }
  }

  async function handleAddSubCategory() {
    if (savingRef.current) {
      return;
    }

    setSubCategoryError("");

    const name = subCategoryName.trim();

    if (name === "") {
      setSubCategoryError("分類名を入力してください。");
      return;
    }

    if (
      subCategories.some(
        (category) =>
          category.bodyPart === exerciseBodyPart &&
          category.name.trim() === name
      )
    ) {
      setSubCategoryError(
        "この部位には同じ名前の分類が登録されています。"
      );
      return;
    }

    const signature = JSON.stringify([name, exerciseBodyPart]);

    if (pendingSubCategoryRef.current?.signature !== signature) {
      pendingSubCategoryRef.current = {
        signature,
        data: {
          id: crypto.randomUUID(),
          name,
          bodyPart: exerciseBodyPart,
        },
      };
    }

    const categoryToSave = pendingSubCategoryRef.current.data;

    savingRef.current = true;
    setIsSaving(true);
    onSavingChange(true);

    try {
      const savedCategory = await createSubCategory(
        categoryToSave,
        userId
      );

      if (!mountedRef.current) {
        return;
      }

      onSubCategoryCreated(savedCategory);
      pendingSubCategoryRef.current = null;

      setExerciseSubCategoryId(savedCategory.id);
      setSubCategoryName("");
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setSubCategoryError(
        error instanceof Error
          ? error.message
          : "分類の保存に失敗しました。"
      );
    } finally {
      savingRef.current = false;

      if (mountedRef.current) {
        setIsSaving(false);
        onSavingChange(false);
      }
    }
  }

  return (
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
      editingExerciseId={editingExercise?.id ?? null}
      onResetExerciseForm={handleCancelEdit}
      isSaving={isSaving}
    />
  );
}

export default ExerciseCreateForm;