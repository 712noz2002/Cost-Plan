import { useState } from 'react';

/**
 * 안심ON BI. public/assets/logo.png 가 있으면 그것을 쓰고, 없으면 텍스트 워드마크로 대체한다.
 * (BI 원본 파일은 운영자가 직접 넣는다. 파일명만 맞추면 된다.)
 */
export function Logo({ dark = false }: { dark?: boolean }) {
  const [missing, setMissing] = useState(false);
  return (
    <span className={`logo${dark ? ' on-dark' : ''}`} aria-label="안심ON">
      {!missing ? (
        <img src="./assets/logo.png" alt="안심ON" onError={() => setMissing(true)} />
      ) : (
        <>
          <i className="logo-dot" aria-hidden="true" />
          <span>안심ON</span>
        </>
      )}
    </span>
  );
}
