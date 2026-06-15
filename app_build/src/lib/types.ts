/**
 * Core Dump 共有型定義
 *
 * page.tsx 側とAPI側で共有する型を一元管理する。
 * Prisma の型とは分離し、フロントエンド向けに必要なフィールドのみ定義。
 */

export type Feed = {
  id: string;
  title: string;
  url: string;
};

export type Article = {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  content?: string;
  creator?: string;
  feed: Feed;
  isBookmarked: boolean;
  aiSummary?: string | null;
  isReadLater: boolean;
  readLaterOrder?: number | null;
  isRead: boolean;
};

/** ビュー表示モード */
export type ViewMode = 'grid' | 'timeline';
