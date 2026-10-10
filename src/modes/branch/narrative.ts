/**
 * 질문 사이의 연결 문장 (Q2, Q4 상단에 작게 표시).
 * 이전 답변을 원문 그대로 인용만 하며 칭찬·진단하지 않는다. 변수가 비면 빈 문자열을 돌려주어
 * 화면에 undefined가 나오지 않게 한다.
 */
import { eulReul } from '../../lib/josa';
import { quote } from '../../lib/format';
import type { Answer } from './engine';
import { getQuestion } from './engine';

const strip = (t: string) => t.replace(/[.。]+$/, '');

export function contextLine(questionId: string, prior: readonly Answer[]): string {
  const step = getQuestion(questionId).step;
  const pick = (qstep: number): string => {
    const a = prior.find((x) => x.step === qstep);
    if (!a) return '';
    return getQuestion(a.questionId).options.find((o) => o.id === a.optionId)?.text ?? '';
  };
  if (step === 2) {
    const t = pick(1);
    return t ? `앞서 당신은 ${quote(strip(t))}라는 궁금증을 먼저 떠올렸습니다.` : '';
  }
  if (step === 4) {
    const t = pick(3);
    return t ? `당신은 ${eulReul(quote(strip(t)))} 먼저 생각했습니다.` : '';
  }
  return '';
}
