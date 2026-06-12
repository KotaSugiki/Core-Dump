import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const feeds = await prisma.feed.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(feeds);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch feeds' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 });

    const existing = await prisma.feed.findUnique({ where: { url } });
    if (existing) {
      return NextResponse.json({ error: 'Feed already exists' }, { status: 400 });
    }

    const feed = await prisma.feed.create({
      data: {
        url,
        title: 'Unknown Feed',
      }
    });

    return NextResponse.json(feed);
  } catch (error) {
    console.error("POST /api/feeds Error:", error);
    return NextResponse.json({ error: 'Failed to add feed' }, { status: 500 });
  }
}
