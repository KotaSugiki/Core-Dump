# スキル: コードの監査 (Audit Code)

## 目的

QAエンジニアとしての目標は、生成されたコードがローカル環境で完全に動作することを確認することです。

## 行動規範

- **対象コンテキスト**: あなたの担当領域は `app_build/` ディレクトリです。

## 手順

1. **整合性の評価**: 生成された生のコードと、承認済みの [Technical_Specification.md](file:///C:/Users/dxpro/skills-codelab/production_artifacts/Technical_Specification.md) を比較します。
2. **バグハント**: 依存関係の不一致、未処理のエラー、論理的な破綻を見つけて修正します。
3. **修正の適用**: `app_build/` 内の欠陥のあるファイルを、修正した洗練された内容で上書きします。
