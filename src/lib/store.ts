/**
 * 익명 결과 저장소 클라이언트 (Supabase REST RPC, 별도 SDK 없음).
 *
 * 보안 모델 (supabase/schema.sql 참고)
 *  - 테이블은 RLS로 완전히 잠겨 있고 anon 키로는 직접 읽기/쓰기 불가.
 *  - anon은 세 개의 RPC만 호출할 수 있다: save / get(토큰 소지자) / delete(토큰 소지자).
 *  - 토큰은 브라우저가 만든 192비트 난수이고 서버에는 SHA-256 해시만 저장한다.
 *  - 같은 토큰으로 다시 저장해도 중복 행이 생기지 않는다(재시도 안전).
 */
import { ENV, serverConfigured } from '../config/env';
import type { BranchAnalysis } from '../modes/branch/analysis';
import type { SessionLog } from '../modes/branch/session';

export interface StoredResult {
  schema: 1;
  savedAt: number;
  session: SessionLog;
  analysis: BranchAnalysis;
}

export type RpcFailure = { ok: false; reason: 'not-configured' | 'network' | 'timeout' | 'server'; status?: number; detail?: string };
export type RpcResult<T> = { ok: true; data: T } | RpcFailure;

const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;
export const isValidToken = (t: string) => TOKEN_RE.test(t);

export function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function rpc<T>(fn: string, args: Record<string, unknown>, timeoutMs = 10000): Promise<RpcResult<T>> {
  if (!serverConfigured()) return { ok: false, reason: 'not-configured' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${ENV.supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ENV.supabaseAnonKey,
        Authorization: `Bearer ${ENV.supabaseAnonKey}`,
      },
      body: JSON.stringify(args),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      let detail = '';
      try {
        detail = (await res.text()).slice(0, 200);
      } catch {
        /* ignore */
      }
      return { ok: false, reason: 'server', status: res.status, detail };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    return { ok: false, reason: aborted ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

/** 저장 성공(서버가 true를 돌려줌)일 때만 ok. 그 외에는 모두 실패로 취급하므로 가짜 QR이 만들어질 수 없다. */
export async function saveResult(token: string, payload: StoredResult): Promise<RpcResult<true>> {
  if (!isValidToken(token)) return { ok: false, reason: 'server', detail: 'invalid token' };
  const r = await rpc<unknown>('save_branch_result', { p_token: token, p_payload: payload });
  if (!r.ok) return r;
  return r.data === true ? { ok: true, data: true } : { ok: false, reason: 'server', detail: 'unexpected response' };
}

export interface FetchedResult {
  payload: StoredResult;
  expiresAt: string | null;
}

export async function fetchResult(token: string): Promise<RpcResult<FetchedResult | null>> {
  if (!isValidToken(token)) return { ok: true, data: null };
  const r = await rpc<{ payload: StoredResult; expires_at: string | null } | null>('get_branch_result', { p_token: token });
  if (!r.ok) return r;
  if (!r.data) return { ok: true, data: null };
  return { ok: true, data: { payload: r.data.payload, expiresAt: r.data.expires_at } };
}

export async function deleteResult(token: string): Promise<RpcResult<boolean>> {
  if (!isValidToken(token)) return { ok: true, data: false };
  const r = await rpc<unknown>('delete_branch_result', { p_token: token });
  if (!r.ok) return r;
  return { ok: true, data: r.data === true };
}

/** 운영자 점검용: 서버 연결 확인 (존재하지 않는 토큰 조회 → 정상이면 null) */
export async function pingServer(): Promise<RpcResult<null>> {
  const r = await rpc<unknown>('get_branch_result', { p_token: 'ping-ping-ping-ping-ping-ping-pi' });
  if (!r.ok) return r;
  return { ok: true, data: null };
}

/**
 * 모바일 결과 주소. 해시(#/r/토큰) 라우팅이라 정적 호스팅에 별도 rewrite가 필요 없고,
 * 토큰이 서버 접속 로그에 남지 않는다. 운영(HTTPS)이 아니면 null → QR을 만들지 않는다.
 */
export function resultUrl(token: string): string | null {
  const base =
    ENV.publicBaseUrl ||
    (typeof window !== 'undefined' ? window.location.origin + window.location.pathname.replace(/index\.html$/, '').replace(/\/+$/, '') : '');
  const url = ENV.resultUrlMode === 'path' ? `${base}/results/${token}` : `${base}/#/r/${token}`;
  if (url.startsWith('https://')) return url;
  if (ENV.isDev && url.startsWith('http://')) return url; // 개발 서버에서만 http 허용
  return null;
}
