// E2E용 목 서버: dist/ 정적 서빙 + config.json + Supabase RPC 흉내(save/get/delete).
// 실제 DB 대신 메모리에 저장하며, schema.sql 의 입력 검증(토큰 형식·6문항·유형 코드)을 같은 방식으로 적용한다.
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.txt': 'text/plain' };

export function startMock({ distDir, port = 0, config = {} }) {
  const db = new Map(); // hash → {payload, expires_at}
  const state = { mode: 'ok', saves: 0, failedSaves: 0, lastToken: null };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }

    if (url.pathname === '/__mock/mode') { state.mode = url.searchParams.get('m') ?? 'ok'; res.writeHead(200, cors); return res.end('ok'); }
    if (url.pathname === '/__mock/state') { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ...state, rows: db.size })); }

    if (url.pathname === '/config.js') {
      res.writeHead(200, { ...cors, 'Content-Type': 'text/javascript' });
      return res.end('window.__ANSIM_CONFIG__ = ' + JSON.stringify(config) + ';');
    }

    const rpc = /^\/rest\/v1\/rpc\/(\w+)$/.exec(url.pathname);
    if (rpc && req.method === 'POST') {
      let body = '';
      for await (const c of req) body += c;
      const args = JSON.parse(body || '{}');
      const json = (code, obj) => { res.writeHead(code, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
      const tokenOk = (t) => typeof t === 'string' && /^[A-Za-z0-9_-]{32}$/.test(t);
      const h = (t) => createHash('sha256').update(t).digest('hex');
      if (req.headers['apikey'] !== 'test-anon-key') return json(401, { message: 'bad key' });
      if (rpc[1] === 'save_branch_result') {
        if (state.mode === 'fail') { state.failedSaves++; return json(500, { message: 'simulated outage' }); }
        if (state.mode === 'slow') await new Promise((r) => setTimeout(r, 1500));
        const p = args.p_payload;
        if (!tokenOk(args.p_token) || !p || p.schema !== 1 || p.session?.records?.length !== 6 || !['A', 'B', 'C', 'D'].includes(p.analysis?.type)) {
          return json(400, { message: 'invalid payload' });
        }
        if (!db.has(h(args.p_token))) db.set(h(args.p_token), { payload: p, expires_at: new Date(Date.now() + 90 * 864e5).toISOString() });
        state.saves++; state.lastToken = args.p_token;
        return json(200, true);
      }
      if (rpc[1] === 'get_branch_result') {
        const row = tokenOk(args.p_token) ? db.get(h(args.p_token)) : null;
        return json(200, row ?? null);
      }
      if (rpc[1] === 'delete_branch_result') {
        return json(200, tokenOk(args.p_token) ? db.delete(h(args.p_token)) : false);
      }
      return json(404, { message: 'no such function' });
    }

    // 정적 파일
    let p = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
    if (p.endsWith('/')) p += 'index.html';
    const file = join(distDir, p);
    try {
      if (!(await stat(file)).isFile()) throw new Error('nf');
      res.writeHead(200, { ...cors, 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404, cors); res.end('not found');
    }
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port, state, db }));
  });
}
