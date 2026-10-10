/**
 * 모든 가능한 답변 시퀀스 열거 (자동 검증·운영 점검용).
 * 정상 응답 경로 하나 = 각 step에서 노출된 질문의 선택지 중 하나씩 고른 6개.
 */
import { applyAnswer, classify, getQuestion, questionIdForStep, TOTAL_STEPS, STEPS, type Answer, type Classification } from './engine';

export interface EnumeratedPath {
  answers: Answer[];
  exposedQuestionIds: string[];
  result: Classification;
}

export function* enumeratePaths(): Generator<EnumeratedPath> {
  function* walk(answers: Answer[]): Generator<EnumeratedPath> {
    const step = STEPS[answers.length];
    if (step === undefined) {
      yield { answers, exposedQuestionIds: answers.map((a) => a.questionId), result: classify(answers) };
      return;
    }
    const qid = questionIdForStep(step, answers);
    if (qid === null) throw new Error(`정의되지 않은 분기: step ${step}`);
    const q = getQuestion(qid);
    if (q.options.length === 0) throw new Error(`선택지가 없는 질문: ${qid}`);
    for (const opt of q.options) {
      const { answers: next } = applyAnswer(answers, qid, opt.id);
      yield* walk(next);
    }
  }
  yield* walk([]);
}

export function summarizePaths(): {
  total: number;
  byType: Record<string, number>;
  byPattern: Record<string, number>;
  q6Variants: Record<string, number>;
  maxLength: number;
  minLength: number;
} {
  const byType: Record<string, number> = {};
  const byPattern: Record<string, number> = {};
  const q6Variants: Record<string, number> = {};
  let total = 0;
  let maxLength = 0;
  let minLength = Infinity;
  for (const p of enumeratePaths()) {
    total++;
    byType[p.result.type] = (byType[p.result.type] ?? 0) + 1;
    byPattern[p.result.pattern] = (byPattern[p.result.pattern] ?? 0) + 1;
    q6Variants[p.result.q6Id] = (q6Variants[p.result.q6Id] ?? 0) + 1;
    maxLength = Math.max(maxLength, p.answers.length);
    minLength = Math.min(minLength, p.answers.length);
  }
  return { total, byType, byPattern, q6Variants, maxLength, minLength };
}

export { TOTAL_STEPS };
