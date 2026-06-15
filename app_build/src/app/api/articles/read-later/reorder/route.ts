import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * 「あとで読む」キュー内の記事の並び順を更新する。
 * リクエストボディに { orderedIds: string[] } を受け取り、
 * 配列の順序をそのまま readLaterOrder に反映する。
 */
export async function PUT(request: Request) {
  try {
    const { orderedIds } = await request.json();

    if (!Array.isArray(orderedIds)) {
      return NextResponse.json(
        { error: 'orderedIds は配列で指定してください。' },
        { status: 400 }
      );
    }

    // トランザクションで一括更新（データ整合性を保証）
    const updates = orderedIds.map((id: string, index: number) =>
      prisma.article.update({
        where: { id },
        data: { readLaterOrder: index },
      })
    );

    await prisma.$transaction(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reorder error:', error);
    return NextResponse.json(
      { error: 'キューの並び替えに失敗しました。' },
      { status: 500 }
    );
  }
}
