import type { Exercise, BodyPart, SubCategory } from "../types/workout";

type ExerciseListProps = {
  exercises: Exercise[];
  filteredExercises: Exercise[];
  bodyPartLabels: Record<BodyPart, string>;
  subCategories: SubCategory[];
  onDeleteExercise: (id: string) => void;
  onEditExercise: (exercise: Exercise) => void;
};

// 絞り込まれた種目を表示し、編集・削除の処理はAppに任せる
function ExerciseList(props: ExerciseListProps) {
  const {
    exercises,
    filteredExercises,
    bodyPartLabels,
    subCategories,
    onDeleteExercise,
    onEditExercise,
  }: ExerciseListProps = props;

  return (
    <>
      {exercises.length === 0 && (
        <p className="empty-message">まだ種目がありません。</p>
      )}

      {exercises.length > 0 && filteredExercises.length === 0 && (
        <p className="empty-message">
          条件に一致する種目がありません。
        </p>
      )}

      <ul className="exercise-list">
        {filteredExercises.map((exercise) => {
          // 種目の分類IDから、表示する分類名を取得する
          const subCategory = subCategories.find((item) => {
            return item.id === exercise.subCategoryId;
          });

          let subCategoryLabel: string;

          if (exercise.subCategoryId === null) {
            subCategoryLabel = "分類なし";
          } else if (subCategory !== undefined) {
            subCategoryLabel = subCategory.name;
          } else {
            subCategoryLabel = "分類不明";
          }

          return (
            <li key={exercise.id} className="exercise-card">
              <p className="exercise-card-name">{exercise.name}</p>

              <p className="exercise-card-meta">
                {bodyPartLabels[exercise.bodyPart]}/{subCategoryLabel}
              </p>

              <div className="form-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => onEditExercise(exercise)}
                >
                  編集
                </button>

                <button
                  type="button"
                  className="button button-danger"
                  onClick={() => onDeleteExercise(exercise.id)}
                >
                  削除
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default ExerciseList;