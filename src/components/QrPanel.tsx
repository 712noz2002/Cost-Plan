import { useMemo } from 'react';
import { makeQr, qrPath } from '../lib/qr';

export type SaveStatus =
  | { state: 'idle' }
  | { state: 'saving' }
  | { state: 'ok'; url: string }
  | { state: 'error'; reason: 'not-configured' | 'network' | 'timeout' | 'server' | 'insecure-url'; detail?: string };

const MESSAGE: Record<string, string> = {
  'not-configured': '결과 서버가 아직 설정되지 않았어요. (운영자: .env의 VITE_SUPABASE_* 확인)',
  network: '네트워크에 연결할 수 없어 결과를 저장하지 못했어요.',
  timeout: '서버 응답이 늦어 결과를 저장하지 못했어요.',
  server: '서버에서 결과 저장을 거절했어요.',
  'insecure-url': '공개 주소가 HTTPS가 아니라 QR을 만들지 않았어요. (운영자: VITE_PUBLIC_BASE_URL 확인)',
};

/**
 * 저장에 성공한 URL이 있을 때만 QR을 그린다. 저장 중/실패/미설정일 때는 QR 자리를 비워 두므로
 * 서버에 존재하지 않는 결과로 연결되는 가짜 QR이 화면에 나올 수 없다.
 */
export function QrPanel({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  const svg = useMemo(() => {
    if (status.state !== 'ok') return null;
    const m = makeQr(status.url);
    const quiet = 2;
    const size = m.size + quiet * 2;
    return { size, d: qrPath(m), quiet };
  }, [status]);

  if (status.state === 'ok' && svg) {
    return (
      <div className="qr-panel">
        <h3>내 결과 자세히 보기</h3>
        <div className="qr-box">
          <svg viewBox={`${-svg.quiet} ${-svg.quiet} ${svg.size} ${svg.size}`} role="img" aria-label="모바일 결과 QR 코드" shapeRendering="crispEdges">
            <rect x={-svg.quiet} y={-svg.quiet} width={svg.size} height={svg.size} fill="#fff" />
            <path d={svg.d} fill="#0a0a0f" />
          </svg>
        </div>
        <p>휴대폰 카메라로 스캔하면 선택의 의미와 시간 기록을 볼 수 있어요.</p>
        <p>이 링크를 아는 사람은 결과를 볼 수 있어요.</p>
      </div>
    );
  }
  if (status.state === 'error') {
    return (
      <div className="qr-panel">
        <h3>QR을 만들지 못했어요</h3>
        <p className="qr-err">{MESSAGE[status.reason] ?? '결과를 저장하지 못했어요.'}</p>
        <p>저장에 성공해야만 QR이 표시돼요.</p>
        {status.reason !== 'not-configured' && status.reason !== 'insecure-url' && (
          <button className="btn primary" onClick={onRetry}>
            다시 시도
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="qr-panel">
      <div className="spinner" aria-hidden="true" />
      <h3>내 결과를 저장하는 중이에요</h3>
      <p>저장이 끝나면 QR이 나타나요.</p>
    </div>
  );
}
