import { useState } from 'react';
import { ENV, serverConfigured } from '../config/env';
import type { ModeId, Settings } from '../config/settings';
import { pingServer } from '../lib/store';
import { MODES } from '../modes/registry';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onNewVisitor: () => void;
  onClose: () => void;
}

/** 운영자 패널: 표시할 테스트 모드 선택, 유휴 초기화 시간, 서버 연결 점검. PIN이 설정돼 있으면 먼저 확인한다. */
export function OperatorPanel({ settings, onChange, onNewVisitor, onClose }: Props) {
  const needsPin = !!ENV.operatorPin;
  const [unlocked, setUnlocked] = useState(!needsPin);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [ping, setPing] = useState<string>('');

  const press = (d: string) => {
    const next = (pin + d).slice(0, 8);
    setPin(next);
    setPinError(false);
    if (next.length === ENV.operatorPin.length) {
      if (next === ENV.operatorPin) setUnlocked(true);
      else {
        setPinError(true);
        setPin('');
      }
    }
  };

  const test = async () => {
    setPing('확인 중…');
    const r = await pingServer();
    setPing(r.ok ? '서버 연결 정상' : `연결 실패: ${r.reason}${r.status ? ` (${r.status})` : ''}`);
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="운영자 설정">
      <div className="panel">
        {!unlocked ? (
          <>
            <h3>운영자 확인</h3>
            <div className="pin-show" aria-live="polite">{'●'.repeat(pin.length) || '　'}</div>
            {pinError && <div className="small" style={{ color: 'var(--danger)' }}>PIN이 맞지 않아요.</div>}
            <div className="pin-pad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button key={d} onClick={() => press(d)}>{d}</button>
              ))}
              <button onClick={() => setPin('')}>지움</button>
              <button onClick={() => press('0')}>0</button>
              <button onClick={onClose}>닫기</button>
            </div>
          </>
        ) : (
          <>
            <h3>운영자 설정</h3>
            {!needsPin && <p className="small">VITE_OPERATOR_PIN이 설정되지 않아 PIN 없이 열렸어요. 전시 전에 PIN을 설정하세요.</p>}
            <div role="radiogroup" aria-label="표시할 테스트 모드">
              {(Object.keys(MODES) as ModeId[]).map((id) => (
                <label key={id} className={`row${settings.mode === id ? ' on' : ''}`}>
                  <input type="radio" name="mode" checked={settings.mode === id} onChange={() => onChange({ ...settings, mode: id })} />
                  <span>
                    <b>{MODES[id].label}</b>
                    <br />
                    <span className="small">{MODES[id].description}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="small">모드를 바꿔도 두 테스트의 결과는 서로 합산되지 않아요. 새 참여자부터 선택한 모드로 진행됩니다.</p>
            <label className="row" style={{ alignItems: 'center' }}>
              <span>무조작 시 처음으로 돌아가는 시간</span>
              <select
                value={settings.idleResetSeconds}
                onChange={(e) => onChange({ ...settings, idleResetSeconds: Number(e.target.value) })}
                style={{ marginLeft: 'auto', fontSize: 20, minHeight: 44 }}
              >
                {[60, 90, 120, 150, 180, 300, 600].map((s) => (
                  <option key={s} value={s}>{s}초</option>
                ))}
              </select>
            </label>
            <p className="small">
              결과 서버: {serverConfigured() ? '설정됨' : '미설정 (QR이 표시되지 않아요)'} · 공개 주소: {ENV.publicBaseUrl || '(현재 접속 주소 사용)'}
            </p>
            <div className="actions">
              <button className="btn secondary" onClick={test}>서버 연결 점검</button>
              <button className="btn secondary" onClick={onNewVisitor}>새 참여자 시작(화면 초기화)</button>
              <button className="btn primary" onClick={onClose}>닫기</button>
            </div>
            {ping && <p className="small" aria-live="polite">{ping}</p>}
          </>
        )}
      </div>
    </div>
  );
}
