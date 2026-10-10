/**
 * 분기형 테스트 엔진 (순수 함수, UI·시간·서버와 무관)
 *
 * Q1 → Q2_x → Q3 → Q4_y → Q5 → Q6_(U|P|T)_…
 *  - 모든 분기는 "화면 위치"가 아니라 각 option에 매핑된 유형 code로 결정한다.
 *  - Q1·Q3의 code는 다음 질문을 정하는 데만 쓰고, 최종 유형 판정에는 쓰지 않는다.
 *  - T2(Q2)·T4(Q4)·T5(Q5)가 유형 후보. 고유 code 1/2/3개 → Q6_U / Q6_P / Q6_T.
 *  - 점수 합산·다수결·복합 유형·판정 유보 없음. 결과는 항상 A/B/C/D 중 정확히 하나.
 */
import { SPEC } from '../../spec/spec.generated';
import type { OptionDef, QuestionDef, TypeCode } from '../../spec/types';

export type Step = 1 | 2 | 3 | 4 | 5 | 6;
export const STEPS: readonly Step[] = [1, 2, 3, 4, 5, 6];
export const TOTAL_STEPS = 6;

const QUESTION_BY_ID: ReadonlyMap<string, QuestionDef> = new Map(SPEC.questions.map((q) => [q.id, q]));

export function getQuestion(id: string): QuestionDef {
  const q = QUESTION_BY_ID.get(id);
  if (!q) throw new Error(`정의되지 않은 질문 ID: ${id}`);
  return q;
}

export function allQuestions(): readonly QuestionDef[] {
  return SPEC.questions;
}

/** 한 문항에 대해 확정된 응답(분기 계산에 필요한 최소 정보) */
export interface Answer {
  step: Step;
  questionId: string;
  optionId: string;
  code: TypeCode;
}

export function findOption(questionId: string, optionId: string): OptionDef {
  const opt = getQuestion(questionId).options.find((o) => o.id === optionId);
  if (!opt) throw new Error(`${questionId}에 없는 선택지: ${optionId}`);
  return opt;
}

export function makeAnswer(questionId: string, optionId: string): Answer {
  const q = getQuestion(questionId);
  const opt = findOption(questionId, optionId);
  return { step: q.step, questionId, optionId, code: opt.code };
}

export type Q6Pattern = 'U' | 'P' | 'T';

export function sortedUnique(codes: readonly TypeCode[]): TypeCode[] {
  return Array.from(new Set(codes)).sort() as TypeCode[];
}

/** T2,T4,T5 → Q6 변형 ID */
export function q6IdFor(t2: TypeCode, t4: TypeCode, t5: TypeCode): { id: string; pattern: Q6Pattern; unique: TypeCode[] } {
  const unique = sortedUnique([t2, t4, t5]);
  const pattern: Q6Pattern = unique.length === 1 ? 'U' : unique.length === 2 ? 'P' : 'T';
  const id = pattern === 'U' ? `Q6_U_${unique[0]}` : `Q6_${pattern}_${unique.join('')}`;
  return { id, pattern, unique };
}

const byStep = (answers: readonly Answer[], step: Step): Answer | undefined => answers.find((a) => a.step === step);

/**
 * 지금까지의 응답으로 해당 step에 노출될 질문 ID를 계산한다.
 * 선행 응답이 없으면 null (아직 결정 불가).
 */
export function questionIdForStep(step: Step, answers: readonly Answer[]): string | null {
  switch (step) {
    case 1:
      return 'Q1';
    case 2: {
      const a1 = byStep(answers, 1);
      return a1 ? `Q2_${a1.code}` : null;
    }
    case 3:
      return 'Q3';
    case 4: {
      const a3 = byStep(answers, 3);
      return a3 ? `Q4_${a3.code}` : null;
    }
    case 5:
      return 'Q5';
    case 6: {
      const a2 = byStep(answers, 2);
      const a4 = byStep(answers, 4);
      const a5 = byStep(answers, 5);
      return a2 && a4 && a5 ? q6IdFor(a2.code, a4.code, a5.code).id : null;
    }
  }
}

/** 응답 배열이 현재 분기 규칙과 모순 없는지(저장된 질문 ID가 규칙과 일치하는지) 검사 */
export function isConsistent(answers: readonly Answer[]): boolean {
  const seen: Answer[] = [];
  for (const step of STEPS) {
    const a = byStep(answers, step);
    if (!a) continue;
    const expected = questionIdForStep(step, seen);
    if (expected === null || expected !== a.questionId) return false;
    const opt = getQuestion(a.questionId).options.find((o) => o.id === a.optionId);
    if (!opt || opt.code !== a.code) return false;
    seen.push(a);
  }
  return true;
}

/** 다음에 답해야 할 step (없으면 null=전부 응답됨). 앞 단계가 비어 있으면 그 단계가 먼저. */
export function nextStep(answers: readonly Answer[]): Step | null {
  for (const step of STEPS) {
    if (!byStep(answers, step)) return step;
  }
  return null;
}

/**
 * step의 응답을 반영한다.
 *  - 같은 선택지를 다시 확정: 아무것도 바꾸지 않는다.
 *  - 다른 선택지로 바꿈: 그 이후(step 초과) 응답을 전부 삭제한다. 이후 질문이 달라질 수 있으므로
 *    모순 가능성을 남기지 않기 위한 보수적 규칙이다. (Q1/Q3 수정 시 Q2/Q4 변형이 바뀜)
 *  - 선행 응답이 없는 step이나 현재 분기와 다른 질문의 응답은 거부한다.
 */
export function applyAnswer(
  answers: readonly Answer[],
  questionId: string,
  optionId: string,
): { answers: Answer[]; changed: boolean; clearedSteps: Step[] } {
  const next = makeAnswer(questionId, optionId);
  const prefix = answers.filter((a) => a.step < next.step);
  const expected = questionIdForStep(next.step, prefix);
  if (expected !== questionId) {
    throw new Error(`step ${next.step}에서는 ${expected ?? '(선행 응답 없음)'}만 응답할 수 있습니다: ${questionId}`);
  }
  if (prefix.length !== next.step - 1) {
    throw new Error(`step ${next.step} 이전 응답이 비어 있습니다.`);
  }
  const prev = byStep(answers, next.step);
  if (prev && prev.questionId === next.questionId && prev.optionId === next.optionId) {
    return { answers: [...answers], changed: false, clearedSteps: [] };
  }
  const cleared = answers.filter((a) => a.step > next.step).map((a) => a.step);
  return { answers: [...prefix, next], changed: !!prev, clearedSteps: cleared };
}

export interface Classification {
  /** 최종 유형 — 항상 A/B/C/D 중 하나 */
  type: TypeCode;
  pattern: Q6Pattern;
  t2: TypeCode;
  t4: TypeCode;
  t5: TypeCode;
  /** 정렬된 고유 후보 */
  unique: TypeCode[];
  q6Id: string;
  /** Q6에서 고른 option의 code (U에서는 T2와 동일) */
  q6Code: TypeCode;
  q6OptionId: string;
}

/**
 * 6개 응답이 모두 있을 때의 최종 판정. 빠진 응답/모순이 있으면 예외를 던진다(조용히 추정하지 않음).
 *  - U: 세 후보가 같으므로 그 유형 유지(Q6은 세부 설명용)
 *  - P/T: Q6에서 고른 option의 code가 최종 유형 (횟수 다수결 아님)
 */
export function classify(answers: readonly Answer[]): Classification {
  if (answers.length !== TOTAL_STEPS || !isConsistent(answers)) {
    throw new Error('응답이 6문항으로 완결되지 않았거나 분기 규칙과 모순됩니다.');
  }
  const a2 = byStep(answers, 2)!;
  const a4 = byStep(answers, 4)!;
  const a5 = byStep(answers, 5)!;
  const a6 = byStep(answers, 6)!;
  const { id, pattern, unique } = q6IdFor(a2.code, a4.code, a5.code);
  if (id !== a6.questionId) throw new Error(`Q6 변형 불일치: ${id} != ${a6.questionId}`);
  const type = pattern === 'U' ? unique[0] : a6.code;
  if (pattern !== 'U' && !unique.includes(a6.code)) {
    throw new Error('Q6 선택이 후보 집합 밖입니다.');
  }
  return { type, pattern, t2: a2.code, t4: a4.code, t5: a5.code, unique, q6Id: id, q6Code: a6.code, q6OptionId: a6.optionId };
}

/** 화면 표시용: 질문 + 현재 step의 선택지 배열(엑셀 순서 그대로) */
export function questionForStep(step: Step, answers: readonly Answer[]): QuestionDef | null {
  const id = questionIdForStep(step, answers);
  return id ? getQuestion(id) : null;
}
