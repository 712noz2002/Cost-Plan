// 예시 결과 스냅샷 생성: npx tsx scripts/snapshots.ts > docs/SAMPLE_RESULTS.md
// 시간 값은 테스트 하네스가 만든 가상 값이며 실제 관람객 데이터가 아니다.
import { enumeratePaths } from '../src/modes/branch/enumerate';
import { analyzeBranch } from '../src/modes/branch/analysis';
import { logFromAnswers, rng } from '../tests/helpers';

const all = [...enumeratePaths()];
const find = (f: (p: (typeof all)[number]) => boolean) => all.find(f)!;
const picks = [
  ['A-1 · 세 장면 모두 A (Q6_U_A)', find((p) => p.result.q6Id === 'Q6_U_A' && p.answers[5].optionId.endsWith('#2'))],
  ['A-2 · 초기 B, Q6_T_ACD에서 A 선택 (엑셀 E1)', find((p) => p.result.q6Id === 'Q6_T_ACD' && p.result.type === 'A' && p.answers[0].code === 'B' && p.answers[1].code === 'A')],
  ['B · Q6_P_AB에서 B 선택 (엑셀 E3)', find((p) => p.result.q6Id === 'Q6_P_AB' && p.result.type === 'B')],
  ['C · Q6_T_ACD에서 C 선택 (엑셀 E4)', find((p) => p.result.q6Id === 'Q6_T_ACD' && p.result.type === 'C' && p.answers[0].code === 'B')],
  ['D · 세 장면 모두 D (Q6_U_D, 엑셀 E2)', find((p) => p.result.q6Id === 'Q6_U_D' && p.answers[5].optionId.endsWith('#2'))],
] as const;

const rand = rng(11);
const out: string[] = ['# 예시 결과 스냅샷 (v7)', '', '> 선택 문장은 실제 문항에서 고른 값이고, **시간·수정 값은 테스트 하네스가 만든 가상 값**입니다. 실제 관람객 데이터가 아닙니다.', ''];
for (const [title, p] of picks) {
  const a = analyzeBranch(logFromAnswers(p.answers, rand));
  out.push(`## ${title}`, `경로: ${a.exposedQuestionIds.join(' → ')} / 결과 ${a.standby.r03.typeLabel} ${a.typeName} / 보관함 ${a.locker} / 캐릭터 ${a.character.file}`, '');
  out.push('**R01** ' + a.standby.r01.headline, ...a.standby.r01.lines.map((l) => `- ${l}`), `- 태그: ${a.standby.r01.tag}`, '');
  out.push('**R03** ' + a.standby.r03.name, ...a.standby.r03.sentences.map((l) => `- ${l}`), '');
  out.push('**M02** ' + a.mobile.m02.sentence, '', '**M03** ' + a.mobile.m03.sentence, '');
  out.push('**M04**', ...a.mobile.m04.sentences.map((l) => `- ${l}`), ...a.mobile.m04.compares.map((c) => `- (비교) ${c.sentence}`), '');
  out.push('**M05 Q6**', ...a.mobile.m05.q6Notes.map((l) => `- ${l}`), '');
  out.push('**M06**', ...a.mobile.m06.paragraphs.map((l) => `- ${l}`), '', '**나에게 안심이란** ' + a.mobile.m07.meaning + ' ' + a.mobile.m07.meaningDetail, '');
}
console.log(out.join('\n'));
