import { useCallback, useEffect, useRef, useState } from 'react';
import { serverConfigured } from '../../config/env';
import type { SaveStatus } from '../../components/QrPanel';
import { newToken, resultUrl, saveResult, type StoredResult } from '../../lib/store';
import { analyzeBranch, type BranchAnalysis } from './analysis';
import { nextStep, questionForStep, type Step } from './engine';
import { answersOf, commitStep, newSession, type SessionLog } from './session';
import type { StepTiming } from './timing';
import { Intro } from './screens/Intro';
import { Question } from './screens/Question';
import { Results, type ResultNo } from './screens/Results';
import { contextLine } from './narrative';

type Phase = { kind: 'intro' } | { kind: 'question'; step: Step; attempt: number } | { kind: 'result'; n: ResultNo };

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * 분기형 모드의 스탠바이미 화면 흐름: 인트로 → Q1…Q6 → R01…R04.
 * 새 참여자가 시작하거나 유휴 시간이 지나면 이 컴포넌트의 상태(응답·시간·분석·저장 상태)가 모두 초기화된다.
 * 이미 서버에 저장된 이전 관람객의 결과(모바일 URL)에는 영향이 없다.
 */
/** 자동 초기화 직전 경고를 보여 주는 시간(초). 갑자기 처음으로 돌아가지 않는다. */
const IDLE_WARN_SECONDS = 20;

export function BranchApp({ idleSeconds }: { idleSeconds: number }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' });
  const [log, setLog] = useState<SessionLog>(() => newSession(uuid(), Date.now()));
  const [analysis, setAnalysis] = useState<BranchAnalysis | null>(null);
  const [save, setSave] = useState<SaveStatus>({ state: 'idle' });
  const tokenRef = useRef<string>('');
  const payloadRef = useRef<StoredResult | null>(null);
  const savingRef = useRef(false);
  const epoch = useRef(0); // 초기화 이후 도착한 이전 세션의 저장 응답을 버리기 위한 세대 번호

  // ── 유휴 초기화
  const lastActive = useRef(Date.now());
  const [idleLeft, setIdleLeft] = useState<number | null>(null);
  const reset = useCallback(() => {
    epoch.current++;
    savingRef.current = false;
    tokenRef.current = '';
    payloadRef.current = null;
    setLog(newSession(uuid(), Date.now()));
    setAnalysis(null);
    setSave({ state: 'idle' });
    setIdleLeft(null);
    setPhase({ kind: 'intro' });
  }, []);

  useEffect(() => {
    const bump = () => {
      lastActive.current = Date.now();
    };
    window.addEventListener('pointerdown', bump, true);
    window.addEventListener('keydown', bump, true);
    const timer = window.setInterval(() => {
      if (phase.kind === 'intro') {
        setIdleLeft(null);
        return;
      }
      const left = idleSeconds - Math.floor((Date.now() - lastActive.current) / 1000);
      if (left <= 0) reset();
      else setIdleLeft(left <= IDLE_WARN_SECONDS ? left : null);
    }, 1000);
    return () => {
      window.removeEventListener('pointerdown', bump, true);
      window.removeEventListener('keydown', bump, true);
      window.clearInterval(timer);
    };
  }, [phase.kind, idleSeconds, reset]);

  // ── 서버 저장 (성공해야만 QR 표시; 같은 토큰으로 재시도해도 중복 저장되지 않음)
  const runSave = useCallback(async () => {
    const payload = payloadRef.current;
    if (!payload || savingRef.current) return;
    if (!serverConfigured()) {
      setSave({ state: 'error', reason: 'not-configured' });
      return;
    }
    const url = resultUrl(tokenRef.current);
    if (!url) {
      setSave({ state: 'error', reason: 'insecure-url' });
      return;
    }
    savingRef.current = true;
    const my = epoch.current;
    setSave({ state: 'saving' });
    const r = await saveResult(tokenRef.current, payload);
    if (my !== epoch.current) return; // 이미 다른 참여자로 초기화됨
    savingRef.current = false;
    if (r.ok) setSave({ state: 'ok', url });
    else setSave({ state: 'error', reason: r.reason, detail: r.detail });
  }, []);

  // ── 흐름
  const start = () => {
    lastActive.current = Date.now();
    setPhase({ kind: 'question', step: 1, attempt: 0 });
  };

  const onConfirm = (questionId: string, optionId: string, timing: StepTiming) => {
    const r = commitStep(log, questionId, optionId, timing);
    setLog(r.log);
    const nxt = nextStep(answersOf(r.log));
    if (nxt !== null) {
      setPhase((p) => ({ kind: 'question', step: nxt, attempt: (p.kind === 'question' ? p.attempt : 0) + 1 }));
      return;
    }
    // 6문항 완료 → 분석 → 결과
    const a = analyzeBranch(r.log);
    setAnalysis(a);
    tokenRef.current = newToken();
    payloadRef.current = { schema: 1, savedAt: Date.now(), session: r.log, analysis: a };
    setPhase({ kind: 'result', n: 1 });
    void runSave();
  };

  const goBack = (step: Step) => {
    if (step <= 1) return;
    setPhase((p) => ({ kind: 'question', step: (step - 1) as Step, attempt: (p.kind === 'question' ? p.attempt : 0) + 1 }));
  };

  if (phase.kind === 'intro') return <Intro onStart={start} />;

  let body: JSX.Element;
  if (phase.kind === 'question') {
    const prefix = answersOf(log).filter((a) => a.step < phase.step);
    const q = questionForStep(phase.step, prefix);
    if (!q) {
      // 선행 응답이 없는 비정상 상태: 조용히 추정하지 않고 처음부터 다시 시작
      body = <Intro onStart={() => reset()} />;
    } else {
      const prev = log.records.find((r) => r.step === phase.step && r.questionId === q.id);
      body = (
        <Question
          key={`${phase.step}:${q.id}:${phase.attempt}`}
          question={q}
          context={contextLine(q.id, prefix)}
          previousOptionId={prev?.optionId}
          onConfirm={(optId, timing) => onConfirm(q.id, optId, timing)}
          onBack={phase.step > 1 ? () => goBack(phase.step) : undefined}
        />
      );
    }
  } else if (analysis) {
    body = (
      <Results
        n={phase.n}
        analysis={analysis}
        save={save}
        onNext={() => setPhase({ kind: 'result', n: Math.min(4, phase.n + 1) as ResultNo })}
        onRetrySave={() => void runSave()}
        onRestart={reset}
      />
    );
  } else {
    body = <Intro onStart={reset} />;
  }

  return (
    <>
      {body}
      {idleLeft !== null && (
        <div className="idle-modal" role="alertdialog" aria-live="assertive" aria-label="자동 처음으로 돌아가기 안내">
          <div className="idle-card">
            <h3>계속 진행하시겠어요?</h3>
            <p>{idleLeft}초 뒤 처음 화면으로 돌아가요. 지금까지의 선택은 이 화면에서 지워져요.</p>
            <button className="btn primary xl" onClick={() => (lastActive.current = Date.now())}>
              계속하기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
