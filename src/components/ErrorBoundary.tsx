import { Component, type ErrorInfo, type ReactNode } from 'react';
import { VERSION_TEXT } from '../lib/version';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

// 描画中の例外を白画面にせず、画面にエラー内容を出す。
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 開発時にコンソールにも残す
    console.error('SnapSum render error:', error, info);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="p-4 font-mono text-sm text-red-700">
          <p className="font-bold">表示エラーが発生しました（{VERSION_TEXT}）</p>
          <pre className="mt-2 whitespace-pre-wrap break-words text-xs">
            {this.state.error.message}
            {'\n'}
            {this.state.error.stack}
          </pre>
          <button
            type="button"
            onClick={() => location.reload()}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-white"
          >
            再読み込み
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
