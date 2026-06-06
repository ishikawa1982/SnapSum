// Anthropic Messages API をブラウザから直接呼び出して、レシート画像の合計を読み取る。
//
// 公式 SDK はサーバー専用コード（node:child_process 等）を含み、静的ブラウザビルドに
// 載らないため、ここでは fetch で直接呼ぶ。ブラウザからの直接呼び出しには
// `anthropic-dangerous-direct-browser-access: true` ヘッダが必要。

const API_URL = 'https://api.anthropic.com/v1/messages';

export interface AiReceiptResult {
  total: number | null; // 合計金額（円）。判別できなければ null
  items: number[]; // 明細など、その他に読み取れた金額
}

export class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiError';
  }
}

const PROMPT = `この画像は日本のレシート（または領収書・値札）です。お客様が実際に支払った「合計金額」を1つだけ特定してください。

ルール:
- 「合計」「お会計」「ご請求額」「お支払い」に当たる金額を合計とする。
- 「小計」「お預かり」「おつり」「ポイント」「税額のみの行」は合計ではない。
- 金額は円単位の整数（カンマや¥は除く）。
- 画像内に写っている他の金額も items に列挙する。

必ず次の形式のJSONだけを返してください（前後に説明文を付けない）:
{"total": <合計の整数 or null>, "items": [<その他の金額の整数>, ...]}

合計が判別できない場合は total を null にする。`;

export async function extractReceiptTotal(
  blob: Blob,
  opts: { apiKey: string; model: string },
): Promise<AiReceiptResult> {
  const data = await blobToBase64(blob);
  const mediaType = blob.type === 'image/png' ? 'image/png' : 'image/jpeg';

  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': opts.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data },
              },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      }),
    });
  } catch {
    throw new AiError('通信に失敗しました。ネットワークを確認してください。');
  }

  if (!res.ok) {
    throw new AiError(await errorMessage(res));
  }

  const json = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = (json.content ?? [])
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text as string)
    .join('\n');

  return parseResult(text);
}

async function errorMessage(res: Response): Promise<string> {
  let detail = '';
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    detail = body.error?.message ?? '';
  } catch {
    // ignore
  }
  switch (res.status) {
    case 401:
      return 'APIキーが無効です。設定を確認してください。';
    case 403:
      return 'このAPIキーではアクセスできません（権限・モデルを確認）。';
    case 404:
      return 'モデルが見つかりません。設定のモデルを確認してください。';
    case 429:
      return 'リクエストが多すぎます。少し待って再試行してください。';
    case 413:
      return '画像が大きすぎます。';
    default:
      return `AI呼び出しエラー (${res.status})${detail ? `: ${detail}` : ''}`;
  }
}

function parseResult(text: string): AiReceiptResult {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { total: null, items: [] };
  try {
    const obj = JSON.parse(match[0]) as { total?: unknown; items?: unknown };
    const total =
      typeof obj.total === 'number' && Number.isFinite(obj.total)
        ? Math.round(obj.total)
        : null;
    const items = Array.isArray(obj.items)
      ? obj.items
          .map((v) => (typeof v === 'number' ? Math.round(v) : NaN))
          .filter((v) => Number.isFinite(v))
      : [];
    return { total, items };
  } catch {
    return { total: null, items: [] };
  }
}

export function aiErrorMessage(err: unknown): string {
  if (err instanceof AiError) return err.message;
  return '通信に失敗しました。ネットワークを確認してください。';
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(binary);
}
