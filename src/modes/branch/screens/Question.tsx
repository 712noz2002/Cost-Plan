import { useEffect, useRef, useState } from 'react';
import { Logo } from '../../../components/Logo';
import type { QuestionDef } from '../../../spec/types';
import { TOTAL_STEPS } from '../engine';
import { ChoiceRecorder, type StepTiming } from '../timing';

interface Props {
  question: QuestionDef;
  /** Q2·Q4 상단의 작은 연결 문장 (이전 답변 인용). 없으면 빈 문자열 */
  context: string;
  /** 되돌아와 다시 보는 경우, 이전에 확정했던 선택지 ID */
  previousOptionId?: string;
  onConfirm: (optionId: string, timing: StepTiming) => void;
  onBack?: () => void;
}

/** 확정 직후 퇴장 모션 시간(ms). 이 동안 모든 입력은 잠겨 이중 확정이 불가능하다. */
export const LEAVE_MS = 260;

/**
 * 한 화면 한 결정. 질문이 화면의 주인공이고 상황은 위의 보조 문장이다.
 *   읽기 단계: 상황 + 큰 질문. [선택지 보기]를 누르기 전에는 선택지가 없다(선택 시간 측정도 시작 전).
 *   선택 단계: 동등한 크기의 선택지 패널이 나타나며 이 순간이 decisionStartAt이다. [이 선택으로 계속하기]로 확정.
 * 선택지 순서는 엑셀 원고 순서 그대로이며 분기는 위치가 아니라 option에 매핑된 코드로만 결정된다.
 * 유형 코드·유형색은 화면에 표시하지 않는다.
 */
export function Question({ question, context, previousOptionId, onConfirm, onBack }: Props) {
  const recorder = useRef<ChoiceRecorder>();
  if (!recorder.current) recorder.current = new ChoiceRecorder(question.options);
  const rec = recorder.current;
  const [started, setStarted] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const locked = useRef(false);
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const start = () => {
    if (locked.current) return;
    rec.start();
    setStarted(true);
  };
  const tap = (id: string) => {
    if (locked.current) return;
    if (rec.tap(id)) setSelected(id);
  };
  const confirm = () => {
    if (locked.current || !selected) return;
    locked.current = true; // 모션 중 이중 확정 차단
    const timing = rec.finalize();
    setLeaving(true);
    timer.current = window.setTimeout(() => onConfirm(selected, timing), LEAVE_MS);
  };
  const back = () => {
    if (locked.current || !onBack) return;
    locked.current = true;
    onBack();
  };

  const step = question.step;
  const n = question.options.length;
  return (
    <div className={`kq${leaving ? ' leaving' : ''}${started ? ' started' : ''}`}>
      <header className="kq-top">
        <Logo />
      </header>

      <main className="kq-main">
        <div className="kq-scene" key={question.id}>
          {context && <p className="kq-context">{context}</p>}
          <p className="kq-situation">{question.situation}</p>
          <h2 className="kq-prompt">{question.prompt}</h2>
        </div>

        {started ? (
          <div className={`kq-opts n${n}`} role="group" aria-label="선택지">
            {question.options.map((o, i) => (
              <button
                key={o.id}
                type="button"
                className={`kq-opt${selected === o.id ? ' selected' : ''}${previousOptionId === o.id ? ' was' : ''}`}
                style={{ animationDelay: `${i * 70}ms` }}
                aria-pressed={selected === o.id}
                onClick={() => tap(o.id)}
              >
                <span className="kq-radio" aria-hidden="true" />
                <span className="kq-opt-text">{o.text}</span>
                {previousOptionId === o.id && <span className="was-tag">이전 선택</span>}
              </button>
            ))}
          </div>
        ) : (
          <div className="kq-reveal">
            <button className="btn primary xl" onClick={start}>
              선택지 보기
            </button>
            <p className="hint">장면을 충분히 읽은 뒤 눌러 주세요.</p>
          </div>
        )}
      </main>

      <footer className="kq-bottom">
        <div className="kq-left">
          {onBack ? (
            <button className="btn secondary" onClick={back}>
              ← 이전
            </button>
          ) : (
            <span />
          )}
        </div>
        <div className="kq-indicator" aria-label={`${step} / ${TOTAL_STEPS}`}>
          <b>{String(step).padStart(2, '0')}</b>
          <span> / {String(TOTAL_STEPS).padStart(2, '0')}</span>
          <div className="kq-bars" aria-hidden="true">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <i key={i} className={i + 1 < step ? 'done' : i + 1 === step ? 'now' : ''} />
            ))}
          </div>
        </div>
        <div className="kq-right">
          {started && (
            <button className="btn primary" disabled={!selected} onClick={confirm}>
              이 선택으로 계속하기
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
