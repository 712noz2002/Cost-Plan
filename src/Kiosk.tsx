import { useRef, useState } from 'react';
import { ENV } from './config/env';
import { loadSettings, saveSettings, type Settings } from './config/settings';
import { OperatorPanel } from './components/OperatorPanel';
import { BranchApp } from './modes/branch/BranchApp';

/**
 * 전시장(스탠바이미) 진입점. 운영자 설정에서 고른 모드에 따라 분기형 테스트(이 앱) 또는
 * 기존 카드 소거형 테스트(별도 HTML, iframe)를 보여 준다. 두 모드는 상태·결과·분석을 공유하지 않는다.
 * 운영자 패널: 화면 왼쪽 위 모서리를 3초 안에 5번 터치.
 */
export function Kiosk() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [panel, setPanel] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const taps = useRef<number[]>([]);

  const hot = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 3000), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      setPanel(true);
    }
  };
  const update = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
  };

  return (
    <>
      <div className="kiosk">
        {settings.mode === 'branch' ? (
          <BranchApp key={resetKey} idleSeconds={settings.idleResetSeconds} />
        ) : (
          <iframe key={resetKey} className="legacy-frame" src={ENV.legacyUrl} title="기존 카드 소거형 테스트" />
        )}
      </div>
      <button className="hotspot" aria-label="운영자 설정 열기(5번 터치)" onClick={hot} />
      {panel && (
        <OperatorPanel
          settings={settings}
          onChange={update}
          onNewVisitor={() => {
            setResetKey((k) => k + 1);
            setPanel(false);
          }}
          onClose={() => setPanel(false)}
        />
      )}
    </>
  );
}
