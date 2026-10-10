import { useState } from 'react';
import { Logo } from '../../../components/Logo';

/**
 * S00 대기(유입) → S01 안내. 병원·입소·면회 같은 미래 돌봄 상황은 가정하지 않고 현재의 가족·일상 장면만 안내한다.
 * 캐릭터와 유형색은 여기서 보이지 않는다.
 */
export function Intro({ onStart }: { onStart: () => void }) {
  const [guide, setGuide] = useState(false);
  if (!guide) {
    return (
      <div className="ki ki-hero">
        <header className="kq-top">
          <Logo />
        </header>
        <main className="ki-main">
          <h1 className="ki-title">
            끝까지 남기는 것은
            <br />
            <em>무엇일까요?</em>
          </h1>
          <p className="ki-sub">여섯 번의 선택으로 알아보는 나의 확인 방식</p>
        </main>
        <footer className="ki-foot">
          <button className="btn primary xl" onClick={() => setGuide(true)}>
            테스트 시작하기
          </button>
        </footer>
      </div>
    );
  }
  return (
    <div className="ki">
      <header className="kq-top">
        <Logo />
      </header>
      <main className="ki-main">
        <h1 className="ki-title sm">
          내가 곁에 없던 시간.
          <br />
          무슨 일이 어떻게 이루어졌는지
          <br />
          알고 싶었던 적 있나요?
        </h1>
        <p className="ki-sub strong">당신의 답은 다음 질문을 바꿉니다.</p>
        <p className="ki-note">정답은 없어요. 마음에 가장 가까운 선택을 골라 주세요. 고정된 성격을 진단하는 검사가 아니라 전시 체험이에요.</p>
      </main>
      <footer className="ki-foot">
        <button className="btn primary xl" onClick={onStart}>
          시작하기
        </button>
      </footer>
    </div>
  );
}
