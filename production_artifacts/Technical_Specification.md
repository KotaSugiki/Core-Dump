# 技術仕様書 — Core Dump v2.0 新機能

## 概要 (Executive Summary)

Core Dump は現在、RSS フィードの取得・閲覧・ブックマーク・AI ダイジェストを提供する Next.js 製リーダーアプリケーションである。本仕様では、日常的な利用をさらに効率的・快適にするための **3 つの画期的な新機能** を定義する。

---

## 新機能一覧

| # | 機能名 | キャッチコピー |
|---|--------|---------------|
| 1 | **Smart Feed Timeline** | 「タイムライン形式で、記事の流れを一目で把握」 |
| 2 | **AI Article Summary (per-article)** | 「記事を開かず、ワンクリックで要約を取得」 |
| 3 | **Read Later Queue + オフライン対応** | 「通勤中に読みたい記事を、自分だけの待ち行列へ」 |

---

## 要件 (Requirements)

### 機能要件

#### 機能1: Smart Feed Timeline

**概要**: 現在のグリッド表示に加え、**タイムライン（時系列フロー）** 表示モードを追加する。フィードソースごとに色分けされたタイムライン上に記事を配置し、「いつ何が話題になったか」を視覚的に把握できるようにする。

- 日付ごとにセクション分けされた縦型タイムライン
- フィードソースごとのカラーコード化（既存の `getFeedColor` を活用）
- 各ノードに記事タイトル・ソース名・公開日時を表示
- ノードクリックでリーダーモードを開く
- グリッド表示 ↔ タイムライン表示のトグルスイッチ
- スクロールアニメーション（Intersection Observer API による遅延表示）

#### 機能2: AI Article Summary (per-article)

**概要**: 現在の AI Digest（日次全体要約）に加え、**記事単位の即時 AI 要約** 機能を追加する。記事カードまたはリーダーモード上の「⚡ AI要約」ボタンを押すと、Gemini API がその記事の本文を分析し、3行程度の TL;DR を即座に表示する。

- 記事カード・リーダーモードに「⚡ AI要約」ボタンを配置
- Gemini API（gemini-2.5-flash）を使って記事単体の要約を生成
- 要約結果を DB にキャッシュ（Article テーブルに `aiSummary` フィールドを追加）
- 一度生成された要約は即座にキャッシュから表示
- リーダーモードでは要約を本文上部にハイライト表示
- ローディング中はスケルトンアニメーション

#### 機能3: Read Later Queue + オフライン対応

**概要**: ブックマーク機能を拡張し、**「あとで読む」キュー** を導入する。キュー内の記事は優先順序を自由に並び替えでき、専用パネルからまとめて読み進められる。さらに、Service Worker を活用して、キュー内の記事コンテンツをキャッシュし、オフラインでも閲覧可能にする。

- ブックマーク（★）とは別に「📥 あとで読む」ボタンを追加
- 専用サイドパネル（右側からスライドイン）でキューを表示
- ドラッグ＆ドロップで記事の読む順序を変更
- 記事を読み終えたら「✓ 読了」ボタンでキューから除外
- Service Worker による記事コンテンツのオフラインキャッシュ
- 未読カウンターをヘッダーに表示（バッジ付き）

### 非機能要件

- **パフォーマンス**: タイムライン表示は Intersection Observer で遅延レンダリングし、大量記事でもスムーズなスクロールを維持
- **レスポンシブ**: タイムラインはモバイルでは単一カラムのシンプルリストに縮退
- **キャッシュ戦略**: AI 要約の DB キャッシュにより、同じ記事への再要求で API コストゼロ
- **オフライン**: Service Worker の Cache API を利用し、キュー内記事は Network-first → Cache-fallback 戦略
- **アニメーション**: すべての新 UI 要素にマイクロアニメーション（フェードイン、スライド、スケルトン）を適用

---

## アーキテクチャと技術スタック (Architecture & Tech Stack)

既存の技術スタックをそのまま継承し、最小限の追加で実装する：

| 層 | 技術 | 備考 |
|---|---|---|
| フレームワーク | **Next.js (App Router)** | 既存 |
| データベース | **SQLite + Prisma** | 既存。スキーマを拡張 |
| AI | **Gemini API (gemini-2.5-flash)** | 既存の digest API パターンを踏襲 |
| スタイリング | **CSS Modules (Vanilla CSS)** | 既存。新モジュールを追加 |
| オフライン | **Service Worker (Cache API)** | 新規追加 |
| D&D | **HTML Drag and Drop API** | ネイティブ API を使用、外部ライブラリ不要 |

### DB スキーマ変更

```prisma
// Article テーブルに追加
model Article {
  // ... 既存フィールド ...
  aiSummary    String?   // AI 要約キャッシュ
  isReadLater  Boolean   @default(false)  // あとで読むキュー
  readLaterOrder Int?    // キュー内の並び順
  isRead       Boolean   @default(false)  // 読了フラグ
}
```

### 新規 API ルート

| エンドポイント | メソッド | 説明 |
|---|---|---|
| `/api/articles/[id]/summarize` | `POST` | 記事単体の AI 要約を生成・取得 |
| `/api/articles/[id]/read-later` | `POST` | あとで読むキューへの追加/解除 |
| `/api/articles/read-later` | `GET` | キュー内記事一覧取得（order順） |
| `/api/articles/read-later/reorder` | `PUT` | キュー内記事の並び順を更新 |

### UI コンポーネント構成

```
page.tsx (既存拡張)
├── ViewToggle (グリッド ↔ タイムライン切替)
├── TimelineView (新規: タイムライン表示)
│   ├── TimelineDayGroup (日付ヘッダー)
│   └── TimelineNode (個々の記事ノード)
├── ArticleCard (既存拡張: AI要約ボタン + あとで読むボタン追加)
├── ReaderMode (既存拡張: AI要約セクション追加)
├── ReadLaterPanel (新規: サイドパネル)
│   └── ReadLaterItem (ドラッグ対応記事アイテム)
└── AiSummaryPopover (新規: AI要約のポップオーバー表示)
```

---

## 状態管理 (State Management)

| 状態 | 管理方法 | 説明 |
|---|---|---|
| `viewMode` | `useState` | `'grid'` or `'timeline'` |
| `readLaterQueue` | `useState` + API | キュー内記事配列、API と同期 |
| `showReadLaterPanel` | `useState` | サイドパネルの開閉 |
| `articleSummaries` | `useState (Map)` | 記事ID → AI要約のキャッシュ |
| `summarizingIds` | `useState (Set)` | 現在AI要約生成中の記事ID群 |

- **オプティミスティック更新**: あとで読む追加/削除・読了はUI即時反映 → API同期
- **キャッシュファースト**: AI要約はまず DB キャッシュを確認、なければ生成

---

## 実装優先順序

1. **Phase 1**: Smart Feed Timeline（UI の価値が最も高い）
2. **Phase 2**: AI Article Summary（既存 AI 基盤を拡張）
3. **Phase 3**: Read Later Queue + オフライン（最も複雑）

---

## 画面イメージ

### タイムライン表示モード
```
┌──────────────────────────────────────────┐
│  Core Dump           [Grid│Timeline] [⚙]│
├──────────────────────────────────────────┤
│                                          │
│  ── 2026年6月15日 ─────────────────      │
│  ●─ [Zenn]  Reactの新しいコンパイラ...    │
│  ●─ [Qiita] TypeScript 5.6の変更点...    │
│  ●─ [dev.to] AI Agent設計パターン...     │
│                                          │
│  ── 2026年6月14日 ─────────────────      │
│  ●─ [はてブ] Next.js 16 の新機能...      │
│  ●─ [Zenn]  Rust入門ガイド...            │
│                                          │
└──────────────────────────────────────────┘
```

### 記事カード（AI要約付き）
```
┌──────────────────────────┐
│ [ZENN]                   │
│ Reactの新しいコンパイラ... │
│                          │
│ ⚡ AI要約:               │
│ React Compilerが自動で    │
│ メモ化を行い、useMemo    │
│ が不要に。パフォーマンス  │
│ が大幅向上。              │
│                          │
│ 2026/06/15  ★  📥       │
└──────────────────────────┘
```

### あとで読むパネル
```
                    ┌──────────────────┐
                    │ 📥 あとで読む (3) │
                    ├──────────────────┤
                    │ ≡ AI Agent設計... │
                    │ ≡ TypeScript...   │
                    │ ≡ Rust入門...     │
                    │                  │
                    │      [全て読了]   │
                    └──────────────────┘
```
