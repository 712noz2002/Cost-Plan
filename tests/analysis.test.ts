import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enumeratePaths } from '../src/modes/branch/enumerate';
import { analyzeBranch, type BranchAnalysis } from '../src/modes/branch/analysis';
import { getQuestion } from '../src/modes/branch/engine';
import { ChoiceRecorder } from '../src/modes/branch/timing';
import { commitStep, newSession } from '../src/modes/branch/session';
import { fakeClock, rng, logFromAnswers } from './helpers';

const BANNED_TIME_WORDS = /평균|빠르|느리|느렸|오래 걸|더 길|더 짧|신속|더디|남들|다른 사람보다|대부분의 사람|상위|하위|퍼센트|%/;
const BANNED_CLAIMS = /불안한|불안해|책임감이 (강|높)|애착이 (강|높)|갈등이 (심|컸)|망설|주저|우유부단|변덕|속마음을 숨|모순된 성격|정체성이 불안정/;
const FORBIDDEN_IN_TEXT = /요양|입소|면회|병원/;
const strip = (t: string) => t.replace(/[.。]+$/, '');
const CHAR: Record<string, string> = {
  A: 'character_A_green_checklist.png',
  B: 'character_B_blue_question.png',
  C: 'character_C_orange_magnifier.png',
  D: 'character_D_yellow_share.png',
};
const LOCKER: Record<string, string> = { A: '01', B: '02', C: '03', D: '04' };

const pre = (a: BranchAnalysis) => JSON.stringify([a.standby.r01, a.standby.r02]);
const all = (a: BranchAnalysis) => JSON.stringify([a.standby, a.mobile, a.image, a.typeName, a.winnerText]);

test('분석: 2,432개 경로 × 무작위 시간/수정 패턴 — 금지 표현 없음, 항상 단일 유형·캐릭터·보관함 일치', () => {
  const rand = rng(20261010);
  let n = 0;
  for (const p of enumeratePaths()) {
    const log = logFromAnswers(p.answers, rand);
    const a = analyzeBranch(log);
    n++;
    assert.equal(a.type, p.result.type);
    assert.equal(a.pattern, p.result.pattern);
    assert.equal(a.q6Id, p.result.q6Id);
    assert.equal(a.exposedQuestionIds.length, 6);
    assert.equal(a.character.file, CHAR[a.type]);
    assert.equal(a.image.characterSrc, 'assets/characters/' + CHAR[a.type]);
    assert.equal(a.locker, LOCKER[a.type]);
    assert.equal(a.standby.r04.locker, LOCKER[a.type]);
    const text = all(a);
    assert.ok(!BANNED_TIME_WORDS.test(text), `금지된 시간 비교 표현: ${text.match(BANNED_TIME_WORDS)}`);
    assert.ok(!BANNED_CLAIMS.test(text), `금지된 심리 단정: ${text.match(BANNED_CLAIMS)}`);
    assert.ok(!/Q\d_[A-Z]|Q6_[UPT]|#\d|undefined|NaN|\[Q/.test(text), '내부 ID/미치환 변수 노출');
    assert.ok(!FORBIDDEN_IN_TEXT.test(text), `시설/절차 언급: ${text.match(FORBIDDEN_IN_TEXT)}`);
    // 유형 공개 전(R01/R02)에는 유형명·TYPE·캐릭터 파일이 없다
    const p2 = pre(a);
    assert.ok(!p2.includes(a.typeName) && !/TYPE [A-D]|character_/.test(p2), 'R03 이전 유형 공개');
    assert.equal(a.standby.r03.sentences.length, 2);
    // 모든 해설이 실제 고른 선택지 문장을 인용한다
    for (const r of log.records) assert.ok(text.includes(strip(r.text)), `step ${r.step} 선택 문장 미인용`);
    // Q6 유형 연결
    if (a.pattern === 'U') assert.equal(a.mobile.m04.compares.length, 0);
    if (a.pattern === 'P') assert.equal(a.mobile.m04.compares.length, 1);
    if (a.pattern === 'T') assert.equal(a.mobile.m04.compares.length, 2);
  }
  assert.equal(n, 2432);
});

test('분석: Q1→Q2, Q3→Q4 동일/상이 해석이 코드 비교와 일치하고 두 문장을 모두 인용', () => {
  let same1 = 0, diff1 = 0, same3 = 0, diff3 = 0;
  for (const p of enumeratePaths()) {
    const log = logFromAnswers(p.answers);
    const a = analyzeBranch(log);
    const [r1, r2, r3, r4] = log.records;
    assert.equal(a.mobile.m02.same, r1.code === r2.code);
    assert.equal(a.mobile.m03.same, r3.code === r4.code);
    if (a.mobile.m02.same) { same1++; assert.ok(a.mobile.m02.sentence.includes('같은 맥락')); }
    else { diff1++; assert.ok(a.mobile.m02.sentence.includes(strip(r1.text)) && a.mobile.m02.sentence.includes(strip(r2.text))); assert.ok(a.mobile.m02.sentence.includes('꼭 같지는 않았습니다')); }
    if (a.mobile.m03.same) same3++;
    else { diff3++; assert.ok(a.mobile.m03.sentence.includes(strip(r3.text)) && a.mobile.m03.sentence.includes(strip(r4.text))); }
  }
  assert.ok(same1 > 0 && diff1 > 0 && same3 > 0 && diff3 > 0);
});

test('분석: Q6_P/T 비교 해석은 엑셀 12쌍 문장을 최종 선택-비교 후보 순서로 사용', () => {
  let p = 0, t = 0;
  for (const path of enumeratePaths()) {
    if (path.result.pattern === 'U') continue;
    const log = logFromAnswers(path.answers);
    const a = analyzeBranch(log);
    const r6 = log.records[5];
    const others = r6.options.filter((o) => o.id !== r6.optionId);
    assert.equal(a.mobile.m04.compares.length, others.length);
    others.forEach((o, i) => {
      assert.ok(a.mobile.m04.compares[i].sentence.startsWith('이번 마지막 선택에서는'));
      assert.ok(a.mobile.m04.compares[i].sentence.includes('먼저 확인하는 방식을 우선했습니다'));
      assert.ok(o.code !== r6.code);
    });
    if (path.result.pattern === 'P') p++; else t++;
  }
  assert.ok(p > 0 && t > 0);
});

test('분석: 같은 유형 A라도 일치형·Q6 직접 선택 경로의 설명이 다르다 (A만 고른 사람으로 서술 금지)', () => {
  const picked: Record<string, BranchAnalysis> = {};
  for (const p of enumeratePaths()) {
    if (p.result.type !== 'A') continue;
    if (!picked[p.result.pattern]) picked[p.result.pattern] = analyzeBranch(logFromAnswers(p.answers));
  }
  const why = (a: BranchAnalysis) => a.mobile.m06.paragraphs.join('|') + a.mobile.m04.sentences.join('|');
  assert.notEqual(why(picked.U), why(picked.P));
  assert.notEqual(why(picked.P), why(picked.T));
  assert.ok(why(picked.U).includes('세 번 선택'));
  assert.ok(why(picked.P).includes('횟수가 아니라') || why(picked.P).includes('세어 정하지'));
  // 예시 E1: 초기 B, Q6_T_ACD에서 A 선택 — 'A만 고른 사람' 서술이 없다
  const e1 = [...enumeratePaths()].find((p) => p.result.q6Id === 'Q6_T_ACD' && p.result.type === 'A' && p.answers[0].code === 'B' && p.answers[1].code === 'A')!;
  const a1 = analyzeBranch(logFromAnswers(e1.answers));
  assert.ok(!/A만|항상|언제나/.test(all(a1)));
});

test('분석: 선택 수정 서술은 실제 기록과 일치(수정 없음 ≠ 수정했다)', () => {
  const first = [...enumeratePaths()][0];
  const none = analyzeBranch(logFromAnswers(first.answers));
  for (const row of none.mobile.m05.rows) {
    assert.equal(row.revisionCount, 0);
    assert.ok(row.sentences.some((s) => s.includes('그대로 확정했습니다')));
    assert.ok(!row.sentences.some((s) => /회 선택을 바꾸면서/.test(s)));
  }
  assert.ok(!none.standby.r01.tag.includes('바꿈'));
  const rand = rng(7);
  let sawChange = false;
  for (let i = 0; i < 30; i++) {
    const a = analyzeBranch(logFromAnswers(first.answers, rand));
    for (const row of a.mobile.m05.rows) {
      if (row.revisionCount > 0) {
        sawChange = true;
        assert.ok(row.sentences.some((s) => s.includes(`${row.revisionCount}회 선택을 바꾸면서`)));
        assert.ok(!row.sentences.some((s) => s.includes('그대로 확정했습니다')));
      }
    }
  }
  assert.ok(sawChange);
});

test('분석: Q6에서 처음 누른 항목과 최종 확정이 다르면 판정은 확정 항목 기준이며 서술도 구분한다', () => {
  // Q6_P_AC: 옵션1=A, 옵션2=C. 처음 C → A로 변경 확정 (엑셀 E5)
  const base = [...enumeratePaths()].find((p) => p.result.q6Id === 'Q6_P_AC')!;
  const clock = fakeClock();
  let log = newSession('s', clock.epoch());
  for (const ans of base.answers.slice(0, 5)) {
    const q = getQuestion(ans.questionId);
    const rec = new ChoiceRecorder(q.options, clock);
    clock.advance(1000); rec.start(); clock.advance(500); rec.tap(ans.optionId); clock.advance(500);
    log = commitStep(log, ans.questionId, ans.optionId, rec.finalize(), clock.epoch()).log;
  }
  const q6 = getQuestion(base.answers[5].questionId);
  const doIt = (order: number[]) => {
    const c2 = fakeClock(9_000_000);
    const rec = new ChoiceRecorder(q6.options, c2);
    rec.start();
    for (const i of order) { c2.advance(3000); rec.tap(q6.options[i].id); }
    c2.advance(2000);
    const finalId = q6.options[order[order.length - 1]].id;
    return analyzeBranch(commitStep(log, q6.id, finalId, rec.finalize(), 0).log);
  };
  const changed = doIt([1, 0]); // C → A
  assert.equal(changed.type, 'A');
  assert.ok(changed.mobile.m05.q6Notes[0].includes('바꿔 확정'));
  assert.ok(changed.mobile.m05.q6Notes[0].includes('처음 누른 항목이 아니라 확정한 선택'));
  const kept = doIt([0]); // A 그대로
  assert.equal(kept.type, 'A');
  assert.ok(kept.mobile.m05.q6Notes[0].includes('그대로 확정'));
  const back = doIt([0, 1, 0]); // A → C → A
  assert.ok(back.mobile.m05.q6Notes[0].includes('처음 고른'));
  assert.notEqual(changed.mobile.m05.q6Notes[0], kept.mobile.m05.q6Notes[0]);
});

test('분석: 시간 값이 유효하지 않으면 측정 불가로 표시하고 숫자를 만들지 않는다', () => {
  const first = [...enumeratePaths()][0];
  const log = logFromAnswers(first.answers);
  log.records[5].timing = { ...log.records[5].timing, decisionDurationMs: NaN };
  const a = analyzeBranch(log);
  assert.equal(a.mobile.m05.rows[5].valid, false);
  assert.ok(a.mobile.m05.rows[5].sentences.join('').includes('측정 불가'));
  assert.ok(a.standby.r01.tag.includes('측정 불가'));
  assert.ok(!/NaN/.test(all(a)));
});

test('분석: 설명 불가한 입력(6문항 미만)은 예외', () => {
  const first = [...enumeratePaths()][0];
  assert.throws(() => analyzeBranch(logFromAnswers(first.answers.slice(0, 5))));
});
