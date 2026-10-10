import QRCode from '../vendor/qrcode/index';
import EC from '../vendor/qrcode/QRErrorCorrectLevel';

export interface QrMatrix {
  size: number;
  /** dark[row][col] */
  dark: boolean[][];
}

/** 문자열 → QR 모듈 행렬 (오류정정 M, 버전 자동). 1~2KB 미만의 URL용. */
export function makeQr(text: string): QrMatrix {
  const qr = new QRCode(-1, EC.M);
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  const dark: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) row.push(qr.isDark(r, c));
    dark.push(row);
  }
  return { size, dark };
}

/** SVG path(d). 이웃한 어두운 모듈을 가로로 묶어 크기를 줄인다. */
export function qrPath(m: QrMatrix): string {
  let d = '';
  for (let r = 0; r < m.size; r++) {
    let c = 0;
    while (c < m.size) {
      if (!m.dark[r][c]) { c++; continue; }
      let len = 1;
      while (c + len < m.size && m.dark[r][c + len]) len++;
      d += `M${c} ${r}h${len}v1h-${len}z`;
      c += len;
    }
  }
  return d;
}
