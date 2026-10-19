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
import type { WorkoutRecord } from "../types/workout";
import type { StoredExercise } from "../lib/exerciseData";
import { useWorkoutRecords } from "../hooks/useWorkoutRecords";
import RecordForm from "./RecordForm";
import RecordList from "./RecordList";

type RecordCreateFormProps = {
  userId: string;
  exercises: StoredExercise[];
  children: ReactNode;
  isExerciseBusy: boolean;
};

function RecordCreateForm({
  userId,
  exercises,
  children,
  isExerciseBusy,
}: RecordCreateFormProps) {
  const workout = useWorkoutRecords({ userId, exercises });
  const navigate = useNavigate();
  const location = useLocation();

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
              <p>記録：{workout.records.length}件</p>

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
                  filteredRecords={workout.records}
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