// esbuild 기반 빌드/개발 서버. (Vite 없이 동작 — npm 레지스트리가 막힌 환경에서도 esbuild+react만 있으면 됨)
//   node scripts/build.mjs            → dist/ 생성 (프로덕션, 압축)
//   node scripts/build.mjs --serve    → 개발 서버(http://localhost:5173, 변경 시 자동 재빌드)
import { createRequire } from 'node:module';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

// esbuild/react 는 프로젝트 node_modules 를 우선하고, 없으면 NODE_PATH·전역 설치 위치에서 찾는다.
const nodePaths = (process.env.NODE_PATH ?? '').split(':').filter(Boolean);
for (const g of ['/home/claude/.npm-global/lib/node_modules', '/opt/node22/lib/node_modules', '/opt/npm-tools/node_modules']) {
  if (existsSync(g)) nodePaths.push(g);
}
const { build, context } = require(require.resolve('esbuild', { paths: [root, ...nodePaths] }));
const serve = process.argv.includes('--serve');
const out = join(root, 'dist');

// .env 읽기 (.env → .env.local → 실제 환경변수 순으로 덮어씀)
function parseEnv(file) {
  if (!existsSync(file)) return {};
  const o = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(VITE_[A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return o;
}
const envFiles = { ...parseEnv(join(root, '.env')), ...parseEnv(join(root, '.env.local')) };
const KEYS = [
  'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_PUBLIC_BASE_URL',
  'VITE_OPERATOR_PIN', 'VITE_LEGACY_TEST_URL', 'VITE_IDLE_RESET_SECONDS', 'VITE_RESULT_URL_MODE',
];
const define = { 'import.meta.env.DEV': serve ? 'true' : 'false' };
for (const k of KEYS) define[`import.meta.env.${k}`] = JSON.stringify(process.env[k] ?? envFiles[k] ?? '');

const options = {
  entryPoints: { app: join(root, 'src/main.tsx') },
  outdir: out,
  bundle: true,
  format: 'iife', // file:// 로 index.html을 바로 열어도 동작하도록 module 이 아닌 일반 스크립트로 번들
  target: 'es2020',
  jsx: 'automatic',
  minify: !serve,
  sourcemap: serve ? 'inline' : false,
  define,
  nodePaths,
  external: ['*.woff2', '*.png'], // 폰트·로고는 public/ 에 두고 런타임에 상대경로로 읽음
  logLevel: 'info',
  legalComments: 'none',
};

function copyStatic() {
  mkdirSync(out, { recursive: true });
  cpSync(join(root, 'index.html'), join(out, 'index.html'));
  if (existsSync(join(root, 'public'))) cpSync(join(root, 'public'), out, { recursive: true });
}

if (!serve) {
  rmSync(out, { recursive: true, force: true });
  await build(options);
  copyStatic();
  // 폰트는 public/fonts 에 두면 그대로 복사되며, CSS의 상대 경로(./fonts/…)로 참조된다.
  writeFileSync(join(out, 'BUILD_INFO.txt'), `built ${new Date().toISOString()}\n`);
  console.log('dist/ 생성 완료');
} else {
  rmSync(out, { recursive: true, force: true });
  const ctx = await context(options);
  copyStatic();
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: out, port: 5173 });
  console.log(`개발 서버: http://localhost:${port}`);
}
