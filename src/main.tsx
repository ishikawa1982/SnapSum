import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const rootEl = document.getElementById('root')!;

try {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
  // 描画に成功したら、index.html のエラーハンドラが上書きしないよう印を付ける
  rootEl.setAttribute('data-loaded', '1');
} catch (err) {
  rootEl.innerHTML =
    '<div style="padding:16px;font:13px/1.5 monospace;color:#b91c1c"><b>起動エラー: render</b><pre style="white-space:pre-wrap">' +
    String((err as Error)?.stack || err) +
    '</pre></div>';
}
