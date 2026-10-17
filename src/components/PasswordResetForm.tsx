import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabase";

type PasswordResetFormProps = {
  onComplete: () => void;
};

function PasswordResetForm({
  onComplete,
}: PasswordResetFormProps) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  const submittingRef = useRef(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (submittingRef.current || isComplete) {
      return;
    }

    setError("");

    if (password.length < 8) {
      setError("パスワードは8文字以上で入力してください。");
      return;
    }

    if (password !== confirmation) {
      setError("確認用パスワードが一致しません。");
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        });

      if (updateError) {
        setError(
          updateError.code === "same_password"
            ? "現在とは異なるパスワードを入力してください。"
            : updateError.message
        );
        return;
      }

      setPassword("");
      setConfirmation("");
      setIsComplete(true);
    } catch {
      setError(
        "通信に失敗しました。接続状況を確認して、もう一度お試しください。"
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  if (isComplete) {
    return (
      <section>
        <h2>パスワードを変更しました</h2>
        <p role="status">
          次回から、新しいパスワードでログインできます。
        </p>
        <button type="button" onClick={onComplete}>
          続ける
        </button>
      </section>
    );
  }

  return (
    <section>
      <h2>新しいパスワードの設定</h2>

      <form onSubmit={handleSubmit}>
        <fieldset disabled={isSubmitting}>
          <label className="form-field">
            新しいパスワード
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          <label className="form-field">
            新しいパスワード（確認用）
            <input
              type="password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          <button type="submit">
            {isSubmitting ? "変更中…" : "パスワードを変更"}
          </button>
        </fieldset>
      </form>

      {error !== "" && <p role="alert">{error}</p>}
    </section>
  );
}

export default PasswordResetForm;