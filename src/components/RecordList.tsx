import type { WorkoutRecord, Exercise, DailyInfo } from "../types/workout";

type RecordListProps = {
  records: WorkoutRecord[];
  filteredRecords: WorkoutRecord[];
  exercises: Exercise[];
  dailyInfos: DailyInfo[];
  onDeleteRecord?: (id: string) => void;
  onEditRecord?: (record: WorkoutRecord) => void;
};

// 日付順に絞り込まれた記録を表示する
// 編集・削除はAppの関数を呼び出す
function RecordList(props: RecordListProps) {
  const {
    records,
    filteredRecords,
    exercises,
    dailyInfos,
    onDeleteRecord,
    onEditRecord,
  }: RecordListProps = props;

  return (
    <>
      {records.length === 0 && (
        <p className="empty-message">まだ記録がありません。</p>
      )}

      {records.length > 0 && filteredRecords.length === 0 && (
        <p className="empty-message">
          条件に一致する記録がありません。
        </p>
      )}

      <div className="record-list">
        {filteredRecords.map((record, index) => {
          // 種目IDから、現在の種目情報を取得する
          const exercise = exercises.find((item) => {
            return item.id === record.exerciseId;
          });

          // 記録と同じ日付の体重を取得する
          const dailyInfo = dailyInfos.find((item) => {
            return item.date === record.date;
          });

          const bodyWeight = dailyInfo ? dailyInfo.bodyWeight : null;

          // 自重記録なのに体重がない場合は、計算不可をnullで表す
          let totalVolume: number | null;

          if (record.usesBodyWeight === true && bodyWeight === null) {
            totalVolume = null;
          } else {
            totalVolume = record.sets.reduce((sum, set) => {
              if (record.usesBodyWeight === true && bodyWeight !== null) {
                return sum + (set.weight + bodyWeight) * set.reps;
              } else {
                return sum + set.weight * set.reps;
              }
            }, 0);
          }

          // 一覧の先頭、または直前の記録と日付が違う場合だけ日付を表示する
          const checked =
            index === 0 ||
            filteredRecords[index - 1].date !== record.date;

          return (
            <div key={record.id} className="record-entry">
              {checked && (
                <div className="record-date-header">
                  <h3 className="record-date">{record.date}</h3>

                  <p className="record-body-weight">
                    {dailyInfo && dailyInfo.bodyWeight !== null
                      ? `体重：${dailyInfo.bodyWeight}kg`
                      : "体重：未登録"}
                  </p>
                </div>
              )}

              <div className="record-card">
                <p className="record-name">
                  {exercise ? exercise.name : "種目が見つかりません"}
                </p>

                {/* 自重記録では、表示している重量が追加重量だと分かるようにする */}
                {record.usesBodyWeight && (
                  <p className="record-weight-note">
                    重量は追加重量です（体重を含めてボリューム計算）。
                  </p>
                )}

                <ol className="record-set-list">
                  {record.sets.map((set, setIndex) => {
                    return (
                      <li key={set.id} className="record-set">
                        <span className="record-set-number">
                          セット {setIndex + 1}
                        </span>

                        <span className="record-set-value">
                          {set.weight}kg × {set.reps}回
                        </span>
                      </li>
                    );
                  })}
                </ol>

                {record.memo !== "" && (
                  <p className="record-memo">{record.memo}</p>
                )}

                <p className="record-volume">
                  {totalVolume !== null
                    ? `合計ボリューム：${totalVolume}kg`
                    : "合計ボリューム：体重未登録のため計算できません"}
                </p>

                {(onEditRecord || onDeleteRecord) && (
                  <div className="form-actions">
                    {onEditRecord && (
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => onEditRecord(record)}
                      >
                        編集
                      </button>
                    )}

                    {onDeleteRecord && (
                      <button
                        type="button"
                        className="button button-danger"
                        onClick={() => onDeleteRecord(record.id)}
                      >
                        削除
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default RecordList;