import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * 「あとで読む」キュー内の記事一覧を readLaterOrder 昇順で取得する。
 */
export async function GET() {
  try {
    const articles = await prisma.article.findMany({
      where: { isReadLater: true },
      orderBy: { readLaterOrder: 'asc' },
      include: { feed: true },
    });

    return NextResponse.json(articles);
  } catch (error) {
    console.error('Read-later list error:', error);
    return NextResponse.json(
      { error: 'あとで読むキューの取得に失敗しました。' },
      { status: 500 }
    );
  }
}
