import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  isValidDailyInfoDate,
  loadDailyInfos,
  saveDailyInfo,
  type StoredDailyInfo,
} from "../lib/dailyInfoData";

type DailyBodyWeightFormProps = {
  userId: string;
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready" };

// UTCではなく、利用端末の現地日付を使う
function getToday(): string {
  const today = new Date();
  const year = String(today.getFullYear()).padStart(4, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function DailyBodyWeightForm({
  userId,
}: DailyBodyWeightFormProps) {
  const [loadState, setLoadState] = useState<LoadState>({
    status: "loading",
  });
  const [retryCount, setRetryCount] = useState(0);
  const [dailyInfos, setDailyInfos] =
    useState<StoredDailyInfo[]>([]);

  const [date, setDate] = useState(getToday);
  const [bodyWeightInput, setBodyWeightInput] = useState("");

  // 入力欄へ読み込んだ時点の更新番号を保持する
  const [expectedRevision, setExpectedRevision] = useState(0);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const savingRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function prepareDailyInfos() {
      try {
        const loadedDailyInfos = await loadDailyInfos(userId);

        if (!active) {
          return;
        }

        const initialDate = getToday();
        const initialDailyInfo = loadedDailyInfos.find(
          (info) => info.date === initialDate
        );

        setDailyInfos(loadedDailyInfos);
        setDate(initialDate);
        setBodyWeightInput(
          initialDailyInfo?.bodyWeight == null
            ? ""
            : String(initialDailyInfo.bodyWeight)
        );
        setExpectedRevision(initialDailyInfo?.revision ?? 0);
        setLoadState({ status: "ready" });
      } catch (error) {
        if (!active) {
          return;
        }

        setLoadState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "体重の読み込みに失敗しました。",
        });
      }
    }

    void prepareDailyInfos();

    return () => {
      active = false;
    };
  }, [userId, retryCount]);

  function handleChangeDate(nextDate: string) {
    if (savingRef.current) {
      return;
    }

    const dailyInfo = dailyInfos.find(
      (info) => info.date === nextDate
    );

    setDate(nextDate);
    setBodyWeightInput(
      dailyInfo?.bodyWeight == null
        ? ""
        : String(dailyInfo.bodyWeight)
    );
    setExpectedRevision(dailyInfo?.revision ?? 0);
    setSaveError("");
    setSuccessMessage("");
  }

  function handleRetryLoad() {
    setLoadState({ status: "loading" });
    setRetryCount((prev) => prev + 1);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (savingRef.current || loadState.status !== "ready") {
      return;
    }

    setSaveError("");
    setSuccessMessage("");

    if (!isValidDailyInfoDate(date)) {
      setSaveError("実在する正しい日付を選んでください。");
      return;
    }

    const bodyWeight =
      bodyWeightInput.trim() === ""
        ? null
        : Number(bodyWeightInput);

    if (
      bodyWeight !== null &&
      (!Number.isFinite(bodyWeight) || bodyWeight <= 0)
    ) {
      setSaveError("体重は0より大きい数値で入力してください。");
      return;
    }

    savingRef.current = true;
    setIsSaving(true);

    try {
      const savedDailyInfo = await saveDailyInfo(
        { date, bodyWeight },
        expectedRevision,
        userId
      );

      if (!mountedRef.current) {
        return;
      }

      // 保存が確認できた場合だけ、手元のデータと更新番号を変更する
      setDailyInfos((prev) =>
        [
          ...prev.filter(
            (info) => info.date !== savedDailyInfo.date
          ),
          savedDailyInfo,
        ].sort((a, b) => b.date.localeCompare(a.date))
      );

      setExpectedRevision(savedDailyInfo.revision);
      setBodyWeightInput(
        savedDailyInfo.bodyWeight === null
          ? ""
          : String(savedDailyInfo.bodyWeight)
      );
      setSuccessMessage(
        savedDailyInfo.bodyWeight === null
          ? `${savedDailyInfo.date}の体重を未登録として保存しました。`
          : `${savedDailyInfo.date}の体重を保存しました。`
      );
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      // 入力と更新番号を保持し、同じ内容で再試行できるようにする
      setSaveError(
        error instanceof Error
          ? error.message
          : "体重の保存に失敗しました。"
      );
    } finally {
      savingRef.current = false;

      if (mountedRef.current) {
        setIsSaving(false);
      }
    }
  }

  if (loadState.status === "loading") {
    return <p role="status">日付別体重を読み込んでいます。</p>;
  }

  if (loadState.status === "error") {
    return (
      <section>
        <h2>日別体重</h2>
        <p role="alert">{loadState.message}</p>
        <button type="button" onClick={handleRetryLoad}>
          体重の読み込みを再試行
        </button>
      </section>
    );
  }

  const savedDailyInfo = dailyInfos.find(
    (info) => info.date === date
  );

  return (
    <form
      className="form-panel"
      onSubmit={handleSubmit}
      noValidate
    >
      <h2>日別体重</h2>

      <fieldset
        disabled={isSaving}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
        <label className="form-field">
          日付
          <input
            type="date"
            min="0001-01-01"
            max="9999-12-31"
            value={date}
            onChange={(e) => handleChangeDate(e.target.value)}
          />
        </label>

        <label className="form-field">
          体重（kg・任意）
          <input
            type="text"
            inputMode="decimal"
            value={bodyWeightInput}
            onChange={(e) => {
              setBodyWeightInput(e.target.value);
              setSaveError("");
              setSuccessMessage("");
            }}
          />
        </label>

        <p>
          保存済みの体重：
          {savedDailyInfo?.bodyWeight == null
            ? "未登録"
            : `${savedDailyInfo.bodyWeight} kg`}
        </p>

        <p>日付を変更すると、その日の保存済み体重を読み込みます。</p>

        {saveError !== "" && (
          <p className="form-error" role="alert">
            {saveError}
          </p>
        )}

        {successMessage !== "" && (
          <p role="status">{successMessage}</p>
        )}

        <button type="submit" className="button button-primary">
          {isSaving ? "保存中…" : "体重だけ保存"}
        </button>
      </fieldset>
    </form>
  );
}

export default DailyBodyWeightForm;