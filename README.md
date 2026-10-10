# 안심ON 분기형 미래 보호자 유형 테스트 (v7 명세 구현)
기존 카드 소거형 테스트를 대체하지 않고, 운영자 설정으로 고르는 **두 번째 모드**로 추가한 React+TypeScript 앱입니다.

- 명세 원본: `spec/branch-spec-v7.xlsx` → `npm run gen:spec` → `src/spec/spec.generated.ts`
  (25문항·76선택지·유형/캐릭터·12쌍 비교 문장을 자동 변환하고, `01_질문_25종`과 `02_선택지_코드`를 교차 검증)
- 분기 엔진: `src/modes/branch/engine.ts` / 전수 열거: `enumerate.ts` / 질문 사이 연결 문장: `narrative.ts`
- 선택 과정 기록: `timing.ts` (decisionStartAt·firstTapDurationMs·postFirstDurationMs·decisionDurationMs·tapHistory·revisionCount)
  / 응답 수정 시 하위 기록 재설정: `session.ts`
- 규칙 기반 결과 분석: `analysis.ts` (스탠바이미 R01~R04, 모바일 M01~M07, PNG가 한 객체에서 나옴)
- 화면: 질문(`screens/Question.tsx`, 질문이 주인공인 반응형 편집 레이아웃) · 결과 4장면(`screens/Results.tsx`) · 모바일(`src/mobile/MobileResult.tsx`)
- 테스트: `npm test`(엔진·시간·분석), `npm run e2e`(브라우저 흐름, 가로/세로/소형 뷰포트)
- 배포: docs/DEPLOY.md · 터치 점검: docs/TOUCH_TEST_CHECKLIST.md · 캐릭터 원본 넣는 법: public/assets/characters/README.txt

## 화면 방향
고정 해상도 스테이지를 쓰지 않고 CSS 뷰포트(vmin/clamp) 기준으로 가로·세로 모두 반응합니다. 1920×1080은 물리 해상도 참고치입니다.
세로로 회전한 스탠바이미(1080×1920)에서는 글자·여백 단위를 키웁니다.

## 레퍼런스 사이트
시트 08의 참고 링크(thecommunity.co.kr/season/2)는 제작 환경에서 열람 권한을 얻지 못해 직접 보지 못했습니다.
이 앱은 그 사이트의 UI·문구·로고·코드를 사용하거나 모방했다고 주장하지 않으며, 시트 08의 원칙(질문이 첫 시선, 동등한 선택지, 한 화면 한 결정)만 구현했습니다.
