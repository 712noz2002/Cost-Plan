import { SPEC } from '../../spec/spec.generated';
import type { TypeCode } from '../../spec/types';

export interface TypeInfo {
  code: TypeCode;
  /** 전시용 명칭 (엑셀 04_유형·캐릭터) */
  name: string;
  /** 연구 페르소나 이름 */
  kind: string;
  /** 대표 질문 */
  question: string;
  /** 확신을 형성하는 근거 */
  basis: string;
  /** 결과 문장(전시 단문) */
  sentence: string;
  /** 문장 속에서 한 방향을 가리키는 짧은 명사구 */
  focus: string;
  /** 프로젝트 페르소나가 확신을 얻는 근거 이름 */
  personaBasis: string;
  characterFile: string;
  characterAlt: string;
  /** 실물 보관함 번호 */
  locker: '01' | '02' | '03' | '04';
}

const FOCUS: Record<TypeCode, string> = {
  A: '실제로 진행된 과정',
  B: '판단의 이유와 결과의 부합',
  C: '달라진 점과 이후 조정',
  D: '가족이 함께 이해하는 내용',
};
const PERSONA: Record<TypeCode, string> = { A: '돌봄의 지속성', B: '판단의 타당성', C: '변화 대응성', D: '정보의 일치성' };

export const CHARACTER_DIR = 'assets/characters/';

export const TYPE_INFO: Record<TypeCode, TypeInfo> = (['A', 'B', 'C', 'D'] as TypeCode[]).reduce(
  (acc, code) => {
    const row = SPEC.types[code];
    acc[code] = {
      code,
      name: row.name,
      kind: row.persona,
      question: row.question,
      basis: row.basis,
      sentence: row.sentence,
      focus: FOCUS[code],
      personaBasis: PERSONA[code],
      characterFile: row.characterFile,
      characterAlt: `${row.name} 캐릭터 (${row.characterDesc})`,
      locker: row.locker,
    };
    return acc;
  },
  {} as Record<TypeCode, TypeInfo>,
);

/** 문장 속 방향 표시: ‘달라진 점과 이후 조정’ */
export const tag = (code: TypeCode): string => `‘${TYPE_INFO[code].focus}’`;
