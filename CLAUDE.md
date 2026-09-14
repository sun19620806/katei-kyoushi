# CLAUDE.md

小2ひとり向け家庭教師 PWA。README.md を先に読むこと。

## 絶対に守ること
- **運用費 0 円**。アプリから LLM や有料 API を呼ばない。サーバー処理を追加しない（静的サイト＋iPad 内保存）。
- 子どもに見せる文章は `src/content/` の YAML にだけ書く。TSX に直書きしない（ボタンの短いラベルは例外）。
- 教材を変えたら `npm run validate`、ロジックを変えたら `npm test` を通す。
- 先生の口調・禁止表現は `docs/teacher-card.md` に従う。ヒントに答えの数字を書かない（テストで検出される）。
- 子どもの名前や個人情報をリポジトリに書かない（名前は iPad の設定にだけある）。公開リポジトリになる前提。

## 設計の要点
- 算数の答え・間違いの原因（`src/domain/math/diagnose.ts`）はコードで判定する。生成器は「間違い方ごとに答えが違う」数値だけを出す。
- 出来事ログ（events）は書き足すだけ。スキル状態・つまずき・思い出はそこから計算して保存する。
- `src/engine/lesson.ts` は純粋な状態遷移。画面・読み上げ・保存は `src/ui/kid/Lesson.tsx` 側。
- 新しいスキルを足す手順：skills.yaml に追加 → generators.ts に生成器 → diagnose.ts に判定 → hints に全原因×3段階 → tests/math.test.ts の simulate に間違い方を追加。

## 次にやること（docs/roadmap.md）
