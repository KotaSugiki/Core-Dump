import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * 「あとで読む」キューへの追加/解除を切り替える。
 * 追加時は現在のキュー末尾に readLaterOrder を自動付番する。
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { isReadLater } = await request.json();

    if (isReadLater) {
      // キューに追加: 現在の最大 order + 1 を付与
      const maxOrderArticle = await prisma.article.findFirst({
        where: { isReadLater: true },
        orderBy: { readLaterOrder: 'desc' },
        select: { readLaterOrder: true },
      });
      const nextOrder = (maxOrderArticle?.readLaterOrder ?? -1) + 1;

      const article = await prisma.article.update({
        where: { id },
        data: {
          isReadLater: true,
          readLaterOrder: nextOrder,
          isRead: false, // キューに再追加時は未読に戻す
        },
      });
      return NextResponse.json(article);
    } else {
      // キューから除外
      const article = await prisma.article.update({
        where: { id },
        data: {
          isReadLater: false,
          readLaterOrder: null,
        },
      });
      return NextResponse.json(article);
    }
  } catch (error) {
    console.error('Read-later toggle error:', error);
    return NextResponse.json(
      { error: 'あとで読むキューの更新に失敗しました。' },
      { status: 500 }
    );
  }
}
