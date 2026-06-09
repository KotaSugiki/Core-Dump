# 🤖 AI-Driven-Development-template

開発環境に1コマンドでAI駆動開発を進めるためのセットアップができるテンプレート

## 🚀 特徴

- **自動プロンプト生成**: `workflow/start_cycle.md` に基づき、複雑なプロンプトを自動生成します。
- **マルチエージェント連携**: PM、エンジニア、QA、DevOps の各エージェントが連携して開発サイクルを実行します。
- **プロフェッショナルな出力**: 承認された仕様に基づいた高品質なコードとドキュメント。
- **進捗の可視化**: Markdown形式で状態を追跡し、最新の状況を表示します。

## 📂 ディレクトリ構成

```
AI-Driven-Development-template/
├── .agents/                 # エージェントのスキル定義とワークフロー
│   ├── agents.md           # 各エージェントの役割と制約
│   ├── skills/             # 個別スキル定義
│   ├── workflows/          # AIの実行フロー
│   └── hooks/
│
├── app_build/              # 生成されたアプリケーションコード
│   ├── frontend/           # フロントエンドアプリケーション
│   └── backend/            # バックエンドアプリケーション
│
├── production_artifacts/   # 開発成果物
│   ├── Technical_Specification.md
│   ├── workflow_results.md # ワークフロー実行結果
│   └── ...
│
├── workflow/               # 実行コマンド用スクリプト
│   ├── start_cycle.md
│   └── ...
│
├── hooks/                  # VSCode拡張機能用のフック
│   └── ai-workflow-runner.js
│
└── README.md               # プロジェクト概要
```

## 🛠️ セットアップ

### 前提条件

- **Node.js** 16.0.0 以上
- **npm** 8.0.0 以上
- **VSCode** (拡張機能 `open-in-browser`推奨)

### インストール手順

1. リポジトリをクローンまたはダウンロード

```bash
git clone http://[IP_ADDRESS]/DEV_INTELLIGENT/AI-Driven-Development-template.git
cd AI-Driven-Development-template
```

2. 依存関係のインストール

```bash
npm install
```

### VSCode 拡張機能の設定

1. **open-in-browser** 拡張機能をインストール
2. ワークフロー用フックを有効化
   - VSCodeの設定で `ai.workflow.customScript` を `C:\Users\dxpro\skills-codelab\hooks\ai-workflow-runner.js` に設定

## 🔄 実行方法

### 通常の実行フロー

```bash
npx tsx workflow/start_cycle.md
```

### 実行オプション

```bash
# 指定したエージェントのみ実行
npx tsx workflow/start_cycle.md --agent=pm

# ログレベル指定
npx tsx workflow/start_cycle.md --log=verbose

# 特定のエージェントをスキップ
npx tsx workflow/start_cycle.md --skip-agent=qa
```

### 実行例

**新規プロジェクト開始**

```bash
npx tsx workflow/start_cycle.md
```

**仕様書修正後の再実行**

```bash
# Technical_Specification.mdを編集後に実行
npx tsx workflow/start_cycle.md
```

## 🎯 エージェントの役割

| エージェント             | 役割                                 | コマンド           | フック               |
| ------------------------ | ------------------------------------ | ------------------ | -------------------- |
| **PM** (@pm)             | プロダクトマネージャー、アーキテクト | `start_cycle.md`   | `pm_action.js`       |
| **Engineer** (@engineer) | フルスタックエンジニア               | `generate_code.md` | `engineer_action.js` |
| **QA** (@qa)             | QAエンジニア、セキュリティ監査       | `audit_code.md`    | `qa_action.js`       |
| **DevOps** (@devops)     | DevOpsエンジニア                     | `deploy_app.md`    | `devops_action.js`   |

### 実行時のログ表示

ワークフロー実行中は、各エージェントの実行内容がリアルタイムで表示されます。

```
[PM] 分析中...
[ENGINEER] コーディング中...
[QA] テスト実行中...
[DEVOPS] デプロイ中...
```

## 📝 仕様書の作成

仕様書は以下の形式で作成します：

```markdown
# Technical Specification

## Executive Summary

## Requirements

## Architecture & Tech Stack

## State Management
```

仕様書を更新した後は、必ずPMエージェントに承認を求めてください。

## ⚠️ トラブルシューティング

### 実行時エラー

```bash
# 権限エラーの場合
chmod +x hooks/ai-workflow-runner.js
```

### VSCode 拡張機能が動作しない場合

1. 設定ファイルを確認
2. `F1` → `Developer: Reload Window` を実行
3. 拡張機能が有効化されているか確認

## 🤝 貢献

ご自由にプロジェクトをフォークし、改良や機能追加を行ってください！

## ライセンス

MIT
