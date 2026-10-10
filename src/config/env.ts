/**
 * 설정값. 우선순위: dist/config.js(런타임) > 빌드 시점 VITE_* 환경변수 > 기본값.
 *
 * 런타임 config.json 덕분에 npm/빌드 도구 없이도 배포된 dist 폴더의 파일 하나만 고쳐서 서버 주소 등을 바꿀 수 있다.
 * 이 값들은 모두 브라우저에 그대로 노출된다. Supabase는 anon(공개) 키만 넣고, service_role 키는 절대 넣지 않는다.
 * 운영자 PIN은 전시장에서 실수로 설정 패널이 열리는 것을 막는 용도일 뿐 보안 장치가 아니다.
 */
const num = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export interface Env {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** QR에 들어갈 공개 주소 (HTTPS). 비워두면 현재 접속 주소를 사용. */
  publicBaseUrl: string;
  operatorPin: string;
  /** 기존 '카드 소거형 테스트' 단일 HTML의 위치. 삭제·덮어쓰기 없이 iframe으로만 불러온다. */
  legacyUrl: string;
  idleResetSeconds: number;
  /** 결과 URL 형식. 'hash' = <주소>/#/r/<토큰> (어느 정적 호스팅에서나 동작), 'path' = <주소>/results/<토큰> (호스팅의 SPA 리라이트 필요) */
  resultUrlMode: 'hash' | 'path';
  isDev: boolean;
}

export const ENV: Env = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, ''),
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  publicBaseUrl: (import.meta.env.VITE_PUBLIC_BASE_URL ?? '').replace(/\/+$/, ''),
  operatorPin: import.meta.env.VITE_OPERATOR_PIN ?? '',
  legacyUrl: import.meta.env.VITE_LEGACY_TEST_URL || './legacy/ansim-on.html',
  idleResetSeconds: num(import.meta.env.VITE_IDLE_RESET_SECONDS, 150),
  resultUrlMode: import.meta.env.VITE_RESULT_URL_MODE === 'path' ? 'path' : 'hash',
  isDev: !!import.meta.env.DEV,
};

/**
 * 앱 시작 전에 한 번 호출. dist/config.js 가 만든 window.__ANSIM_CONFIG__ 를 읽는다.
 * (config.js는 <script>로 불러오므로 index.html을 file:// 로 바로 열어도 동작한다.)
 */
export async function loadRuntimeConfig(): Promise<void> {
  const c = (window as unknown as { __ANSIM_CONFIG__?: Partial<Record<keyof Env, unknown>> }).__ANSIM_CONFIG__;
  if (!c || typeof c !== 'object') return;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  if (str(c.supabaseUrl)) ENV.supabaseUrl = str(c.supabaseUrl).replace(/\/+$/, '');
  if (str(c.supabaseAnonKey)) ENV.supabaseAnonKey = str(c.supabaseAnonKey);
  if (str(c.publicBaseUrl)) ENV.publicBaseUrl = str(c.publicBaseUrl).replace(/\/+$/, '');
  if (str(c.operatorPin)) ENV.operatorPin = str(c.operatorPin);
  if (str(c.legacyUrl)) ENV.legacyUrl = str(c.legacyUrl);
  if (str(c.resultUrlMode)) ENV.resultUrlMode = str(c.resultUrlMode) === 'path' ? 'path' : 'hash';
  if (c.idleResetSeconds !== undefined) ENV.idleResetSeconds = num(c.idleResetSeconds, ENV.idleResetSeconds);
}

export const serverConfigured = () => !!ENV.supabaseUrl && !!ENV.supabaseAnonKey;
