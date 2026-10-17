import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabase";
import PasswordResetRequest from "./PasswordResetRequest";

type AuthMode = "login" | "signup";

function AuthForm() {
    const [mode, setMode] = useState<AuthMode>("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [showPasswordReset, setShowPasswordReset] = useState(false);
    const submittingRef = useRef(false);

    if (showPasswordReset) {
        return (
            <PasswordResetRequest
                onBack={() => setShowPasswordReset(false)}
            />
        );
    }

    function handleChangeMode() {
        if (submittingRef.current) {
            return;
        }

        setMode((prev) => (prev === "login" ? "signup" : "login"));
        setPassword("");
        setError("");
        setMessage("");
    }

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();

        if (submittingRef.current) {
            return;
        }

        setError("");
        setMessage("");

        const trimmedEmail = email.trim();

        if (trimmedEmail === "" || password === "") {
            setError("メールアドレスとパスワードを入力してください。");
            return;
        }

        if (mode === "signup" && password.length < 8) {
            setError("パスワードは8文字以上で入力してください。");
            return;
        }

        submittingRef.current = true;
        setIsSubmitting(true);

        try {
            if (mode === "signup") {
                // #以降の画面パスを含めず、アプリの入口へ戻す
                const redirectUrl = new URL(
                    import.meta.env.BASE_URL,
                    window.location.origin
                ).href;

                const { data, error: signUpError } =
                    await supabase.auth.signUp({
                        email: trimmedEmail,
                        password,
                        options: {
                            emailRedirectTo: redirectUrl,
                        },
                    });

                if (signUpError) {
                    setError(signUpError.message);
                    return;
                }

                setPassword("");

                if (data.session === null) {
                    setMessage(
                        "確認メールをご確認ください。すでに登録済みの場合は、ログインをお試しください。"
                    );
                }
            } else {
                const { error: loginError } =
                    await supabase.auth.signInWithPassword({
                        email: trimmedEmail,
                        password,
                    });

                if (loginError) {
                    setError(
                        loginError.code === "invalid_credentials"
                            ? "メールアドレスまたはパスワードが正しくありません。"
                            : loginError.message
                    );
                    return;
                }

                setPassword("");
            }
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
            <h2>{mode === "login" ? "ログイン" : "新規登録"}</h2>

            <p>筋トレの記録を、スマホとPCで共有できます。</p>

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

                    <label className="form-field">
                        パスワード
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete={
                                mode === "login" ? "current-password" : "new-password"
                            }
                            minLength={mode === "signup" ? 8 : undefined}
                            required
                        />
                    </label>

                    {mode === "signup" && (
                        <>
                            <p>パスワードは8文字以上で入力してください。</p>
                            <p>
                                確認メールのリンクは、登録操作をした端末の同じブラウザで開いてください。
                            </p>
                        </>
                    )}

                    <button type="submit">
                        {isSubmitting
                            ? "送信中…"
                            : mode === "login"
                                ? "ログイン"
                                : "新規登録"}
                    </button>

                    <button type="button" onClick={handleChangeMode}>
                        {mode === "login"
                            ? "新規登録はこちら"
                            : "ログインに戻る"}
                    </button>
                    {mode === "login" && (
                        <button
                            type="button"
                            onClick={() => {
                                setPassword("");
                                setError("");
                                setMessage("");
                                setShowPasswordReset(true);
                            }}
                        >
                            パスワードを忘れた方
                        </button>
                    )}
                </fieldset>
            </form>

            {error !== "" && <p role="alert">{error}</p>}
            {message !== "" && <p role="status">{message}</p>}
        </section>
    );
}

export default AuthForm;