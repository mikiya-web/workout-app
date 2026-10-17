import { createClient } from "@supabase/supabase-js";

const supabaseUrl: string | undefined =
  import.meta.env.VITE_SUPABASE_URL;

const supabasePublishableKey: string | undefined =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("Supabaseの接続設定が不足しています。");
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
);