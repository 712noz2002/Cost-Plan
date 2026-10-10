/**
 * 분기형 모드 전용 결과 분석 (v7). 규칙 기반이며, 즉흥적인 심리 해석을 만들지 않는다.
 *
 * 입력: SessionLog (질문 원문·선택·시간·수정 기록)
 * 출력: BranchAnalysis — 스탠바이미 R01~R04, 모바일 M01~M07, PNG가 모두 이 한 객체에서 나온다.
 *
 * 작성 원칙 (엑셀 06_결과분석_규칙)
 *  - 관찰(실제 고른 문장) → 상대 비교 → 확인 욕구 → 유형 연결 순서. 모든 문장이 실제 선택지 원문을 인용한다.
 *  - Q1·Q3은 분기용이며 유형 점수가 아니다. 유형은 Q6(일치형은 T2=T4=T5)으로만 정해진다.
 *  - 시간·수정은 사실(몇 초, 몇 회, 어떤 순서)만 서술한다. 비교 자료가 없으므로 다른 사람과 견주지 않고,
 *    불안·망설임·책임감 같은 내적 상태로 해석하지 않는다.
 *  - 선택하지 않은 후보를 "중요하지 않다"고 해석하지 않는다. 횟수 다수결을 쓰지 않는다.
 */
import { SPEC } from '../../spec/spec.generated';
import type { TypeCode } from '../../spec/types';
import { eulReul, euroRo, iGa, josa } from '../../lib/josa';
import { formatSeconds, quote } from '../../lib/format';
import { classify } from './engine';
import { answersOf, isComplete, type SessionLog, type StepRecord } from './session';
import { timingValid } from './timing';
import { CHARACTER_DIR, TYPE_INFO, tag } from './typeInfo';

export const ANALYSIS_VERSION = 'branch-v7.0';

export interface TimeRow {
  step: number;
  chosenText: string;
  firstText: string;
  /** 시간 값이 유효하지 않으면 false — 화면은 '측정 불가'로 표시 */
  valid: boolean;
  firstTapDurationMs: number;
  postFirstDurationMs: number;
  decisionDurationMs: number;
  revisionCount: number;
  /** 확정 전에 눌러 본 서로 다른 항목 원문(첫 항목 포함, 순서 유지) */
  comparedTexts: string[];
  sentences: string[];
}

export interface Compare {
  same: boolean;
  /** 모바일 카드의 핵심 한 문장 */
  sentence: string;
  /** 관찰 사실 (규칙표의 '관찰 사실') */
  fact: string;
  leftLabel: string;
  leftText: string;
  rightLabel: string;
  rightText: string;
}

export interface BranchAnalysis {
  version: string;
  mode: 'branch';
  type: TypeCode;
  typeName: string;
  kind: string;
  pattern: 'U' | 'P' | 'T';
  q6Id: string;
  exposedQuestionIds: string[];
  locker: string;
  winnerText: string;
  character: { file: string; src: string; alt: string };
  standby: {
    r01: { headline: string; lines: string[]; tag: string };
    r02: { headline: string; line: string };
    r03: { typeLabel: string; name: string; kind: string; sentences: string[] };
    r04: { locker: string; summary: string };
  };
  mobile: {
    m01: { typeLabel: string; name: string; kind: string; priority: string };
    m02: Compare;
    m03: Compare;
    m04: {
      timeline: { label: string; text: string; focus: string }[];
      sentences: string[];
      compares: { sentence: string; observed: string; diff: string }[];
    };
    m05: { rows: TimeRow[]; q6Notes: string[]; caution: string };
    m06: { quotes: { label: string; text: string }[]; chain: { label: string; text: string }[]; paragraphs: string[] };
    m07: { meaning: string; meaningDetail: string };
    disclaimers: string[];
  };
  image: {
    typeLabel: string;
    name: string;
    kind: string;
    characterSrc: string;
    sentences: string[];
    trail: { label: string; value: string }[];
    meaning: string;
    footer: string;
  };
}

export const DISCLAIMERS = [
  '이 테스트는 검증된 성격 검사가 아니며, 앞으로의 행동을 예측하지 않습니다. 오늘 만난 여섯 장면에서 고른 선택을 바탕으로 한 전시용 체험 해석입니다.',
  '같은 사람도 상황이 달라지면 다른 방식으로 확인하고 싶어질 수 있습니다.',
];

const rec = (log: SessionLog, step: number): StepRecord => {
  const r = log.records.find((x) => x.step === step);
  if (!r) throw new Error(`step ${step} 기록이 없습니다.`);
  return r;
};
const textOf = (r: StepRecord, id: string) => r.options.find((o) => o.id === id)?.text ?? '';
/** 문장형 선택지(…한다.)의 끝 마침표를 떼어 인용에 쓴다. */
const strip = (t: string) => t.replace(/[.。]+$/, '');
const q = (t: string) => quote(strip(t));
const sceneList = (steps: number[]) => steps.map((s) => `장면 ${s}`).join('·');

/** 한 문항의 선택 과정 서술. 사실(처음 고른 것, 바꾼 횟수, 비교한 항목, 시간)만 쓴다. */
function timeRow(r: StepRecord): TimeRow {
  const t = r.timing;
  const firstText = textOf(r, t.firstOptionId);
  const compared: string[] = [];
  for (const e of t.tapHistory) {
    const tx = textOf(r, e.optionId);
    if (!compared.includes(tx)) compared.push(tx);
  }
  const valid = timingValid(t);
  const s: string[] = [];
  s.push(`처음에는 ${eulReul(q(firstText))} 선택했습니다.`);
  if (t.revisionCount > 0) {
    const shown = compared.slice(0, 2).map(q);
    s.push(
      `${t.revisionCount}회 선택을 바꾸면서 ${shown.join('와 ')}${compared.length > 2 ? ' 등' : ''}${josa(shown[shown.length - 1] + (compared.length > 2 ? '등' : ''), '을', '를')} 다시 비교했습니다.`,
    );
    s.push(t.firstOptionId === r.optionId ? '마지막에는 처음 고른 항목으로 돌아와 확정했습니다.' : `마지막에 확정한 것은 ${q(r.text)}입니다.`);
  } else {
    s.push(`${eulReul(q(firstText))} 선택하고 그대로 확정했습니다.`);
  }
  if (valid) {
    s.push(`이번 선택은 ${formatSeconds(t.decisionDurationMs)}에 걸쳐 이루어졌습니다.`);
    s.push(`처음 선택까지 ${formatSeconds(t.firstTapDurationMs)}, 그 뒤 확정까지 ${formatSeconds(t.postFirstDurationMs)}를 사용했습니다.`);
  } else {
    s.push('이번 선택의 시간은 측정 불가로 표시합니다.');
  }
  return {
    step: r.step,
    chosenText: r.text,
    firstText,
    valid,
    firstTapDurationMs: t.firstTapDurationMs,
    postFirstDurationMs: t.postFirstDurationMs,
    decisionDurationMs: t.decisionDurationMs,
    revisionCount: t.revisionCount,
    comparedTexts: compared,
    sentences: s,
  };
}

export function analyzeBranch(log: SessionLog): BranchAnalysis {
  if (!isComplete(log)) throw new Error('6문항이 모두 응답된 세션만 분석할 수 있습니다.');
  const c = classify(answersOf(log));
  const info = TYPE_INFO[c.type];
  const [r1, r2, r3, r4, r5, r6] = [1, 2, 3, 4, 5, 6].map((n) => rec(log, n));
  const losers = r6.options.filter((o) => o.id !== r6.optionId);
  const rows = log.records.map(timeRow);
  const row6 = rows[5];

  // ── Q1 → Q2 (분기 전용 첫 궁금증 vs 안심 근거)
  const sameFirst = r1.code === c.t2;
  const m02: Compare = {
    same: sameFirst,
    sentence: sameFirst
      ? '첫 궁금증과 마음이 놓이는 정보가 이번 장면에서는 같은 맥락에 있었습니다.'
      : `처음에는 ${q(r1.text)}라는 궁금증이 떠올랐지만, 마음이 놓이는 정보로 ${eulReul(q(r2.text))} 골랐습니다. 첫 걱정과 믿음의 근거는 꼭 같지는 않았습니다.`,
    fact: sameFirst ? '처음 눈길이 간 문제와 실제 안심 근거가 같은 확인 방향이었습니다.' : '처음 떠오른 걱정과 실제 필요했던 확인 근거가 달랐습니다.',
    leftLabel: '처음 떠오른 궁금증',
    leftText: r1.text,
    rightLabel: '마음이 놓이는 정보',
    rightText: r2.text,
  };

  // ── Q3 → Q4 (먼저 하려던 행동 vs 안심 조건)
  const sameAction = r3.code === c.t4;
  const m03: Compare = {
    same: sameAction,
    sentence: sameAction
      ? `먼저 하려던 행동 ${eulReul(q(r3.text))} 떠올렸고, 마음이 놓이는 조건으로 고른 ${q(r4.text)}도 같은 확인 방향에 있었습니다.`
      : `먼저 ${eulReul(q(r3.text))} 생각했지만, 마음이 놓이는 조건으로는 ${eulReul(q(r4.text))} 골랐습니다.`,
    fact: sameAction ? '보인 행동과 안심 조건이 같은 범주의 관심이었습니다.' : '먼저 취하려던 행동과 안심을 위해 필요한 정보가 달랐습니다.',
    leftLabel: '먼저 하려던 행동',
    leftText: r3.text,
    rightLabel: '마음이 놓이는 조건',
    rightText: r4.text,
  };

  // ── T2/T4/T5 → Q6
  const timeline = [
    { label: '장면 2 · 믿음이 가는 정보', text: r2.text, focus: tag(c.t2) },
    { label: '장면 4 · 마음이 놓이는 조건', text: r4.text, focus: tag(c.t4) },
    { label: '장면 5 · 다시 맡길 때의 정보', text: r5.text, focus: tag(c.t5) },
    { label: '장면 6 · 마지막에 고른 것', text: r6.text, focus: tag(r6.code) },
  ];
  const origins: Partial<Record<TypeCode, number[]>> = {};
  ([[2, c.t2], [4, c.t4], [5, c.t5]] as [number, TypeCode][]).forEach(([s, code]) => ((origins[code] ??= []).push(s)));

  const m04sentences: string[] = [];
  const compares: { sentence: string; observed: string; diff: string }[] = [];
  let patternLine: string;
  if (c.pattern === 'U') {
    m04sentences.push(`서로 다른 상황에서도 ${iGa(tag(c.t2))} 세 번 선택되었습니다.`);
    m04sentences.push('최종 결과는 앞선 세 장면에서 반복한 유형이며, 마지막 선택은 같은 유형 안에서 선호한 세부 근거를 나타냅니다.');
    m04sentences.push(`마지막에는 같은 유형 안의 두 소식 중 ${eulReul(q(r6.text))} 골랐고, 함께 있던 ${q(losers[0].text)}도 같은 방향의 소식이었습니다.`);
    patternLine = '세 장면에서 같은 방식이 이어졌어요.';
  } else if (c.pattern === 'P') {
    m04sentences.push(`이번 세 장면에서는 두 가지 확인 방식이 선택됐고 마지막에는 ${eulReul(q(r6.text))} 먼저 확인하기로 했습니다.`);
    m04sentences.push(`${tag(r6.code)} 쪽을 ${tag(losers[0].code)} 쪽보다 먼저 확인했습니다. 이 마지막 비교로 유형이 정해졌고, 선택 횟수를 세어 정하지 않았습니다.`);
    patternLine = '두 가지 확인 방식 사이에서 마지막 비교를 했어요.';
  } else {
    m04sentences.push(`세 장면에서 서로 다른 확인 방식을 선택했고 마지막에는 ${eulReul(q(r6.text))} 우선했습니다.`);
    m04sentences.push(`세 기준이 모두 후보였지만 지금 가장 먼저 확인하기로 한 것은 ${tag(r6.code)} 쪽입니다.`);
    patternLine = '세 가지 확인 방식을 마지막에 직접 비교했어요.';
  }
  if (c.pattern !== 'U') {
    for (const l of losers) {
      const p = SPEC.pairs[r6.code + l.code];
      if (!p) throw new Error(`비교 해석이 없습니다: ${r6.code}${l.code}`);
      compares.push({ sentence: p.sentence, observed: p.observed, diff: p.diff });
    }
  }

  // ── 시간 로그의 Q6 서술 (처음 누른 것 vs 최종)
  const q6Notes: string[] = [];
  const firstIsFinal = r6.timing.firstOptionId === r6.optionId;
  if (r6.timing.revisionCount === 0) {
    q6Notes.push(`마지막 선택에서는 ${eulReul(q(row6.firstText))} 선택하고 그대로 확정했습니다. 결과 유형은 이 확정을 기준으로 합니다.`);
  } else if (firstIsFinal) {
    q6Notes.push(`마지막 선택에서는 ${r6.timing.revisionCount}회 선택을 바꾼 뒤 처음 고른 ${q(r6.text)}로 돌아와 확정했습니다.`);
  } else {
    q6Notes.push(`마지막 선택에서는 처음에 ${eulReul(q(row6.firstText))} 눌렀다가 ${q(r6.text)}로 바꿔 확정했습니다. 결과는 처음 누른 항목이 아니라 확정한 선택을 기준으로 합니다.`);
  }
  q6Notes.push(...row6.sentences.slice(-2));

  // ── 왜 이 유형인가
  const quotes = [
    { label: '장면 2', text: r2.text },
    { label: '장면 4', text: r4.text },
    { label: '장면 5', text: r5.text },
    { label: '장면 6', text: r6.text },
  ];
  const chain = [
    { label: '관찰된 선택', text: `${tag(c.t2)} · ${tag(c.t4)} · ${tag(c.t5)} 쪽 정보를 고른 뒤, 마지막에 ${eulReul(q(r6.text))} 확정했습니다.` },
    { label: '우선한 확인', text: `이번 선택에서는 ${eulReul(info.focus)} 먼저 확인하려 했습니다.` },
    { label: '확인 방식', text: `${info.name}: ${info.sentence}` },
    { label: '연구 페르소나', text: `안심ON이 만난 보호자의 네 가지 확인 방식 중 ‘${info.kind}’(${info.personaBasis})의 관심과 닮아 있습니다.` },
  ];
  const sceneNote = (code: TypeCode) => (origins[code] ? sceneList(origins[code]!) : null);
  const why: string[] = [];
  if (c.pattern === 'U') {
    why.push(
      `${sceneList([2, 4, 5])}에서 모두 ${tag(c.type)} 쪽 정보를 골랐기 때문에 ${euroRo(info.name)} 이어졌습니다. 마지막 선택은 유형을 바꾸는 비교가 아니라 같은 유형 안에서 ${eulReul(q(r6.text))} 더 듣고 싶다는 세부 선택이었습니다.`,
    );
  } else {
    const where = sceneNote(r6.code);
    why.push(
      where
        ? `${where}에서도 ${tag(r6.code)} 쪽을 골랐지만, 유형은 횟수가 아니라 마지막 직접 비교에서 정해졌습니다. 마지막에 ${tag(r6.code)} 쪽을 먼저 확인하기로 해 ${euroRo(info.name)} 이어졌습니다.`
        : `세 장면에서는 ${tag(r6.code)} 쪽을 고르지 않았지만, 마지막 직접 비교에서 ${tag(r6.code)} 쪽을 먼저 확인하기로 해 ${euroRo(info.name)} 이어졌습니다. 앞선 장면에서 고르지 않았다는 사실이 이 선택을 약하게 만들지는 않습니다.`,
    );
  }
  why.push('이 해석은 이번 여섯 장면의 선택에 한정됩니다. 다른 상황에서는 다른 확인 방식이 먼저일 수 있습니다.');

  // ── 나에게 안심이란 (모바일 · PNG)
  const meaning = `이번 선택에서 나에게 안심이란, ${q(r6.text)}에 가까웠습니다.`;
  const meaningDetail = `${eulReul(info.basis)} 확인할 수 있을 때 마음이 놓이는 방향입니다.`;

  // ── 스탠바이미 R01~R04
  const l1 = sameFirst
    ? `처음 궁금했던 것과 마음이 놓이는 정보가 이번 장면에서는 같은 맥락이었어요.`
    : `처음에는 ${q(r1.text)}라는 궁금증이 떠올랐고, 마음이 놓이는 정보로는 ${eulReul(q(r2.text))} 골랐어요.`;
  const l2 = sameAction
    ? `가족의 모습을 살필 때 먼저 하려던 행동과 마음이 놓이는 조건도 같은 방향이었어요.`
    : `먼저 ${eulReul(q(r3.text))} 생각했지만, 마음이 놓이는 조건으로는 ${eulReul(q(r4.text))} 골랐어요.`;
  const tagParts = [`마지막 선택 ${row6.valid ? formatSeconds(row6.decisionDurationMs) : '측정 불가'}`];
  if (r6.timing.revisionCount > 0) tagParts.push(`선택을 ${r6.timing.revisionCount}회 바꿈`);

  const r03s1 =
    c.pattern === 'U'
      ? `세 장면에서 같은 확인 방식이 이어졌고, 마지막에는 ${eulReul(q(r6.text))} 골랐어요.`
      : c.pattern === 'P'
        ? `두 가지 확인 방식 중 마지막 비교에서 ${eulReul(q(r6.text))} 먼저 확인하기로 했어요.`
        : `세 가지 확인 방식 중 마지막 비교에서 ${eulReul(q(r6.text))} 먼저 확인하기로 했어요.`;

  const imageTrail = [
    { label: '처음 떠오른 궁금증 → 마음이 놓이는 정보', value: sameFirst ? '같은 맥락' : '서로 달랐어요' },
    { label: '먼저 하려던 행동 → 마음이 놓이는 조건', value: sameAction ? '같은 맥락' : '서로 달랐어요' },
    { label: '마지막 선택', value: q(r6.text) },
  ];

  return {
    version: ANALYSIS_VERSION,
    mode: 'branch',
    type: c.type,
    typeName: info.name,
    kind: info.kind,
    pattern: c.pattern,
    q6Id: c.q6Id,
    exposedQuestionIds: log.records.map((r) => r.questionId),
    locker: info.locker,
    winnerText: r6.text,
    character: { file: info.characterFile, src: CHARACTER_DIR + info.characterFile, alt: info.characterAlt },
    standby: {
      r01: {
        headline: sameFirst ? '처음 떠오른 걱정과, 마음이 놓이는 이유가 같은 방향이었습니다.' : '처음 떠오른 걱정과, 마음이 놓이는 이유는 꼭 같지 않았습니다.',
        lines: [l1, l2],
        tag: tagParts.join(' · '),
      },
      r02: { headline: '당신의 선택은 어떤 보호자의 확인 방식과 닮아 있을까요?', line: patternLine },
      r03: { typeLabel: `TYPE ${c.type}`, name: info.name, kind: info.kind, sentences: [r03s1, info.sentence] },
      r04: { locker: info.locker, summary: `${info.name} · ${info.sentence}` },
    },
    mobile: {
      m01: { typeLabel: `TYPE ${c.type}`, name: info.name, kind: info.kind, priority: info.sentence },
      m02,
      m03,
      m04: { timeline, sentences: m04sentences, compares },
      m05: {
        rows,
        q6Notes,
        caution: '선택에 걸린 시간은 이번 선택 과정을 설명하는 기록입니다. 시간의 길이만으로는 이유를 알 수 없고, 다른 사람과 견주지 않습니다.',
      },
      m06: { quotes, chain, paragraphs: why },
      m07: { meaning, meaningDetail },
      disclaimers: DISCLAIMERS,
    },
    image: {
      typeLabel: `TYPE ${c.type}`,
      name: info.name,
      kind: info.kind,
      characterSrc: CHARACTER_DIR + info.characterFile,
      sentences: [r03s1, info.sentence],
      trail: imageTrail,
      meaning,
      footer: '전시용 체험 해석이며 검증된 성격 검사나 미래 행동 예측이 아닙니다.',
    },
  };
}
