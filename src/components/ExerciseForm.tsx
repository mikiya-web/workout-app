import type { BodyPart, SubCategory } from "../types/workout";
import type { Dispatch, SetStateAction, FormEvent } from "react";

type ExerciseFormProps = {
  onSubmitExercise: (e: FormEvent<HTMLFormElement>) => void;
  exerciseName: string;
  setExerciseName: Dispatch<SetStateAction<string>>;
  exerciseBodyPart: BodyPart;
  setExerciseBodyPart: Dispatch<SetStateAction<BodyPart>>;
  exerciseSubCategoryId: string;
  setExerciseSubCategoryId: Dispatch<SetStateAction<string>>;
  subCategoryName: string;
  setSubCategoryName: Dispatch<SetStateAction<string>>;
  subCategoryError: string;
  setSubCategoryError: Dispatch<SetStateAction<string>>;
  availableSubCategories: SubCategory[];
  onAddSubCategory: () => void;
  exerciseUsesBodyWeight: boolean;
  setExerciseUsesBodyWeight: Dispatch<SetStateAction<boolean>>;
  exerciseError: string;
  editingExerciseId: string | null;
  onResetExerciseForm: () => void;
};

// 入力値と操作関数をAppから受け取り、種目フォームを表示する
function ExerciseForm(props: ExerciseFormProps) {
  const {
    onSubmitExercise,
    exerciseName,
    setExerciseName,
    exerciseBodyPart,
    setExerciseBodyPart,
    exerciseSubCategoryId,
    setExerciseSubCategoryId,
    subCategoryName,
    setSubCategoryName,
    subCategoryError,
    setSubCategoryError,
    availableSubCategories,
    onAddSubCategory,
    exerciseUsesBodyWeight,
    setExerciseUsesBodyWeight,
    exerciseError,
    editingExerciseId,
    onResetExerciseForm,
  }: ExerciseFormProps = props;

  return (
    <form className="form-panel" onSubmit={onSubmitExercise}>
      <h2>{editingExerciseId === null ? "種目追加" : "種目編集"}</h2>

      <label className="form-field">
        種目名
        <input
          type="text"
          value={exerciseName}
          onChange={(e) => {
            setExerciseName(e.target.value);
          }}
        />
      </label>

      <label className="form-field">
        部位
        <select
          value={exerciseBodyPart}
          onChange={(e) => {
            setExerciseBodyPart(e.target.value as BodyPart);

            // 部位を変えたら、以前の分類選択と分類追加欄をリセットする
            setExerciseSubCategoryId("");
            setSubCategoryName("");
            setSubCategoryError("");
          }}
        >
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
        細かい分類（任意）
        <select
          value={exerciseSubCategoryId}
          onChange={(e) => setExerciseSubCategoryId(e.target.value)}
        >
          <option value="">分類なし</option>

          {availableSubCategories.map((availableSubCategory) => {
            return (
              <option
                key={availableSubCategory.id}
                value={availableSubCategory.id}
              >
                {availableSubCategory.name}
              </option>
            );
          })}
        </select>
      </label>

      <label className="form-field">
        新しい分類名
        <input
          type="text"
          value={subCategoryName}
          onChange={(e) => setSubCategoryName(e.target.value)}
        />
      </label>

      {subCategoryError !== "" && (
        <p className="form-error" role="alert">
          {subCategoryError}
        </p>
      )}

      <button
        type="button"
        className="button button-secondary"
        onClick={onAddSubCategory}
      >
        選択中の部位に分類を追加
      </button>

      <label className="checkbox-field">
        計算に体重を含める
        <input
          type="checkbox"
          checked={exerciseUsesBodyWeight}
          onChange={(e) => {
            setExerciseUsesBodyWeight(e.target.checked);
          }}
        />
      </label>

      {exerciseError !== "" && (
        <p className="form-error" role="alert">
          {exerciseError}
        </p>
      )}

      {/* 保存・キャンセルボタンをまとめて配置する */}
      <div className="form-actions">
        <button type="submit" className="button button-primary">
          {editingExerciseId === null ? "種目を保存" : "変更を保存"}
        </button>

        {editingExerciseId !== null && (
          <button
            type="button"
            className="button button-secondary"
            onClick={onResetExerciseForm}
          >
            キャンセル
          </button>
        )}
      </div>
    </form>
  );
}

export default ExerciseForm;