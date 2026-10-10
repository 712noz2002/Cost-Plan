import { useEffect, useRef, useState } from 'react';
import { Logo } from '../../../components/Logo';
import { Character } from '../../../components/Character';
import { LockerGuide } from '../../../components/LockerGuide';
import { QrPanel, type SaveStatus } from '../../../components/QrPanel';
import type { BranchAnalysis } from '../analysis';

export type ResultNo = 1 | 2 | 3 | 4;

type Props = {
  n: ResultNo;
  analysis: BranchAnalysis;
  save: SaveStatus;
  onNext: () => void;
  onRetrySave: () => void;
  onRestart: () => void;
};

/** 유형 공개 직전 긴장감(≤1초). 이 동안 버튼은 잠겨 이중 이동이 없다. */
export const SUSPENSE_MS = 800;

const Top = ({ n }: { n: number }) => (
  <header className="kq-top">
    <Logo dark={n !== 4} />
    <span className="rs-no">RESULT 0{n}</span>
  </header>
);

/** 스탠바이미 결과 4장면. 유형명·캐릭터는 R03에서 처음 공개한다. */
export function Results({ n, analysis, save, onNext, onRetrySave, onRestart }: Props) {
  const s = analysis.standby;
  const [busy, setBusy] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => setBusy(false), [n]);

  const next = () => {
    if (busy) return;
    setBusy(true);
    onNext();
  };
  const reveal = () => {
    if (busy) return;
    setBusy(true);
    timer.current = window.setTimeout(onNext, SUSPENSE_MS);
  };

  if (n === 1) {
    return (
      <div className="rs navy" key="r1">
        <Top n={1} />
        <main className="rs-main">
          <h2 className="rs-title">{s.r01.headline}</h2>
          <div className="rs-lines">
            {s.r01.lines.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </div>
          <div className="rs-tag">{s.r01.tag}</div>
          <p className="rs-fine">선택 시간은 이번 선택 과정을 설명하는 기록일 뿐, 마음의 크기를 재는 값이 아니에요.</p>
        </main>
        <footer className="rs-foot">
          <button className="btn white xl" onClick={next}>
            다음
          </button>
        </footer>
      </div>
    );
  }

  if (n === 2) {
    return (
      <div className={`rs navy${busy ? ' suspense' : ''}`} key="r2">
        <Top n={2} />
        <main className="rs-main center">
          <h2 className="rs-title big">{s.r02.headline}</h2>
          <p className="rs-sub">{s.r02.line}</p>
        </main>
        <footer className="rs-foot">
          <button className="btn white xl" disabled={busy} onClick={reveal}>
            나의 보호자 유형 확인하기
          </button>
        </footer>
      </div>
    );
  }

  if (n === 3) {
    return (
      <div className="rs navy r3" key="r3">
        <Top n={3} />
        <main className="rs-main r3-main">
          <div className="r3-text">
            <span className="type-badge">{s.r03.typeLabel}</span>
            <h2 className="type-name">{s.r03.name}</h2>
            <div className="type-kind">{s.r03.kind}</div>
            <div className="reasons">
              {s.r03.sentences.map((t, i) => (
                <p key={i}>{t}</p>
              ))}
            </div>
          </div>
          <Character src={analysis.character.src} alt={analysis.character.alt} file={analysis.character.file} />
        </main>
        <footer className="rs-foot">
          <button className="btn white xl" onClick={next}>
            결과 가져가기
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="rs light" key="r4">
      <Top n={4} />
      <main className="rs-main pick">
        <div className="pick-text">
          <h2 className="rs-title dark">
            {s.r04.locker}번 보관함에서
            <br />
            유형 카드 한 장을 직접 가져가세요.
          </h2>
          <LockerGuide active={s.r04.locker} />
          <p className="pick-sum">{s.r04.summary}</p>
          <p className="safe-note">이 화면은 번호만 알려 드려요. 보관함은 전자 장치로 열리지 않아요.</p>
        </div>
        <QrPanel status={save} onRetry={onRetrySave} />
      </main>
      <footer className="rs-foot">
        <span className="hint">QR로 선택의 의미를 자세히 알아보세요. 다음 분을 위해 화면을 처음으로 돌려 주세요.</span>
        <button className="btn secondary xl" onClick={onRestart}>
          체험 마치기
        </button>
      </footer>
    </div>
  );
}
