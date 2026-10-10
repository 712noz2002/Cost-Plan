/**
 * 한 관람객의 세션 기록. 응답(Answer)과 선택 과정(StepTiming)을 함께 보관한다.
 * 응답이 바뀌어 하위 분기가 달라지면 이후 응답과 시간 로그를 함께 삭제한다.
 */
import { applyAnswer, getQuestion, findOption, STEPS, TOTAL_STEPS, type Answer, type Step } from './engine';
import type { StepTiming } from './timing';
import type { TypeCode } from '../../spec/types';

export interface StepRecord {
  step: Step;
  questionId: string;
  /** 화면에 노출된 상황·질문·선택지 원문 스냅샷 (서버 저장·모바일 표시용; 이후 원고가 바뀌어도 당시 기록 유지) */
  situation: string;
  prompt: string;
  options: { id: string; index: number; text: string; code: TypeCode }[];
  optionId: string;
  optionIndex: number;
  code: TypeCode;
  text: string;
  timing: StepTiming;
}

export interface RevisionEntry {
  step: Step;
  fromOptionId: string;
  toOptionId: string;
  at: number;
  clearedSteps: Step[];
}

export interface SessionLog {
  sessionId: string;
  startedAt: number;
  records: StepRecord[];
  revisions: RevisionEntry[];
}

export function newSession(sessionId: string, startedAt: number): SessionLog {
  return { sessionId, startedAt, records: [], revisions: [] };
}

export function answersOf(log: SessionLog): Answer[] {
  return log.records.map((r) => ({ step: r.step, questionId: r.questionId, optionId: r.optionId, code: r.code }));
}

/**
 * 한 문항의 확정을 세션에 반영한다.
 *  - 같은 선택지로 다시 확정하면 기존 기록(시간 포함)과 이후 기록을 그대로 둔다.
 *  - 다른 선택지로 바꾸면 그 이후 기록(응답+시간 로그)을 전부 삭제하고 revisions에 남긴다.
 */
export function commitStep(
  log: SessionLog,
  questionId: string,
  optionId: string,
  timing: StepTiming,
  now: number = Date.now(),
): { log: SessionLog; changed: boolean; clearedSteps: Step[] } {
  const q = getQuestion(questionId);
  const opt = findOption(questionId, optionId);
  const result = applyAnswer(answersOf(log), questionId, optionId);
  const previous = log.records.find((r) => r.step === q.step);

  if (previous && !result.changed && previous.optionId === optionId && previous.questionId === questionId) {
    return { log, changed: false, clearedSteps: [] };
  }

  const record: StepRecord = {
    step: q.step,
    questionId,
    situation: q.situation,
    prompt: q.prompt,
    options: q.options.map((o) => ({ id: o.id, index: o.index, text: o.text, code: o.code })),
    optionId,
    optionIndex: opt.index,
    code: opt.code,
    text: opt.text,
    timing,
  };
  const kept = log.records.filter((r) => r.step < q.step);
  const revisions = previous
    ? [...log.revisions, { step: q.step, fromOptionId: previous.optionId, toOptionId: optionId, at: now, clearedSteps: result.clearedSteps }]
    : log.revisions;
  return { log: { ...log, records: [...kept, record], revisions }, changed: !!previous, clearedSteps: result.clearedSteps };
}

/** 이전 문항으로 돌아가기: 해당 step 이후(해당 step 포함)의 기록을 삭제하지 않고, 화면만 그 step으로 이동한다. */
export function isComplete(log: SessionLog): boolean {
  return log.records.length === TOTAL_STEPS && STEPS.every((s, i) => log.records[i]?.step === s);
}
