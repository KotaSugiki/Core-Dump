import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

// 今日の日付を YYYY-MM-DD 形式で取得（日本時間）
function getTodayDateString(): string {
  const now = new Date();
  // JST (UTC+9) に変換
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split('T')[0];
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY が設定されていません。.env ファイルに追加してください。' },
      { status: 500 }
    );
  }

  // 強制再生成フラグの確認
  let forceRegenerate = false;
  try {
    const body = await request.json();
    forceRegenerate = body?.force === true;
  } catch {
    // body が空の場合は無視
  }

  const today = getTodayDateString();

  try {
    // キャッシュチェック: 今日のダイジェストが既に存在するか確認
    if (!forceRegenerate) {
      const cached = await prisma.digest.findUnique({
        where: { date: today },
      });

      if (cached) {
        return NextResponse.json({
          html: cached.html,
          generatedAt: cached.createdAt.toISOString(),
          cached: true,
        });
      }
    }

    // 直近の記事を取得（最大50件）
    const articles = await prisma.article.findMany({
      orderBy: { pubDate: 'desc' },
      include: { feed: true },
      take: 50,
    });

    if (articles.length === 0) {
      return NextResponse.json(
        { error: '記事がありません。先にフィードを追加して同期してください。' },
        { status: 400 }
      );
    }

    // フィードごとにグルーピングして構造化
    const feedGroups: Record<string, { feedTitle: string; articles: { title: string; content: string; date: string }[] }> = {};
    for (const article of articles) {
      const key = article.feed.title;
      if (!feedGroups[key]) {
        feedGroups[key] = { feedTitle: key, articles: [] };
      }
      feedGroups[key].articles.push({
        title: article.title,
        content: (article.content || '').slice(0, 300), // トークン節約のため先頭300文字
        date: article.pubDate.toISOString().split('T')[0],
      });
    }

    const articlesSummary = Object.values(feedGroups)
      .map(group => {
        const items = group.articles
          .map(a => `  - 「${a.title}」(${a.date})\n    ${a.content.slice(0, 150)}...`)
          .join('\n');
        return `【${group.feedTitle}】\n${items}`;
      })
      .join('\n\n');

    // Gemini API 呼び出し
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `あなたは優秀なテックジャーナリストです。以下はITエンジニア向けRSSフィードから取得した最新記事の一覧です。

${articlesSummary}

上記の記事を分析し、以下の形式でHTMLレポートを生成してください（HTMLタグのみ、<html><body>タグは不要）。

1. **🔥 トレンドトピック** (2〜4個)
   複数のフィードやソースで共通して話題になっているテーマを抽出し、なぜ注目されているか簡潔に解説してください。

2. **📝 注目記事ピックアップ** (5〜8個)
   特に重要な記事を選び、それぞれ2〜3行のTL;DR（要約）を付けてください。記事タイトルは<strong>で強調してください。

3. **💡 エンジニアへのインサイト**
   今日の記事群から読み取れる技術トレンドや、エンジニアが注目すべきポイントを3〜5個の箇条書きで提示してください。

レスポンスはHTMLのみ（マークダウンではなく）で返してください。見出しには<h3>を使い、リストには<ul><li>を使ってください。全体を日本語で記述してください。`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const html = response.text();

    // データベースにキャッシュを保存（upsert で同日なら上書き）
    await prisma.digest.upsert({
      where: { date: today },
      update: { html, createdAt: new Date() },
      create: { date: today, html },
    });

    return NextResponse.json({
      html,
      generatedAt: new Date().toISOString(),
      cached: false,
    });
  } catch (error) {
    console.error('Digest generation error:', error);
    return NextResponse.json(
      { error: 'ダイジェストの生成に失敗しました。もう一度お試しください。' },
      { status: 500 }
    );
  }
}
