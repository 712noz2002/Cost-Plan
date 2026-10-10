/** 운영자 설정 (이 기기의 브라우저에 저장). 저장소 접근 실패 시에도 기본값으로 동작한다. */
import { ENV } from './env';

export type ModeId = 'branch' | 'keyword';

export interface Settings {
  mode: ModeId;
  idleResetSeconds: number;
}

const KEY = 'ansimon.operator.settings.v1';

/** ENV는 config.json 로드 뒤에 확정되므로 호출 시점에 읽는다. */
export const defaultSettings = (): Settings => ({ mode: 'branch', idleResetSeconds: ENV.idleResetSeconds });

export function loadSettings(): Settings {
  let s: Settings = defaultSettings();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Settings>;
      if (p.mode === 'branch' || p.mode === 'keyword') s.mode = p.mode;
      if (typeof p.idleResetSeconds === 'number' && p.idleResetSeconds >= 30 && p.idleResetSeconds <= 900) s.idleResetSeconds = p.idleResetSeconds;
    }
  } catch {
    /* 저장소를 쓸 수 없는 환경: 기본값 유지 */
  }
  // 주소의 ?mode=branch|keyword 는 저장하지 않는 임시 override (리허설용)
  try {
    const q = new URLSearchParams(window.location.search).get('mode');
    if (q === 'branch' || q === 'keyword') s = { ...s, mode: q };
  } catch {
    /* ignore */
  }
  return s;
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ mode: s.mode, idleResetSeconds: s.idleResetSeconds }));
  } catch {
    /* ignore */
  }
}
