/** 文中の {変数} を埋める。値が無い変数はそのまま残す（テストで検出する） */
export function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
}
