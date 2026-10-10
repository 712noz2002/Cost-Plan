interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_PUBLIC_BASE_URL?: string;
  readonly VITE_OPERATOR_PIN?: string;
  readonly VITE_LEGACY_TEST_URL?: string;
  readonly VITE_IDLE_RESET_SECONDS?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
