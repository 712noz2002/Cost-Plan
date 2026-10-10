import { useState } from 'react';

/**
 * 결과 캐릭터 원본 이미지. 원본 PNG를 크롭·배경 제거·색 변경 없이 비율 그대로(object-fit: contain) 보여 준다.
 * 파일이 없으면 다른 그림으로 대체하지 않고, 빠진 파일 이름을 그대로 알린다.
 */
export function Character({ src, alt, file }: { src: string; alt: string; file: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="char char-missing" role="img" aria-label={alt}>
        <b>캐릭터 원본 파일이 없습니다</b>
        <span>public/assets/characters/{file}</span>
      </div>
    );
  }
  return (
    <div className="char">
      <img src={`./${src}`} alt={alt} decoding="async" onError={() => setFailed(true)} />
    </div>
  );
}
