export type TypeCode = 'A' | 'B' | 'C' | 'D';
export const TYPE_CODES: readonly TypeCode[] = ['A', 'B', 'C', 'D'];

export interface OptionDef {
  /** 화면 위치와 무관한 고유 ID. 예) "Q2_A#3" */
  id: string;
  /** 엑셀상 버튼 순서(1부터). 화면 위치가 아니라 기록·표시용 */
  index: number;
  text: string;
  /** 내부 유형 코드. 화면에 표시하지 않는다. */
  code: TypeCode;
}

export interface QuestionDef {
  id: string;
  step: 1 | 2 | 3 | 4 | 5 | 6;
  condition: string;
  situation: string;
  prompt: string;
  options: OptionDef[];
  intent: string;
}

export interface TypeSpecRow {
  /** 연구 페르소나 이름 (예: 돌봄 수행형) */
  persona: string;
  /** 전시용 유형명 (예: 일상을 챙기는 확인형) */
  name: string;
  /** 대표 질문 */
  question: string;
  /** 확신을 형성하는 근거 */
  basis: string;
  /** 결과 문장(전시 단문) */
  sentence: string;
  /** 캐릭터 설명 (예: 초록 털 체크리스트) */
  characterDesc: string;
  /** 캐릭터 원본 파일명 (public/assets/characters/ 아래) */
  characterFile: string;
  /** 실물 보관함 번호 */
  locker: '01' | '02' | '03' | '04';
}

export interface PairRow {
  observed: string;
  diff: string;
  sentence: string;
}

export interface Spec {
  questions: QuestionDef[];
  types: Record<TypeCode, TypeSpecRow>;
  /** 최종 선택 + 함께 제시된 다른 후보 ("AB" = A를 골랐고 B가 함께 있었음) */
  pairs: Record<string, PairRow>;
}
