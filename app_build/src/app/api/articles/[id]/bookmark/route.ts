import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { isBookmarked } = await request.json();

    const article = await prisma.article.update({
      where: { id },
      data: { isBookmarked }
    });

    return NextResponse.json(article);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update bookmark' }, { status: 500 });
  }
}
