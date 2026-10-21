import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { Exercise, WorkoutSetInput } from "../types/workout";

type RecordFormProps = {
  onSubmitRecord: (e: FormEvent<HTMLFormElement>) => void;
  editingRecordId: string | null;
  recordDate: string;
  onChangeRecordDate: (date: string) => void;
  recordBodyWeight: string;
  setRecordBodyWeight: Dispatch<SetStateAction<string>>;
  onSaveBodyWeight: () => void;
  recordExerciseId: string;
  setRecordExerciseId: Dispatch<SetStateAction<string>>;
  exercises: Exercise[];
  formUsesBodyWeight: boolean;
  recordSets: WorkoutSetInput[];
  onChangeSet: (
    id: string,
    field: "weight" | "reps",
    value: string
  ) => void;
  onDeleteSet: (id: string) => void;
  onAddSet: () => void;
  recordMemo: string;
  setRecordMemo: Dispatch<SetStateAction<string>>;
  recordError: string;
  onCancelRecordEdit: () => void;
  isSaving?: boolean;
};

// 入力値と操作関数を親から受け取り、記録フォームを表示する
function RecordForm(props: RecordFormProps) {
  const {
    onSubmitRecord,
    editingRecordId,
    recordDate,
    onChangeRecordDate,
    recordBodyWeight,
    setRecordBodyWeight,
    onSaveBodyWeight,
    recordExerciseId,
    setRecordExerciseId,
    exercises,
    formUsesBodyWeight,
    recordSets,
    onChangeSet,
    onDeleteSet,
    onAddSet,
    recordMemo,
    setRecordMemo,
    recordError,
    onCancelRecordEdit,
    isSaving = false,
  }: RecordFormProps = props;

  return (
    <form
      className="form-panel"
      onSubmit={onSubmitRecord}
      noValidate
    >
      <h2>{editingRecordId === null ? "記録追加" : "記録編集"}</h2>

      <fieldset
        disabled={isSaving}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
        <label className="form-field">
          日付
          <input
            type="date"
            value={recordDate}
            onChange={(e) => onChangeRecordDate(e.target.value)}
          />
        </label>

        <label className="form-field">
          その日の体重（kg）
          <input
            type="number"
            step="any"
            value={recordBodyWeight}
            onChange={(e) => setRecordBodyWeight(e.target.value)}
            disabled={recordDate === ""}
          />
        </label>

        <button
          type="button"
          className="button button-secondary"
          onClick={onSaveBodyWeight}
        >
          体重だけ保存
        </button>

        <label className="form-field">
          種目
          <select
            value={recordExerciseId}
            onChange={(e) => {
              setRecordExerciseId(e.target.value);
            }}
          >
            <option value="">種目を選んでください</option>

            {exercises.map((exercise) => {
              return (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </option>
              );
            })}
          </select>
        </label>

        {formUsesBodyWeight && (
          <p className="form-note">
            体重を含めて計算します。自重のみの場合、追加重量は0kgと入力してください。
          </p>
        )}

        {/* 番号は表示用で、セットの識別にはIDを使う */}
        <div className="set-list">
          {recordSets.map((item, index) => {
            return (
              <fieldset key={item.id} className="set-card">
                <legend className="set-card-title">
                  セット {index + 1}
                </legend>

                <div className="set-fields">
                  <label className="form-field">
                    {formUsesBodyWeight
                      ? "追加重量（kg）"
                      : "重量（kg）"}
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={item.weight}
                      onChange={(e) =>
                        onChangeSet(item.id, "weight", e.target.value)
                      }
                    />
                  </label>

                  <label className="form-field">
                    回数
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={item.reps}
                      onChange={(e) =>
                        onChangeSet(item.id, "reps", e.target.value)
                      }
                    />
                  </label>
                </div>

                <div className="set-actions">
                  <button
                    type="button"
                    className="button button-danger"
                    onClick={() => onDeleteSet(item.id)}
                    disabled={recordSets.length <= 1}
                    aria-label={`セット${index + 1}を削除`}
                  >
                    セットを削除
                  </button>
                </div>
              </fieldset>
            );
          })}
        </div>

        <button
          type="button"
          className="button button-secondary"
          onClick={onAddSet}
        >
          セットを追加
        </button>

        <label className="form-field">
          メモ（任意）
          <textarea
            value={recordMemo}
            onChange={(e) => {
              setRecordMemo(e.target.value);
            }}
          />
        </label>

        {recordError !== "" && (
          <p className="form-error" role="alert">
            {recordError}
          </p>
        )}

        <div className="form-actions">
          <button type="submit" className="button button-primary">
            {isSaving
              ? "保存中…"
              : editingRecordId === null
                ? "記録保存"
                : "変更保存"}
          </button>

          {editingRecordId !== null && (
            <button
              type="button"
              className="button button-secondary"
              onClick={onCancelRecordEdit}
            >
              キャンセル
            </button>
          )}
        </div>
      </fieldset>
    </form>
  );
}

export default RecordForm;