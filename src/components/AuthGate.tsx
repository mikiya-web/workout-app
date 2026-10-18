import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import AuthForm from "./AuthForm";
import PasswordResetForm from "./PasswordResetForm";
import UserDataSetup from "./UserDataSetup";

type AuthState =
  | { status: "loading" }
  | { status: "ready"; session: Session | null }
  | { status: "error"; message: string };

function AuthGate() {
  const [authState, setAuthState] = useState<AuthState>({
    status: "loading",
  });
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [isRecovering, setIsRecovering] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("auth") === "recovery";
  });

  useEffect(() => {
    let active = true;
    let authChanged = false;

    // 起動後のログイン・ログアウトなどの変化を受け取る
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // 起動時の取得結果は、下のgetSessionで処理する
        if (!active || event === "INITIAL_SESSION") {
          return;
        }

        authChanged = true;

        if (event === "PASSWORD_RECOVERY") {
          setIsRecovering(true);
        }

        setAuthState({ status: "ready", session });
      }
    );

    // ブラウザに保存されているログイン状態を確認する
    async function loadSession() {
      try {
        const { data, error } = await supabase.auth.getSession();

        // 画面が終了した場合や、より新しい認証状態が届いた場合は反映しない
        if (!active || authChanged) {
          return;
        }

        if (error) {
          setAuthState({
            status: "error",
            message: "ログイン状態を確認できませんでした。",
          });
          return;
        }

        setAuthState({
          status: "ready",
          session: data.session,
        });
      } catch {
        if (!active || authChanged) {
          return;
        }

        setAuthState({
          status: "error",
          message: "ログイン状態の確認中に問題が発生しました。",
        });
      }
    }

    void loadSession();

    // このコンポーネントが終了するときに監視を解除する
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    setSignOutError("");

    try {
      const { error } = await supabase.auth.signOut({
        scope: "local",
      });

      if (error) {
        setSignOutError("ログアウトできませんでした。もう一度お試しください。");
      }
    } catch {
      setSignOutError("通信に失敗しました。接続状況を確認してください。");
    } finally {
      setIsSigningOut(false);
    }
  }

  function handleFinishRecovery() {
    const url = new URL(window.location.href);
    url.searchParams.delete("auth");

    window.history.replaceState(
      window.history.state,
      "",
      url.href
    );

    setIsRecovering(false);
  }

  if (authState.status === "loading") {
    return <p role="status">ログイン状態を確認しています。</p>;
  }

  if (authState.status === "error") {
    return (
      <main>
        <p role="alert">{authState.message}</p>
        <button type="button" onClick={() => window.location.reload()}>
          再読み込み
        </button>
      </main>
    );
  }

  if (isRecovering) {
    return (
      <main>
        <h1>筋トレ管理アプリ</h1>

        {authState.session === null ? (
          <section>
            <p role="alert">
              再設定に必要なログイン状態を確認できませんでした。
              リンクの期限切れや、別のブラウザで開いた可能性があります。
              再設定メールをもう一度リクエストしてください。
            </p>
            <button
              type="button"
              onClick={handleFinishRecovery}
            >
              ログイン画面へ戻る
            </button>
          </section>
        ) : (
          <PasswordResetForm
            onComplete={handleFinishRecovery}
          />
        )}
      </main>
    );
  }

  return (
    <main>
      <h1>筋トレ管理アプリ</h1>

      {authState.session === null ? (
        <AuthForm />
      ) : (
        <section>
          <p role="status">ログインしています。</p>
          <UserDataSetup
            key={authState.session.user.id}
            userId={authState.session.user.id}
          />

          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            {isSigningOut ? "ログアウト中…" : "ログアウト"}
          </button>

          {signOutError !== "" && (
            <p role="alert">{signOutError}</p>
          )}
        </section>
      )}
    </main>
  );
}

export default AuthGate;