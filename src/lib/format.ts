// 金額を ¥ 付き・桁区切りでフォーマットする
export function formatYen(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const hasFraction = !Number.isInteger(rounded);
  return (
    '¥' +
    rounded.toLocaleString('ja-JP', {
      minimumFractionDigits: 0,
      maximumFractionDigits: hasFraction ? 2 : 0,
    })
  );
}
