import { useEffect, useState } from 'react';
import { Kiosk } from './Kiosk';
import { MobileResult } from './mobile/MobileResult';

/** /results/<토큰> 또는 #/r/<토큰> 이면 모바일 결과 페이지, 아니면 전시장 키오스크 화면. */
function routeFromHash(): { kind: 'result'; token: string } | { kind: 'kiosk' } {
  const m = /^#\/r\/([A-Za-z0-9_-]+)\/?$/.exec(window.location.hash) ?? /\/results\/([A-Za-z0-9_-]+)\/?$/.exec(window.location.pathname);
  return m ? { kind: 'result', token: m[1] } : { kind: 'kiosk' };
}

export function App() {
  const [route, setRoute] = useState(routeFromHash);
  useEffect(() => {
    const on = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route.kind === 'result' ? <MobileResult token={route.token} /> : <Kiosk />;
}
