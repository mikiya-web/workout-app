import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabase";

type PasswordResetRequestProps = {
  onBack: () => void;
};

function PasswordResetRequest({
  onBack,
}: PasswordResetRequestProps) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const submittingRef = useRef(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (submittingRef.current) {
      return;
    }

    setError("");
    setMessage("");

    const trimmedEmail = email.trim();

    if (trimmedEmail === "") {
      setError("メールアドレスを入力してください。");
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const redirectUrl = new URL(
        import.meta.env.BASE_URL,
        window.location.origin
      );
      redirectUrl.searchParams.set("auth", "recovery");

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(trimmedEmail, {
          redirectTo: redirectUrl.href,
        });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setMessage(
        "登録済みのアドレスであれば、再設定メールが届きます。メールをご確認ください。"
      );
    } catch {
      setError(
        "通信に失敗しました。接続状況を確認して、もう一度お試しください。"
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <section>
      <h2>パスワードの再設定</h2>

      <p>登録したメールアドレスに、再設定用のリンクを送ります。</p>
      <p>
        メールのリンクは、送信操作をした端末の同じブラウザで開いてください。
      </p>

      <form onSubmit={handleSubmit}>
        <fieldset disabled={isSubmitting}>
          <label className="form-field">
            メールアドレス
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <button type="submit">
            {isSubmitting ? "送信中…" : "再設定メールを送る"}
          </button>

          <button type="button" onClick={onBack}>
            ログインに戻る
          </button>
        </fieldset>
      </form>

      {error !== "" && <p role="alert">{error}</p>}
      {message !== "" && <p role="status">{message}</p>}
    </section>
  );
}

export default PasswordResetRequest;