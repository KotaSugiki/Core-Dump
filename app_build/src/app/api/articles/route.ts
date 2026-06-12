import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('q') || '';
    const bookmarked = searchParams.get('bookmarked') === 'true';

    const whereClause: any = {};
    if (search) {
      whereClause.OR = [
        { title: { contains: search } },
        { content: { contains: search } }
      ];
    }
    if (bookmarked) {
      whereClause.isBookmarked = true;
    }

    const articles = await prisma.article.findMany({
      where: whereClause,
      orderBy: { pubDate: 'desc' },
      include: { feed: true },
      take: 50,
    });

    return NextResponse.json(articles);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 });
  }
}
