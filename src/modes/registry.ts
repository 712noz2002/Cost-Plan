/**
 * 테스트 모드 레지스트리.
 * 모드별로 분석 함수가 분리되어 있고, 서로의 결과를 합산하거나 공유하지 않는다.
 *
 *  - branch  : 이 저장소의 분기형 6문항 모드. 분석은 modes/branch/analysis.ts
 *  - keyword : 기존 '끝까지 남긴 마음' 카드 소거형 테스트(단일 HTML). 삭제·수정하지 않고 iframe으로만 연다.
 *              분석은 그 HTML 안에 그대로 남아 있으며 이 앱은 관여하지 않는다.
 */
import type { ModeId } from '../config/settings';

export interface ModeInfo {
  id: ModeId;
  label: string;
  description: string;
  kind: 'native' | 'embedded';
}

export const MODES: Record<ModeId, ModeInfo> = {
  branch: {
    id: 'branch',
    label: '분기형 테스트 (6문항)',
    description: '현재 가족·일상 장면 6개 → 직접 비교 → 4유형 중 1개. 모바일 QR 결과 포함.',
    kind: 'native',
  },
  keyword: {
    id: 'keyword',
    label: '카드 소거형 테스트 (기존)',
    description: '기존 키워드 카드 8개 중 5개를 고르고 하나씩 내려놓는 테스트. 별도 파일로 그대로 실행됩니다.',
    kind: 'embedded',
  },
};
