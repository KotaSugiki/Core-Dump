/**
 * データ移行スクリプト: SQLite → PostgreSQL
 *
 * ローカルの SQLite (dev.db) から Supabase PostgreSQL にデータを移行する。
 * 冪等性を保証: 既存レコードはスキップし、再実行しても安全。
 *
 * 使い方:
 *   1. .env に PostgreSQL の DATABASE_URL / DIRECT_URL を設定
 *   2. npx prisma migrate deploy (または npx prisma db push) でスキーマを反映
 *   3. npx tsx scripts/migrate-data.ts を実行
 */

import { PrismaClient as PostgresClient } from '@prisma/client';
import Database from 'better-sqlite3';
import path from 'path';

// SQLite の行の型定義
interface SqliteFeed {
  id: string;
  title: string;
  url: string;
  description: string | null;
  lastFetched: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SqliteArticle {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  content: string | null;
  creator: string | null;
  feedId: string;
  isBookmarked: number; // SQLite では boolean は 0/1
  aiSummary: string | null;
  isReadLater: number;
  readLaterOrder: number | null;
  isRead: number;
  createdAt: string;
}

interface SqliteDigest {
  id: string;
  date: string;
  html: string;
  createdAt: string;
}

async function main() {
  // SQLite 接続（ローカルの dev.db）
  const dbPath = path.resolve(__dirname, '../prisma/dev.db');
  console.log(`📂 SQLite を読み込み中: ${dbPath}`);

  let sqliteDb: Database.Database;
  try {
    sqliteDb = new Database(dbPath, { readonly: true });
  } catch (error) {
    console.error('❌ SQLite ファイルが見つかりません。prisma/dev.db を確認してください。');
    process.exit(1);
  }

  // PostgreSQL 接続（.env の DATABASE_URL を使用）
  const pgClient = new PostgresClient();
  console.log('🔗 PostgreSQL に接続中...');

  try {
    // テスト接続
    await pgClient.$connect();
    console.log('✅ PostgreSQL 接続成功\n');

    // ===== Feed テーブルの移行 =====
    const feeds = sqliteDb.prepare('SELECT * FROM Feed').all() as SqliteFeed[];
    console.log(`📰 Feed: ${feeds.length} 件を移行中...`);

    let feedInserted = 0;
    let feedSkipped = 0;
    for (const feed of feeds) {
      try {
        await pgClient.feed.upsert({
          where: { id: feed.id },
          update: {}, // 既存レコードは更新しない
          create: {
            id: feed.id,
            title: feed.title,
            url: feed.url,
            description: feed.description,
            lastFetched: feed.lastFetched ? new Date(feed.lastFetched) : null,
            createdAt: new Date(feed.createdAt),
            updatedAt: new Date(feed.updatedAt),
          },
        });
        feedInserted++;
      } catch {
        feedSkipped++;
      }
    }
    console.log(`   ✅ ${feedInserted} 件挿入, ${feedSkipped} 件スキップ`);

    // ===== Article テーブルの移行 =====
    const articles = sqliteDb.prepare('SELECT * FROM Article').all() as SqliteArticle[];
    console.log(`📄 Article: ${articles.length} 件を移行中...`);

    let articleInserted = 0;
    let articleSkipped = 0;
    for (const article of articles) {
      try {
        await pgClient.article.upsert({
          where: { id: article.id },
          update: {},
          create: {
            id: article.id,
            title: article.title,
            link: article.link,
            pubDate: new Date(article.pubDate),
            content: article.content,
            creator: article.creator,
            feedId: article.feedId,
            isBookmarked: article.isBookmarked === 1,
            aiSummary: article.aiSummary,
            isReadLater: article.isReadLater === 1,
            readLaterOrder: article.readLaterOrder,
            isRead: article.isRead === 1,
            createdAt: new Date(article.createdAt),
          },
        });
        articleInserted++;
      } catch {
        articleSkipped++;
      }
    }
    console.log(`   ✅ ${articleInserted} 件挿入, ${articleSkipped} 件スキップ`);

    // ===== Digest テーブルの移行 =====
    const digests = sqliteDb.prepare('SELECT * FROM Digest').all() as SqliteDigest[];
    console.log(`🧠 Digest: ${digests.length} 件を移行中...`);

    let digestInserted = 0;
    let digestSkipped = 0;
    for (const digest of digests) {
      try {
        await pgClient.digest.upsert({
          where: { id: digest.id },
          update: {},
          create: {
            id: digest.id,
            date: digest.date,
            html: digest.html,
            createdAt: new Date(digest.createdAt),
          },
        });
        digestInserted++;
      } catch {
        digestSkipped++;
      }
    }
    console.log(`   ✅ ${digestInserted} 件挿入, ${digestSkipped} 件スキップ`);

    console.log('\n🎉 データ移行が完了しました！');
  } catch (error) {
    console.error('❌ 移行エラー:', error);
    process.exit(1);
  } finally {
    sqliteDb.close();
    await pgClient.$disconnect();
  }
}

main();
