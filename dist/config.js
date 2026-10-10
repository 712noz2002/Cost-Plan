// 배포 설정. 빌드 없이 이 파일만 고치면 됩니다. (브라우저에 그대로 노출되므로 Supabase anon 키만 넣으세요)
window.__ANSIM_CONFIG__ = {
  supabaseUrl: "",        // 예: https://xxxx.supabase.co
  supabaseAnonKey: "",    // anon(공개) 키. service_role 키 금지
  publicBaseUrl: "",      // QR에 들어갈 HTTPS 주소 (끝 / 없이)
  operatorPin: "",        // 운영자 패널 PIN(실수 방지용)
  legacyUrl: "./legacy/ansim-on.html",
  resultUrlMode: "hash", // "hash" = 어느 호스팅이든 동작 / "path" = /results/토큰 (호스팅에 SPA 리라이트 필요)
  idleResetSeconds: 150
};
