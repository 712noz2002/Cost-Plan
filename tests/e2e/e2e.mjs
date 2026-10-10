// 브라우저 E2E (Playwright + 헤드리스 Chromium). 사용: node tests/e2e/e2e.mjs [스크린샷 출력 폴더]
//  - dist/ 를 목 서버로 띄우고 config.json 을 주입해서 실제 앱 흐름을 끝까지 실행한다.
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { startMock } from './mock-server.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const pwPath = require.resolve('playwright', { paths: ['/home/claude/.npm-global/lib/node_modules', '/opt/npm-tools/node_modules', root] });
const { chromium } = require(pwPath);
const sharp = (() => { try { return require(require.resolve('sharp', { paths: ['/home/claude/.npm-global/lib/node_modules', root] })); } catch { return null; } })();

const shots = resolve(process.argv[2] ?? join(root, 'tests/e2e/shots'));
mkdirSync(shots, { recursive: true });

// dist 복사본에 테스트용 레거시 HTML 한 장을 추가 (원본 dist/public 은 건드리지 않음)
const dist = mkdtempSync(join(tmpdir(), 'ansim-dist-'));
cpSync(join(root, 'dist'), dist, { recursive: true });
mkdirSync(join(dist, 'assets', 'characters'), { recursive: true });
const FIX = { A: 'character_A_green_checklist.png', B: 'character_B_blue_question.png', C: 'character_C_orange_magnifier.png', D: 'character_D_yellow_share.png' };
const FIXCOLOR = { A: '#2e9e4f', B: '#2f6df0', C: '#f0932f', D: '#f2d02f' };
if (sharp) for (const k of Object.keys(FIX)) await sharp({ create: { width: 600, height: 800, channels: 3, background: FIXCOLOR[k] } }).png().toFile(join(dist, 'assets', 'characters', FIX[k]));
writeFileSync(join(dist, 'legacy', 'ansim-on.html'), '<!doctype html><title>legacy</title><h1 id="legacy">기존 카드 소거형 테스트(테스트용 대역)</h1>');

const PORT = Number(process.env.E2E_PORT || 4791);
const cfg = { supabaseUrl: `http://127.0.0.1:${PORT}`, supabaseAnonKey: 'test-anon-key', publicBaseUrl: 'https://ansim.example.test', operatorPin: '1234', idleResetSeconds: 150, legacyUrl: './legacy/ansim-on.html' };
const M = await startMock({ distDir: dist, config: cfg, port: PORT });
const URL0 = `http://127.0.0.1:${M.port}/`;

const results = [];
const ok = (name) => { results.push(name); console.log('  ✓', name); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] }).catch(async () => chromium.launch({ args: ['--no-sandbox'] }));
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, hasTouch: true, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
async function fetchMode(m) { await (await fetch(`http://127.0.0.1:${M.port}/__mock/mode?m=${m}`)).text(); }
async function mockState() { return await (await fetch(`http://127.0.0.1:${M.port}/__mock/state`)).json(); }

{
  const fp = await ctx.newPage();
  await fp.goto('file://' + join(dist, 'index.html'));
  await fp.waitForSelector('text=테스트 시작하기', { timeout: 10000 });
  await fp.close();
  ok('index.html 을 file:// 로 직접 열어도 인트로 표시');
}

await page.goto(URL0);
await page.waitForSelector('text=테스트 시작하기');
await page.screenshot({ path: join(shots, '01-s00-landscape.png') });
const s00 = await page.locator('.kiosk').innerText();
assert.ok(s00.includes('끝까지 남기는 것은') && s00.includes('여섯 번의 선택으로 알아보는 나의 확인 방식'));
assert.ok(!/요양|병원|입소|면회/.test(s00));
await page.click('text=테스트 시작하기');
await page.waitForSelector('text=당신의 답은 다음 질문을 바꿉니다');
await page.screenshot({ path: join(shots, '02-s01-landscape.png') });
ok('S00 → S01 안내 (요양병원·입소·면회 언급 없음)');
await page.click('button:has-text("시작하기")');

const NEXT = '이 선택으로 계속하기';
async function answer(step, pickIndex, { shot = '' } = {}) {
  await page.waitForFunction((s) => document.querySelector('.kq-indicator')?.getAttribute('aria-label')?.replace(/\s/g, '') === `${s}/6`, step);
  await page.waitForSelector('.kq-prompt');
  const ind = (await page.locator('.kq-indicator').getAttribute('aria-label')).replace(/\s/g, '');
  assert.equal(ind, `${step}/6`);
  assert.equal(await page.locator('.kq-opt').count(), 0, '[선택지 보기] 전에 선택지가 보임');
  assert.equal(await page.locator(`text=${NEXT}`).count(), 0);
  if (shot) await page.screenshot({ path: join(shots, `${shot}-read.png`) });
  await page.click('text=선택지 보기');
  const opts = page.locator('.kq-opt');
  await opts.first().waitFor();
  const n = await opts.count();
  // 동등한 크기, 터치 영역 56px 이상, 선택 전에는 계속하기 비활성
  const boxes = [];
  for (let i = 0; i < n; i++) boxes.push(await opts.nth(i).boundingBox());
  for (const b of boxes) assert.ok(b.height >= 56 && b.width >= 56, `선택지 터치 영역 ${b.width}x${b.height}`);
  assert.ok(Math.max(...boxes.map((b) => b.width)) - Math.min(...boxes.map((b) => b.width)) < 3, '선택지 폭이 서로 다름');
  assert.equal(await page.locator(`button:has-text("${NEXT}")`).isDisabled(), true);
  const text = (await opts.nth(pickIndex).innerText()).replace('이전 선택', '').trim();
  await opts.nth(pickIndex).click();
  if (shot) await page.screenshot({ path: join(shots, `${shot}-chosen.png`) });
  const cb = await page.locator(`button:has-text("${NEXT}")`).boundingBox();
  assert.ok(cb.height >= 56 && cb.width >= 56, '확정 버튼 터치 영역');
  await page.click(`button:has-text("${NEXT}")`);
  return text;
}
const promptNow = async () => (await page.locator('.kq-prompt').innerText()).trim();

await answer(1, 2, { shot: '03-q1' });  // 3번째 → A → Q2_A
await page.waitForFunction(() => document.querySelector('.kq-indicator')?.getAttribute('aria-label')?.startsWith('2'));
assert.equal(await promptNow(), '어떤 소식을 더 들으면 가장 마음이 놓일까요?', 'Q1 A → Q2_A');
const ctxLine = await page.locator('.kq-context').innerText();
assert.ok(ctxLine.includes('준비하기로 한 일들이 실제로 어떻게 진행됐을까?') && !/undefined/.test(ctxLine));
ok('Q1 A → Q2_A 분기 + 이전 답변을 인용한 연결 문장');

await answer(2, 0, { shot: '04-q2' }); // B
await page.waitForFunction(() => document.querySelector('.kq-indicator')?.getAttribute('aria-label')?.startsWith('3'));

// 이전으로 돌아가 Q2 수정
await page.click('button:has-text("← 이전")');
await page.waitForSelector('.kq-prompt');
assert.equal((await page.locator('.kq-indicator').getAttribute('aria-label')).replace(/\s/g, ''), '2/6');
await page.click('text=선택지 보기');
assert.equal(await page.locator('.was-tag').count(), 1);
await page.locator('.kq-opt').nth(1).click(); // A로 변경
await page.click(`button:has-text("${NEXT}")`);
await page.waitForFunction(() => document.querySelector('.kq-indicator')?.getAttribute('aria-label')?.startsWith('3'));
ok('이전 장면으로 돌아가 응답 수정 → 다음 장면 재진행');

await answer(3, 3, { shot: '05-q3' }); // D → Q4_D
await page.waitForFunction(() => document.querySelector('.kq-indicator')?.getAttribute('aria-label')?.startsWith('4'));
assert.equal(await promptNow(), '그 의사를 존중하면서 어떤 것을 먼저 확인하고 싶나요?');
ok('Q3 D → Q4_D 분기');
await answer(4, 1, { shot: '06-q4' });
await answer(5, 0, { shot: '07-q5' });
await page.waitForFunction(() => document.querySelector('.kq-indicator')?.getAttribute('aria-label')?.startsWith('6'));
await page.screenshot({ path: join(shots, '08-q6-read.png') });
await page.click('text=선택지 보기');
await page.locator('.kq-opt').nth(0).click();
await page.waitForTimeout(150);
await page.locator('.kq-opt').nth(0).click(); // 같은 항목 재탭: 수정 아님
await page.locator('.kq-opt').nth(1).click(); // 변경 1회
await page.screenshot({ path: join(shots, '09-q6-chosen.png') });

await fetchMode('fail');
await page.click(`button:has-text("${NEXT}")`);
await page.waitForSelector('text=RESULT 01');
await page.screenshot({ path: join(shots, '10-r01.png') });
const r1 = await page.locator('.kiosk').innerText();
assert.ok(!/TYPE [A-D]/.test(r1) && (await page.locator('img').count()) <= 1, 'R01에서 유형/캐릭터 노출');
assert.ok(/선택을 1회 바꿈/.test(r1), '수정 1회 표시: ' + r1);
ok('R01: 유형·캐릭터 미공개, Q6 수정 1회(같은 항목 재탭은 제외)');

await page.click('button:has-text("다음")');
await page.waitForSelector('text=RESULT 02');
await page.screenshot({ path: join(shots, '11-r02.png') });
const r2 = await page.locator('.kiosk').innerText();
assert.ok(!/TYPE [A-D]/.test(r2) && r2.includes('어떤 보호자의 확인 방식과 닮아 있을까요?'));
await page.click('text=나의 보호자 유형 확인하기');
// 연타해도 한 번만 이동
await page.click('text=나의 보호자 유형 확인하기', { force: true, timeout: 500 }).catch(() => {});
await page.waitForSelector('text=RESULT 03');
await page.waitForSelector('.char img');
await page.screenshot({ path: join(shots, '12-r03-landscape.png') });
const typeLabel = (await page.locator('.type-badge').innerText()).trim();
const letter = typeLabel.slice(-1);
const src = await page.locator('.char img').getAttribute('src');
assert.ok(src.includes(FIX[letter]), `캐릭터 불일치 ${typeLabel} ${src}`);
const nat = await page.locator('.char img').evaluate((im) => [im.naturalWidth, im.naturalHeight, im.getBoundingClientRect().width, im.getBoundingClientRect().height]);
assert.ok(nat[0] === 600 && nat[1] === 800, '원본 이미지 로드');
assert.ok(Math.abs(nat[2] / nat[3] - 600 / 800) < 0.02, '캐릭터 비율이 변형됨');
ok(`R03: ${typeLabel} + 해당 캐릭터 원본 비율 그대로`);

await page.click('text=결과 가져가기');
await page.waitForSelector('text=RESULT 04');
await page.waitForSelector('text=QR을 만들지 못했어요');
assert.equal(await page.locator('.qr-box svg').count(), 0, '저장 실패인데 QR이 표시됨');
await page.screenshot({ path: join(shots, '13-r04-fail.png') });
let st = await mockState();
assert.equal(st.rows, 0);
ok('서버 저장 실패 → 가짜 QR 없음, 오류 + 재시도 표시');

const active = await page.locator('.locker.on b').innerText();
assert.equal(active, { A: '01', B: '02', C: '03', D: '04' }[letter]);
assert.equal(await page.locator('.locker.on').count(), 1);
ok(`보관함 ${active}번 하나만 강조 (TYPE ${letter})`);

await fetchMode('ok');
await page.click('text=다시 시도');
await page.waitForSelector('.qr-box svg');
st = await mockState();
assert.equal(st.rows, 1);
const token = st.lastToken;
assert.match(token, /^[A-Za-z0-9_-]{32}$/);
const qrBox = await page.locator('.qr-box svg').boundingBox();
assert.ok(qrBox.width >= 240, 'QR 크기 240 CSS px 이상: ' + qrBox.width);
await page.screenshot({ path: join(shots, '14-r04-qr.png') });
ok('재시도 성공 후에만 QR 표시(≥240px), 서버에 1건 저장');

const saved = await page.evaluate(async ({ url, token }) => (await (await fetch(url + '/rest/v1/rpc/get_branch_result', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: 'test-anon-key' }, body: JSON.stringify({ p_token: token }) })).json()), { url: `http://127.0.0.1:${M.port}`, token });
assert.equal(saved.payload.analysis.exposedQuestionIds.length, 6);
const tm = saved.payload.session.records[5].timing;
assert.equal(tm.revisionCount, 1);
assert.equal(tm.ignoredRepeatTaps, 1);
assert.equal(tm.firstTapDurationMs + tm.postFirstDurationMs, tm.decisionDurationMs);
assert.equal(tm.tapHistory.length, 2);
ok('저장된 payload: 6개 노출 질문 + 새 시간 필드(revisionCount 1, 같은 항목 재탭 1회 무시)');

// ── 체험 마치기 → 대기 화면, 이전 결과는 서버에 유지
await page.click('button:has-text("체험 마치기")');
await page.waitForSelector('text=테스트 시작하기');
st = await mockState();
assert.equal(st.rows, 1);
assert.equal(await page.locator('text=' + typeLabel).count(), 0);
ok('체험 마치기 → 화면 초기화(이전 참여자 흔적 없음), 서버 결과 유지');

// ── 모바일 결과
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, acceptDownloads: true });
const mp = await mctx.newPage();
const merr = [];
mp.on('pageerror', (e) => merr.push(String(e)));
await mp.goto(`http://127.0.0.1:${M.port}/#/r/${token}`);
await mp.waitForSelector('.m-head');
await mp.waitForSelector('.m-head .char img');
await mp.screenshot({ path: join(shots, '15-mobile-top.png') });
await mp.screenshot({ path: join(shots, '16-mobile-full.png'), fullPage: true });
const mtext = await mp.locator('.m-root').innerText();
for (const must of ['처음 마음에 걸린 것과 마음이 놓이는 정보', '먼저 하려던 행동과 마음이 놓이는 조건', '세 상황을 지나 마지막에 먼저 확인한 것', '선택의 흔적', '나에게 안심이란', '결과 이미지 저장하기', '공유하기']) assert.ok(mtext.includes(must), '모바일에 없음: ' + must);
assert.ok(!/평균|빠르|느리|undefined|NaN/.test(mtext));
assert.ok(await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), '모바일 가로 스크롤 발생');
assert.equal(await mp.locator('.m-head .char img').getAttribute('src'), './assets/characters/' + FIX[letter]);
ok('모바일 상세: 9개 구성 표시, 해당 캐릭터, 가로 스크롤 없음');

await mp.fill('.m-reflect textarea', '보이지 않는 시간이 궁금했어요');
const [dl] = await Promise.all([mp.waitForEvent('download', { timeout: 15000 }), mp.click('text=결과 이미지 저장하기')]);
const pngPath = join(shots, '17-result-image.png');
await dl.saveAs(pngPath);
if (sharp) {
  const meta = await sharp(pngPath).metadata();
  assert.equal(meta.width, 1080); assert.equal(meta.height, 1920);
  // 캐릭터 대역 색이 PNG 중앙부에 실제로 그려졌는지(유형에 맞는 색)
  const { data, info } = await sharp(pngPath).extract({ left: 480, top: 700, width: 120, height: 120 }).raw().toBuffer({ resolveWithObject: true });
  const avg = [0, 1, 2].map((c) => { let s = 0; for (let i = c; i < data.length; i += info.channels) s += data[i]; return s / (data.length / info.channels); });
  const want = FIXCOLOR[letter].match(/\w\w/g).map((h) => parseInt(h, 16));
  assert.ok(avg.every((v, i) => Math.abs(v - want[i]) < 24), `PNG 캐릭터 색 불일치 ${avg} vs ${want}`);
  ok(`결과 PNG 1080×1920 + TYPE ${letter} 캐릭터가 이미지에 포함`);
} else ok('결과 PNG 생성(크기 검사 생략: sharp 없음)');

const ictx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
const ip = await ictx.newPage();
await ip.goto(`http://127.0.0.1:${M.port}/#/r/${token}`);
await ip.waitForSelector('.m-head');
await ip.click('text=결과 이미지 저장하기');
await ip.waitForSelector('.m-img-modal img', { timeout: 15000 });
ok('iOS Safari 환경: 공유 불가 시 길게 눌러 저장 미리보기 표시');
await ictx.close();

// 경로형 URL(/results/<토큰>)도 같은 결과를 연다 (호스팅 리라이트가 있을 때)
{
  const pp = await mctx.newPage();
  await pp.route('**/results/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: require('node:fs').readFileSync(join(dist, 'index.html'), 'utf8') }));
  await pp.goto(`http://127.0.0.1:${M.port}/results/${token}`);
  await pp.waitForSelector('.m-head', { timeout: 10000 });
  await pp.close();
  ok('/results/<토큰> 경로형 URL도 결과 표시(<base> 보정)');
}

await mp.goto(`http://127.0.0.1:${M.port}/#/r/${'x'.repeat(32)}`);
await mp.reload();
await mp.waitForSelector('text=결과를 찾을 수 없어요');
ok('없는 토큰 → 안내 화면');

await mp.goto(`http://127.0.0.1:${M.port}/#/r/${token}`);
await mp.reload();
await mp.waitForSelector('.m-head');
mp.once('dialog', (d) => d.accept());
await mp.click('text=이 결과 지금 삭제하기');
await mp.waitForSelector('text=결과를 삭제했어요');
st = await mockState();
assert.equal(st.rows, 0);
ok('모바일에서 결과 삭제 → 서버에서 제거');
assert.deepEqual(merr, [], '모바일 콘솔 오류');

// ── 반응형: 여러 뷰포트에서 질문·결과 화면이 스크롤 없이 한 화면에 들어오는지
await fetchMode('ok');
async function fitCheck(w, h, label) {
  const c = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true });
  const p = await c.newPage();
  await p.goto(URL0);
  await p.click('text=테스트 시작하기'); await p.click('button:has-text("시작하기")');
  const check = async (name) => {
    await p.waitForTimeout(650);
    const r = await p.evaluate(() => {
      const root = document.querySelector('.kiosk > *');
      const bottom = [...document.querySelectorAll('.kq-bottom, .rs-foot, .ki-foot')].pop();
      const bb = bottom ? bottom.getBoundingClientRect() : null;
      return { over: root.scrollHeight - root.clientHeight, bottomOk: bb ? bb.bottom <= window.innerHeight + 1 : true, mainOver: (document.querySelector('.kq-main, .rs-main')?.scrollHeight ?? 0) - (document.querySelector('.kq-main, .rs-main')?.clientHeight ?? 0) };
    });
    assert.ok(r.over <= 1 && r.bottomOk && r.mainOver <= 1, `${label} ${name} 넘침 ${JSON.stringify(r)}`);
  };
  // 가장 긴 선택지를 가진 질문(Q4_*, Q5)을 포함해 모든 장면을 마지막 선택지로 진행
  for (let step = 1; step <= 6; step++) {
    await p.waitForSelector('.kq-prompt');
    await check(`Q${step}-read`);
    await p.click('text=선택지 보기');
    await p.locator('.kq-opt').last().waitFor();
    await p.waitForTimeout(500);
    await check(`Q${step}-opts`);
    if (step === 3 || step === 6) await p.screenshot({ path: join(shots, `20-${label}-q${step}.png`) });
    await p.locator('.kq-opt').last().click();
    await p.click(`button:has-text("${NEXT}")`);
  }
  for (let r = 1; r <= 3; r++) {
    await p.waitForSelector(`text=RESULT 0${r}`);
    await p.waitForTimeout(600);
    await check(`R0${r}`);
    if (r === 3) break;
    await p.screenshot({ path: join(shots, `21-${label}-r0${r}.png`) });
    await p.click(r === 1 ? 'button:has-text("다음")' : 'text=나의 보호자 유형 확인하기');
  }
  await p.waitForSelector('text=RESULT 03');
  await p.waitForSelector('.char img');
  await p.waitForTimeout(900);
  await check('R03');
  await p.screenshot({ path: join(shots, `22-${label}-r03.png`) });
  await p.click('text=결과 가져가기');
  await p.waitForSelector('.qr-box svg');
  await p.waitForTimeout(500);
  await check('R04');
  await p.screenshot({ path: join(shots, `23-${label}-r04.png`) });
  await c.close();
}
await fitCheck(1920, 1080, 'land-1920x1080');
await fitCheck(1080, 1920, 'port-1080x1920');
await fitCheck(1366, 768, 'land-1366x768');
await fitCheck(1024, 768, 'land-1024x768');
ok('1920×1080 · 1080×1920 · 1366×768 · 1024×768 에서 6장면+결과 4장면이 스크롤 없이 한 화면에 표시');

// ── 유휴 경고: 갑자기 처음으로 돌아가지 않고 경고 후에 초기화
{
  const c = await browser.newContext({ viewport: { width: 1920, height: 1080 }, hasTouch: true });
  await c.addInitScript(() => { try { localStorage.setItem('ansimon.operator.settings.v1', JSON.stringify({ mode: 'branch', idleResetSeconds: 30 })); } catch {} });
  const p = await c.newPage();
  await p.goto(URL0);
  const key = await p.evaluate(() => Object.keys(localStorage));
  await p.click('text=테스트 시작하기'); await p.click('button:has-text("시작하기")');
  await p.waitForSelector('.kq-prompt');
  await p.waitForSelector('.idle-modal', { timeout: 20000 });
  await p.screenshot({ path: join(shots, '24-idle-warning.png') });
  assert.ok((await p.locator('.idle-modal').innerText()).includes('계속 진행하시겠어요?'));
  await p.click('text=계속하기');
  await p.waitForTimeout(1500);
  assert.equal(await p.locator('.idle-modal').count(), 0);
  assert.ok(await p.locator('.kq-prompt').count() === 1, '경고 후 계속하기를 눌렀는데 초기화됨');
  await p.waitForSelector('.idle-modal', { timeout: 25000 });
  await p.waitForSelector('text=테스트 시작하기', { timeout: 25000 });
  await c.close();
  ok('자동 초기화 전 경고창 표시 → [계속하기]로 유지, 방치하면 대기 화면으로 초기화');
}

// ── 운영자 패널: 모드 전환
await page.bringToFront();
for (let i = 0; i < 5; i++) await page.mouse.click(30, 30);
await page.waitForSelector('text=운영자 확인');
for (const d of '9999') await page.click(`.pin-pad button:text-is("${d}")`);
await page.waitForSelector('text=PIN이 맞지 않아요');
for (const d of '1234') await page.click(`.pin-pad button:text-is("${d}")`);
await page.waitForSelector('text=운영자 설정');
await page.click('text=서버 연결 점검');
await page.waitForSelector('text=서버 연결 정상');
await page.click('text=카드 소거형 테스트 (기존)');
await page.click('button:has-text("닫기")');
await page.waitForSelector('iframe.legacy-frame');
await page.frameLocator('iframe.legacy-frame').locator('#legacy').waitFor();
ok('운영자 PIN → 카드 소거형으로 전환, 기존 HTML을 iframe으로 표시');
for (let i = 0; i < 5; i++) await page.mouse.click(30, 30);
for (const d of '1234') await page.click(`.pin-pad button:text-is("${d}")`);
await page.click('text=분기형 테스트 (6문항)');
await page.click('button:has-text("닫기")');
await page.waitForSelector('text=테스트 시작하기');
ok('분기형으로 되돌리기');

assert.deepEqual(errors.filter((e) => !/Failed to load resource.*(404|500)/.test(e) && !/logo\.png|Pretendard/.test(e)), [], '콘솔 오류');
ok('콘솔 오류 없음');

await browser.close();
M.server.close();
console.log(`\nE2E 통과: ${results.length}개 확인`);
