import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadRuntimeConfig } from './config/env';
import './styles.css';

// 런타임 설정(config.json)을 읽은 뒤 화면을 그린다. 실패해도 빌드 시점 기본값으로 계속 진행.
loadRuntimeConfig().finally(() => {
  createRoot(document.getElementById('root')!).render(<App />);
});
