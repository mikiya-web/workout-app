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
  type StoredExercise,
} from "../lib/exerciseData";
import ExerciseForm from "./ExerciseForm";

type ExerciseCreateFormProps = {
  userId: string;
  exercises: StoredExercise[];
  subCategories: SubCategory[];
  onExerciseCreated: (exercise: StoredExercise) => void;
  onSubCategoryCreated: (subCategory: SubCategory) => void;
};

type PendingAddition<T> = {
  signature: string;
  data: T;
};

function ExerciseCreateForm({
  userId,
  exercises,
  subCategories,
  onExerciseCreated,
  onSubCategoryCreated,
}: ExerciseCreateFormProps) {
  const [exerciseName, setExerciseName] = useState("");
  const [exerciseBodyPart, setExerciseBodyPart] =
    useState<BodyPart>("chest");
  const [exerciseSubCategoryId, setExerciseSubCategoryId] =
    useState("");
  const [exerciseUsesBodyWeight, setExerciseUsesBodyWeight] =
    useState(false);
  const [exerciseError, setExerciseError] = useState("");

  const [subCategoryName, setSubCategoryName] = useState("");
  const [subCategoryError, setSubCategoryError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const savingRef = useRef(false);
  const mountedRef = useRef(false);

  // 同じ入力で再試行するときに、同じIDを使うための保管場所
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

    if (exercises.some((exercise) => exercise.name.trim() === name)) {
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

    const signature = JSON.stringify([
      name,
      exerciseBodyPart,
      subCategoryId,
      exerciseUsesBodyWeight,
    ]);

    // 同じ内容の再送ならIDを維持し、内容が変わったら新しい操作とする
    if (pendingExerciseRef.current?.signature !== signature) {
      pendingExerciseRef.current = {
        signature,
        data: {
          id: crypto.randomUUID(),
          name,
          bodyPart: exerciseBodyPart,
          subCategoryId,
          usesBodyWeight: exerciseUsesBodyWeight,
        },
      };
    }

    const exerciseToSave = pendingExerciseRef.current.data;

    savingRef.current = true;
    setIsSaving(true);

    try {
      const savedExercise = await createExercise(
        exerciseToSave,
        userId
      );

      // ログアウトなどで画面が終了した後は、結果を画面へ反映しない
      if (!mountedRef.current) {
        return;
      }

      onExerciseCreated(savedExercise);
      pendingExerciseRef.current = null;
      resetExerciseForm();
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setExerciseError(
        error instanceof Error
          ? error.message
          : "種目の保存に失敗しました。"
      );
    } finally {
      savingRef.current = false;

      if (mountedRef.current) {
        setIsSaving(false);
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

      // 追加した分類を選択し、種目の入力内容は残す
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
      editingExerciseId={null}
      onResetExerciseForm={resetExerciseForm}
      isSaving={isSaving}
    />
  );
}

export default ExerciseCreateForm;