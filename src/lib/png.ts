/**
 * 개인 응답이 담긴 결과 이미지(1080×1920 PNG) 생성 + 저장/공유.
 * 고정된 유형 카드 4장을 내보내는 방식이 아니라, 이 관람객의 분석 결과(선택 문장·방향·시간·수정)를 그려 넣는다.
 */
import type { BranchAnalysis } from '../modes/branch/analysis';

export const PNG_W = 1080;
export const PNG_H = 1920;

const NAVY = '#142d6e';
const BLUE = '#1e55ff';
const INK = '#0a0a0f';
const GRAY = '#f0f0f0';
const FONT = `"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", system-ui, sans-serif`;

type Ctx = CanvasRenderingContext2D;

function wrap(ctx: Ctx, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  // 공백 단위로 우선, 한 단어가 너무 길면 글자 단위로 쪼갠다
  for (const word of text.split(/(\s+)/)) {
    const trial = line + word;
    if (ctx.measureText(trial).width <= maxWidth) {
      line = trial;
      continue;
    }
    if (line.trim()) lines.push(line.trimEnd());
    line = '';
    if (ctx.measureText(word).width <= maxWidth) {
      line = word.trimStart();
    } else {
      for (const ch of word) {
        if (ctx.measureText(line + ch).width > maxWidth) {
          lines.push(line);
          line = ch;
        } else line += ch;
      }
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function textBlock(ctx: Ctx, text: string, x: number, y: number, maxW: number, lineH: number, draw: boolean): number {
  const lines = wrap(ctx, text, maxW);
  if (draw) lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineH));
  return y + lines.length * lineH;
}

/** 캐릭터 원본을 그대로(비율 유지, 크롭·배경 제거 없음) 불러온다. 실패하면 null — 다른 그림으로 대체하지 않는다. */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
}

export interface PngOptions {
  /** 방문자가 모바일에서 직접 적은 짧은 메모(서버에 저장되지 않음, 유형 판정과 무관). 비어 있으면 그리지 않는다. */
  reflection?: string;
}

/**
 * 1080×1920 개인 결과 이미지. 해당 유형의 캐릭터 원본 + 이 관람객의 실제 선택 문장으로 만든 짧은 요약.
 * 고정된 유형 카드 4장을 내보내는 방식이 아니다.
 */
export async function renderResultPng(a: BranchAnalysis, opts: PngOptions = {}): Promise<Blob> {
  try {
    await document.fonts?.ready;
  } catch {
    /* 폰트 준비 실패 시 시스템 글꼴로 진행 */
  }
  const canvas = document.createElement('canvas');
  canvas.width = PNG_W;
  canvas.height = PNG_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이미지를 만들 수 없는 브라우저입니다.');
  const img = a.image;
  const character = await loadImage('./' + img.characterSrc);

  // 배경
  const g = ctx.createLinearGradient(0, 0, 0, PNG_H);
  g.addColorStop(0, NAVY);
  g.addColorStop(1, '#0b1a45');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, PNG_W, PNG_H);
  ctx.textBaseline = 'alphabetic';

  // 헤더
  ctx.fillStyle = '#fff';
  ctx.font = `800 52px ${FONT}`;
  ctx.fillText('안심ON', 72, 120);
  ctx.font = `500 28px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('미래 보호자 유형 테스트', 72, 164);

  // 유형 배지 + 이름
  ctx.font = `700 32px ${FONT}`;
  const badgeW = ctx.measureText(img.typeLabel).width + 52;
  ctx.fillStyle = BLUE;
  roundRect(ctx, 72, 214, badgeW, 60, 30);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(img.typeLabel, 98, 256);
  ctx.font = `800 80px ${FONT}`;
  let y = textBlock(ctx, img.name, 72, 360, PNG_W - 144, 96, true);
  ctx.font = `600 34px ${FONT}`;
  ctx.fillStyle = '#b9c9ff';
  ctx.fillText(img.kind, 72, y + 8);
  y += 40;

  // 캐릭터 (원본 비율 유지)
  const boxW = PNG_W - 144;
  const boxH = 760;
  if (character) {
    const s = Math.min(boxW / character.naturalWidth, boxH / character.naturalHeight);
    const w = character.naturalWidth * s;
    const h = character.naturalHeight * s;
    ctx.drawImage(character, 72 + (boxW - w) / 2, y + (boxH - h) / 2, w, h);
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.setLineDash([14, 12]);
    ctx.lineWidth = 3;
    roundRect(ctx, 72, y, boxW, boxH, 28);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = `600 30px ${FONT}`;
    ctx.fillText('캐릭터 원본 파일이 없습니다', 72 + 40, y + boxH / 2);
  }
  y += boxH + 44;

  // 개인 요약 카드: 실제 선택 문장 기반 짧은 문장들
  const cardX = 56;
  const cardW = PNG_W - 112;
  const innerX = cardX + 44;
  const innerW = cardW - 88;
  const lines: { text: string; font: string; color: string; gap: number }[] = [
    ...img.sentences.map((s) => ({ text: s, font: `600 31px ${FONT}`, color: INK, gap: 16 })),
    { text: img.meaning, font: `800 33px ${FONT}`, color: NAVY, gap: 16 },
  ];
  if (opts.reflection && opts.reflection.trim()) {
    lines.push({ text: `나의 메모: ${opts.reflection.trim().slice(0, 120)}`, font: `500 28px ${FONT}`, color: '#26304a', gap: 10 });
  }
  const flow = (draw: boolean, top: number) => {
    let yy = top;
    for (const l of lines) {
      ctx.font = l.font;
      ctx.fillStyle = l.color;
      yy = textBlock(ctx, l.text, innerX, yy + 30, innerW, 46, draw) + l.gap - 30;
    }
    return yy;
  };
  const measureEnd = flow(false, y + 40);
  const cardH = Math.min(PNG_H - 150 - y, measureEnd - y + 30);
  ctx.fillStyle = '#fff';
  roundRect(ctx, cardX, y, cardW, cardH, 32);
  ctx.fill();
  flow(true, y + 40);

  // 푸터
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = `400 23px ${FONT}`;
  textBlock(ctx, img.footer, 72, PNG_H - 70, PNG_W - 144, 32, true);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 변환 실패'))), 'image/png');
  });
}

export type SaveOutcome = 'shared' | 'downloaded' | 'preview' | 'cancelled';

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && (navigator as Navigator & { maxTouchPoints: number }).maxTouchPoints > 1);

/**
 * 저장 시도 순서
 *  1) Web Share API(파일 공유) — iOS Safari, Android Chrome의 공유 시트에서 "이미지 저장"/갤러리 저장 가능
 *  2) Android/데스크톱: <a download>
 *  3) iOS 등 위가 불가: 미리보기 이미지를 띄우고 "길게 눌러 사진에 추가" 안내(호출 측에서 처리)
 */
export async function saveImage(blob: Blob, filename: string): Promise<SaveOutcome> {
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: '안심ON 나의 확인 방식' });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      // 그 외 실패는 아래 대체 경로로 진행
    }
  }
  if (!isIOS()) {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      return 'downloaded';
    } catch {
      /* 미리보기로 */
    }
  }
  return 'preview';
}
