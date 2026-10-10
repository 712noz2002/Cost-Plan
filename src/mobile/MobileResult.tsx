import { useEffect, useState } from 'react';
import { Logo } from '../components/Logo';
import { Character } from '../components/Character';
import { renderResultPng, saveImage } from '../lib/png';
import { deleteResult, fetchResult, isValidToken, type FetchedResult } from '../lib/store';
import type { Compare, TimeRow } from '../modes/branch/analysis';

type Load = { s: 'loading' } | { s: 'notfound' } | { s: 'error'; reason: string } | { s: 'ok'; data: FetchedResult } | { s: 'deleted' };

const fmtDate = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
};
const sec = (ms: number) => `${(ms / 1000).toFixed(1)}초`;

function CompareCard({ no, title, c }: { no: number; title: string; c: Compare }) {
  return (
    <section className="m-card" aria-label={title}>
      <span className="no">{no}</span>
      <h2>{title}</h2>
      <p className="lead">{c.sentence}</p>
      <div className="m-pair">
        <div className="m-item">
          <small>{c.leftLabel}</small>
          <span>{c.leftText}</span>
        </div>
        <div className="m-arrow" aria-hidden="true">↓</div>
        <div className="m-item em">
          <small>{c.rightLabel}</small>
          <span>{c.rightText}</span>
        </div>
      </div>
      <p className="m-note">이번 상황에서의 선택을 보여 줍니다. 성격을 판단하는 결과가 아니에요.</p>
    </section>
  );
}

function TimeLog({ rows }: { rows: TimeRow[] }) {
  return (
    <>
      <ol className="m-time">
        {rows.map((r) => (
          <li key={r.step}>
            <div className="m-time-head">
              <b>장면 {r.step}</b>
              <span>{r.valid ? sec(r.decisionDurationMs) : '측정 불가'}</span>
            </div>
            {r.valid && (
              <div className="m-bar" aria-hidden="true">
                <i style={{ flex: Math.max(r.firstTapDurationMs, 1) }} className="a" />
                <i style={{ flex: Math.max(r.postFirstDurationMs, 1) }} className="b" />
              </div>
            )}
            <div className="m-time-meta">
              {r.valid ? `처음 선택까지 ${sec(r.firstTapDurationMs)} · 그 뒤 확정까지 ${sec(r.postFirstDurationMs)} · ` : ''}
              {r.revisionCount === 0 ? '선택 변경 없음' : `선택 변경 ${r.revisionCount}회`}
            </div>
            <details className="m-details">
              <summary>이 장면의 선택 과정 보기</summary>
              {r.sentences.map((s, i) => (
                <p key={i}>{s}</p>
              ))}
            </details>
          </li>
        ))}
      </ol>
    </>
  );
}

/** 모바일 심층 결과. 스탠바이미와 동일한 분석 객체(서버에 저장된 analysis)를 그대로 렌더링한다. */
export function MobileResult({ token }: { token: string }) {
  const [load, setLoad] = useState<Load>({ s: 'loading' });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [reflection, setReflection] = useState('');

  const doLoad = () => {
    setLoad({ s: 'loading' });
    return fetchResult(token).then((r) => {
      if (!r.ok) setLoad({ s: 'error', reason: r.reason });
      else if (!r.data) setLoad({ s: 'notfound' });
      else setLoad({ s: 'ok', data: r.data });
    });
  };

  useEffect(() => {
    if (!isValidToken(token)) {
      setLoad({ s: 'notfound' });
      return;
    }
    void doLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  if (load.s === 'loading') {
    return (
      <div className="m-root">
        <div className="m-center"><div className="spinner" style={{ margin: '0 auto 16px' }} /><p>결과를 불러오는 중이에요…</p></div>
      </div>
    );
  }
  if (load.s === 'notfound' || load.s === 'deleted') {
    return (
      <div className="m-root">
        <div className="m-center">
          <h1>{load.s === 'deleted' ? '결과를 삭제했어요' : '결과를 찾을 수 없어요'}</h1>
          <p>{load.s === 'deleted' ? '서버에서 이 결과가 지워졌어요.' : '링크가 잘못됐거나, 보관 기간이 지나 삭제됐을 수 있어요.'}</p>
        </div>
      </div>
    );
  }
  if (load.s === 'error') {
    return (
      <div className="m-root">
        <div className="m-center">
          <h1>결과를 불러오지 못했어요</h1>
          <p>네트워크 상태를 확인하고 다시 시도해 주세요.</p>
          <button className="m-btn primary" onClick={() => void doLoad()}>다시 시도</button>
        </div>
      </div>
    );
  }

  const { payload, expiresAt } = load.data;
  const a = payload.analysis;
  const m = a.mobile;

  const onSaveImage = async () => {
    setBusy(true);
    try {
      const blob = await renderResultPng(a, { reflection });
      const outcome = await saveImage(blob, 'ansim-on-my-result.png');
      if (outcome === 'preview') setPreview(URL.createObjectURL(blob));
      else if (outcome === 'downloaded') setToast('이미지를 내려받았어요. 갤러리/다운로드 폴더를 확인해 주세요.');
      else if (outcome === 'shared') setToast('공유 창에서 “이미지 저장”을 선택하면 사진첩에 저장돼요.');
    } catch {
      setToast('이미지를 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const onShare = async () => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    const url = window.location.href;
    try {
      if (nav.share) {
        await nav.share({ title: '안심ON 나의 확인 방식', text: `나의 확인 방식은 ‘${a.typeName}’ 유형이었어요.`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setToast('링크를 복사했어요. 이 링크를 아는 사람은 결과를 볼 수 있어요.');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setToast('공유하지 못했어요. 주소창의 링크를 직접 복사해 주세요.');
    }
  };

  const onDelete = async () => {
    if (!window.confirm('이 결과를 서버에서 지울까요? 삭제하면 이 링크로 다시 볼 수 없어요.')) return;
    setBusy(true);
    const r = await deleteResult(token);
    setBusy(false);
    if (r.ok && r.data) setLoad({ s: 'deleted' });
    else setToast('삭제하지 못했어요. 잠시 후 다시 시도해 주세요.');
  };

  return (
    <div className="m-root">
      <header className="m-head">
        <Logo dark />
        <div className="m-badge">{m.m01.typeLabel}</div>
        <h1>{m.m01.name}</h1>
        <p className="kind">{m.m01.kind} 보호자의 확인 방식과 닮아 있어요</p>
        <div className="m-char">
          <Character src={a.character.src} alt={a.character.alt} file={a.character.file} />
        </div>
        <p className="m-priority">{m.m01.priority}</p>
      </header>

      <CompareCard no={1} title="처음 마음에 걸린 것과 마음이 놓이는 정보" c={m.m02} />
      <CompareCard no={2} title="먼저 하려던 행동과 마음이 놓이는 조건" c={m.m03} />

      <section className="m-card" aria-label="확인 방식의 이동">
        <span className="no">3</span>
        <h2>세 상황을 지나 마지막에 먼저 확인한 것</h2>
        <ol className="m-timeline">
          {m.m04.timeline.map((t, i) => (
            <li key={i} className={i === 3 ? 'last' : ''}>
              <small>{t.label}</small>
              <span>{t.text}</span>
              <em>{t.focus}</em>
            </li>
          ))}
        </ol>
        {m.m04.sentences.map((t, i) => (
          <p key={i}>{t}</p>
        ))}
        {m.m04.compares.map((c, i) => (
          <div key={i} className="m-item em">
            <small>{c.observed}</small>
            <span>{c.sentence}</span>
          </div>
        ))}
      </section>

      <section className="m-card" aria-label="선택 시간 기록">
        <span className="no">4</span>
        <h2>선택의 흔적: 처음 누른 것, 바꾼 횟수, 확정한 것</h2>
        <TimeLog rows={m.m05.rows} />
        {m.m05.q6Notes.map((t, i) => (
          <p key={i} className={i === 0 ? 'lead' : ''}>{t}</p>
        ))}
        <p className="m-note">{m.m05.caution}</p>
      </section>

      <section className="m-card" aria-label="왜 이 유형인가">
        <span className="no">5</span>
        <h2>왜 ‘{a.typeName}’일까요</h2>
        {m.m06.quotes.map((q, i) => (
          <div key={i} className="m-item">
            <small>{q.label}에서 고른 것</small>
            <span>{q.text}</span>
          </div>
        ))}
        <ol className="m-chain">
          {m.m06.chain.map((c, i) => (
            <li key={i}>
              <small>{c.label}</small>
              <span>{c.text}</span>
            </li>
          ))}
        </ol>
        {m.m06.paragraphs.map((t, i) => (
          <p key={i}>{t}</p>
        ))}
      </section>

      <section className="m-card meaning" aria-label="나에게 안심이란">
        <span className="no">6</span>
        <h2>나에게 안심이란</h2>
        <p className="lead">{m.m07.meaning}</p>
        <p>{m.m07.meaningDetail}</p>
        <label className="m-reflect">
          <small>선택한 이유를 직접 적어 볼 수 있어요 (선택)</small>
          <textarea
            value={reflection}
            maxLength={120}
            rows={3}
            placeholder="예: 보이지 않는 시간이 가장 궁금했어요"
            onChange={(e) => setReflection(e.target.value)}
          />
          <small>이 메모는 서버에 저장되지 않고, 유형 판정에도 쓰이지 않아요. 결과 이미지에만 넣을 수 있어요.</small>
        </label>
      </section>

      <div className="m-actions">
        <button className="m-btn primary" disabled={busy} onClick={onSaveImage}>
          {busy ? '처리 중…' : '결과 이미지 저장하기'}
        </button>
        <button className="m-btn secondary" disabled={busy} onClick={onShare}>
          공유하기
        </button>
      </div>

      <footer className="m-foot">
        {m.disclaimers.map((t, i) => (
          <p key={i}>{t}</p>
        ))}
        <p>
          이 페이지는 이름 없이 저장된 선택 기록으로 만들어졌어요. 이 링크를 아는 사람은 누구나 이 결과를 볼 수 있으니 공유에 유의해 주세요.
          {expiresAt && ` 결과는 ${fmtDate(expiresAt)}까지 보관되고 그 뒤 삭제돼요.`}
        </p>
        <button className="m-btn danger" disabled={busy} onClick={onDelete} style={{ width: '100%' }}>
          이 결과 지금 삭제하기
        </button>
      </footer>

      {preview && (
        <div className="m-img-modal" role="dialog" aria-modal="true" aria-label="결과 이미지 미리보기">
          <img src={preview} alt="나의 결과 이미지" />
          <p>이미지를 길게 눌러 “사진에 추가” 또는 “이미지 저장”을 선택해 주세요.</p>
          <button className="m-btn secondary" onClick={() => setPreview(null)}>닫기</button>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
