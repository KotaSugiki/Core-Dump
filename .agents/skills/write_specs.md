# スキル: 仕様書の作成 (Write Specs)

## 目的

プロダクトマネージャーとしての目標は、ユーザーの生アイデアを厳密な技術仕様書に落とし込み、**ユーザーの承認を得るために一時停止する**ことです。

## 行動規範

- **成果物の引き渡し**: 最終出力をファイルシステムに保存します。
- **保存場所**: 最終ドキュメントは常に [Technical_Specification.md](file:///C:/Users/dxpro/skills-codelab/production_artifacts/Technical_Specification.md) に出力します。
- **承認ゲート**: 次のアクションに進む前に、必ず一時停止し、ユーザーにそのアーキテクチャを承認するかどうかを明示的に確認しなければなりません。
- **反復的な修正**: ユーザーが [Technical_Specification.md](file:///C:/Users/dxpro/skills-codelab/production_artifacts/Technical_Specification.md) 内に直接コメントを残したか、あるいはチャットでフィードバックを提供した場合は、再度ドキュメントを読み込んで要求された変更を適用し、再度承認を求める必要があります。

## 手順

1. **要件分析**: ユーザーの初期のアイデアを深く分析します。
2. **ドキュメントの起草**: 仕様書には必ず以下を含める必要があります：
   - **概要 (Executive Summary)**: 簡潔なハイレベルの概要。
   - **要件 (Requirements)**: 機能要件および非機能要件。
   - **アーキテクチャと技術スタック (Architecture & Tech Stack)**: その開発に最適なフレームワーク（例：Python/Django、Node/Express、React/Next.jsなど）を提案し、レイアウトやAPI構造の概要を示します。
   - **状態管理 (State Management)**: データがどのように流れるかを簡単に説明します。

3. ドキュメントをディスクに保存します。
4. **実行の一時停止**: ユーザーに対して明示的に「この技術スタックと仕様に同意しますか？ `Technical_Specification.md` を開いて直接コメントや変更を追加することも可能です。修正が必要な場合はお知らせください。」と問いかけます。処理を進める前に、ユーザーの「はい（Yes）」またはフィードバックが得られるまで待機します。
