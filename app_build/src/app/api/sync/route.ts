import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parser } from '@/lib/parser';

export async function POST() {
  try {
    const feeds = await prisma.feed.findMany();
    let newArticlesCount = 0;

    for (const feed of feeds) {
      try {
        const parsedFeed = await parser.parseURL(feed.url);
        
        // Update feed info if missing
        if (!feed.title || feed.title === 'Unknown Feed') {
          await prisma.feed.update({
            where: { id: feed.id },
            data: {
              title: parsedFeed.title || feed.url,
              description: parsedFeed.description || '',
            }
          });
        }

        const items = parsedFeed.items || [];
        for (const item of items) {
          if (!item.link) continue;
          
          const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
          
          // Check if article exists
          const exists = await prisma.article.findUnique({
            where: { link: item.link }
          });

          if (!exists) {
            await prisma.article.create({
              data: {
                title: item.title || 'No Title',
                link: item.link,
                pubDate,
                content: item.contentSnippet || item.content || '',
                creator: item.creator || item['dc:creator'] || '',
                feedId: feed.id,
              }
            });
            newArticlesCount++;
          }
        }

        // Update lastFetched
        await prisma.feed.update({
          where: { id: feed.id },
          data: { lastFetched: new Date() }
        });

      } catch (err) {
        console.error(`Error parsing feed ${feed.url}:`, err);
      }
    }

    return NextResponse.json({ success: true, newArticlesCount });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Failed to sync feeds' }, { status: 500 });
  }
}
