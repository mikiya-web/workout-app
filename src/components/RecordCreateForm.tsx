import type { FormEvent, ReactNode } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { useState } from "react";
import type {
  BodyPart,
  SubCategory,
  WorkoutRecord,
} from "../types/workout";
import type { StoredExercise } from "../lib/exerciseData";
import { useWorkoutRecords } from "../hooks/useWorkoutRecords";
import RecordForm from "./RecordForm";
import RecordList from "./RecordList";

type RecordCreateFormProps = {
  userId: string;
  exercises: StoredExercise[];
  subCategories: SubCategory[];
  children: ReactNode;
  isExerciseBusy: boolean;
};

function RecordCreateForm({
  userId,
  exercises,
  subCategories,
  children,
  isExerciseBusy,
}: RecordCreateFormProps) {
  const workout = useWorkoutRecords({ userId, exercises });
  const navigate = useNavigate();
  const location = useLocation();

  // 画面を移動しても残しておく検索条件
  const [recordSearchText, setRecordSearchText] = useState("");
  const [recordFilterBodyPart, setRecordFilterBodyPart] =
    useState<BodyPart | "all">("all");
  const [recordFilterSubCategoryId, setRecordFilterSubCategoryId] =
    useState("");
  const [recordFilterDate, setRecordFilterDate] = useState("");

  // 選択した部位に属する分類だけを候補にする
  const recordFilterSubCategories = subCategories.filter(
    (category) => category.bodyPart === recordFilterBodyPart
  );

  const normalizedSearchText = recordSearchText.trim().toLowerCase();

  // 保存済みの記録は変更せず、表示する記録だけを絞り込む
  const filteredRecords = workout.records.filter((record) => {
    const exercise = exercises.find(
      (item) => item.id === record.exerciseId
    );

    const matchesName =
      normalizedSearchText === "" ||
      (exercise?.name.toLowerCase().includes(normalizedSearchText) ??
        false);

    const matchesBodyPart =
      recordFilterBodyPart === "all" ||
      exercise?.bodyPart === recordFilterBodyPart;

    const matchesSubCategory =
      recordFilterSubCategoryId === "" ||
      exercise?.subCategoryId === recordFilterSubCategoryId;

    const matchesDate =
      recordFilterDate === "" ||
      record.date === recordFilterDate;

    return (
      matchesName &&
      matchesBodyPart &&
      matchesSubCategory &&
      matchesDate
    );
  });

  const isBusy = workout.isSaving || isExerciseBusy;
  const isExercisePage = location.pathname === "/exercises";

  function handleEditRecord(record: WorkoutRecord) {
    if (isBusy || workout.loadState.status !== "ready") {
      return;
    }

    workout.handleEditRecord(record);
    navigate("/records");
  }

  function handleCancelRecordEdit() {
    if (isBusy) {
      return;
    }

    workout.handleCancelRecordEdit();
    navigate("/");
  }

  async function handleSubmitRecord(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (isBusy) {
      return;
    }

    const saved = await workout.handleSubmitRecord(event);

    if (saved === true) {
      navigate("/");
    }
  }

  if (workout.loadState.status === "loading") {
    return <p role="status">記録を読み込んでいます。</p>;
  }

  if (workout.loadState.status === "error") {
    return (
      <section>
        <p role="alert">{workout.loadState.message}</p>
        <button
          type="button"
          onClick={workout.handleRetryLoad}
        >
          再試行
        </button>
      </section>
    );
  }

  return (
    <section>
      <nav
        className="app-nav"
        aria-label="メインナビゲーション"
      >
        <NavLink
          to="/"
          end
          aria-disabled={isBusy}
          onClick={(event) => {
            if (isBusy) {
              event.preventDefault();
            }
          }}
        >
          記録一覧
        </NavLink>

        <NavLink
          to="/records"
          aria-disabled={isBusy}
          onClick={(event) => {
            if (isBusy) {
              event.preventDefault();
            }
          }}
        >
          記録入力
        </NavLink>

        <NavLink
          to="/exercises"
          aria-disabled={isBusy}
          onClick={(event) => {
            if (isBusy) {
              event.preventDefault();
            }
          }}
        >
          種目管理
        </NavLink>
      </nav>

      {workout.successMessage !== "" && (
        <p role="status">{workout.successMessage}</p>
      )}

      {/* 入力画面以外でも、削除失敗などのエラーを表示する */}
      {location.pathname !== "/records" &&
        workout.recordError !== "" && (
          <p className="form-error" role="alert">
            {workout.recordError}
          </p>
        )}

      {isBusy && <p role="status">処理中です。</p>}

      <Routes>
        <Route
          path="/"
          element={
            <>
              <h2>記録一覧</h2>
              <p>
                記録：{workout.records.length}件
                （表示：{filteredRecords.length}件）
              </p>

              <div className="filter-panel record-filter-panel">
                <label className="form-field">
                  種目名で記録を検索
                  <input
                    type="text"
                    value={recordSearchText}
                    onChange={(event) =>
                      setRecordSearchText(event.target.value)
                    }
                  />
                </label>

                <label className="form-field">
                  部位で記録を絞り込み
                  <select
                    value={recordFilterBodyPart}
                    onChange={(event) => {
                      setRecordFilterBodyPart(
                        event.target.value as BodyPart | "all"
                      );

                      // 別の部位の分類を条件に残さない
                      setRecordFilterSubCategoryId("");
                    }}
                  >
                    <option value="all">全部位</option>
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
                  分類で記録を絞り込み
                  <select
                    value={recordFilterSubCategoryId}
                    onChange={(event) =>
                      setRecordFilterSubCategoryId(event.target.value)
                    }
                    disabled={recordFilterBodyPart === "all"}
                  >
                    <option value="">すべての分類</option>

                    {recordFilterSubCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  日付で絞り込み
                  <input
                    type="date"
                    value={recordFilterDate}
                    onChange={(event) =>
                      setRecordFilterDate(event.target.value)
                    }
                  />
                </label>

                <div className="form-actions record-filter-actions">
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => setRecordFilterDate("")}
                  >
                    日付の絞り込みを解除
                  </button>
                </div>
              </div>

              <fieldset
                disabled={isBusy}
                style={{
                  border: 0,
                  padding: 0,
                  margin: 0,
                  minWidth: 0,
                }}
              >
                <RecordList
                  records={workout.records}
                  filteredRecords={filteredRecords}
                  exercises={exercises}
                  dailyInfos={workout.dailyInfos}
                  onEditRecord={handleEditRecord}
                  onDeleteRecord={(id) => {
                    if (!isBusy) {
                      void workout.handleDeleteRecord(id);
                    }
                  }}
                />
              </fieldset>
            </>
          }
        />

        <Route
          path="/records"
          element={
            <>
              <p>
                <Link
                  to="/exercises"
                  aria-disabled={isBusy}
                  onClick={(event) => {
                    if (isBusy) {
                      event.preventDefault();
                    }
                  }}
                >
                  種目を追加・管理する
                </Link>
              </p>

              <details className="usage-guide">
                <summary>
                  重量の入力方法・ボリュームについて
                </summary>

                <ul>
                  <li>
                    ダンベル種目は片手分の重量を入力してください。
                    両手分に2倍する必要はありません。
                  </li>
                  <li>
                    自重計算の記録は、その日の体重と追加重量を使います。
                    自重のみの場合は追加重量に0を入力してください。
                  </li>
                  <li>
                    合計ボリュームは、各セットの「重量×回数」の合計です。
                    自重計算では「体重＋追加重量」を重量として使います。
                  </li>
                  <li>
                    ボリュームは同じ種目のトレーニング量を比較する目安です。
                    厳密な身体への負荷を表すものではありません。
                  </li>
                </ul>
              </details>

              <RecordForm
                onSubmitRecord={handleSubmitRecord}
                editingRecordId={workout.editingRecord?.id ?? null}
                recordDate={workout.recordDate}
                onChangeRecordDate={workout.handleChangeRecordDate}
                recordBodyWeight={workout.recordBodyWeight}
                setRecordBodyWeight={workout.setRecordBodyWeight}
                onSaveBodyWeight={() => {
                  if (!isBusy) {
                    void workout.handleSaveBodyWeight();
                  }
                }}
                recordExerciseId={workout.recordExerciseId}
                setRecordExerciseId={workout.setRecordExerciseId}
                exercises={exercises}
                formUsesBodyWeight={workout.formUsesBodyWeight}
                recordSets={workout.recordSets}
                onChangeSet={workout.handleChangeSet}
                onDeleteSet={workout.handleDeleteSet}
                onAddSet={workout.handleAddSet}
                recordMemo={workout.recordMemo}
                setRecordMemo={workout.setRecordMemo}
                recordError={workout.recordError}
                onCancelRecordEdit={handleCancelRecordEdit}
                isSaving={isBusy}
              />
            </>
          }
        />

        {/* 種目管理の内容は、入力保持のため下で常時マウントする */}
        <Route path="/exercises" element={null} />

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>

      {/* hiddenで表示だけ切り替え、種目フォームの入力値を保持する */}
      <div hidden={!isExercisePage}>
        <p>
          <Link
            to="/records"
            aria-disabled={isBusy}
            onClick={(event) => {
              if (isBusy) {
                event.preventDefault();
              }
            }}
          >
            記録入力へ戻る
          </Link>
        </p>

        <fieldset
          disabled={workout.isSaving}
          style={{
            border: 0,
            padding: 0,
            margin: 0,
            minWidth: 0,
          }}
        >
          {children}
        </fieldset>
      </div>
    </section>
  );
}

export default RecordCreateForm;