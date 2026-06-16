import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

/**
 * 記事単体の AI 要約を生成する。
 * 既に aiSummary がキャッシュ済みの場合はそのまま返す（force=true で再生成可能）。
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  // クライアントからリクエストヘッダー経由でAPIキーを受け取る（サーバーには保存しない）
  const apiKey = request.headers.get('X-Gemini-API-Key');
  if (!apiKey) {
    return NextResponse.json(
      { error: 'APIキーが設定されていません。設定画面からGemini APIキーを入力してください。' },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  // 強制再生成フラグの確認
  let forceRegenerate = false;
  try {
    const body = await request.json();
    forceRegenerate = body?.force === true;
  } catch {
    // body が空の場合は無視
  }

  try {
    const article = await prisma.article.findUnique({
      where: { id },
      include: { feed: true },
    });

    if (!article) {
      return NextResponse.json(
        { error: '記事が見つかりません。' },
        { status: 404 }
      );
    }

    // キャッシュチェック: DB に保存済みの要約があればそのまま返す
    if (!forceRegenerate && article.aiSummary) {
      return NextResponse.json({
        summary: article.aiSummary,
        cached: true,
      });
    }

    // 記事本文が無い場合はタイトルのみで要約を試みる
    const contentText = article.content || article.title;
    if (!contentText || contentText.trim().length === 0) {
      return NextResponse.json(
        { error: '要約に使える記事本文がありません。' },
        { status: 400 }
      );
    }

    // Gemini API で要約生成
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // トークン節約のため本文を先頭2000文字に制限
    const truncatedContent = contentText.slice(0, 2000);

    const prompt = `以下の技術記事を、日本語で3行以内のTL;DR（要約）にまとめてください。箇条書きではなく、自然な文章で簡潔に記述してください。

タイトル: ${article.title}
ソース: ${article.feed.title}

本文:
${truncatedContent}

要約（3行以内、プレーンテキストのみ）:`;

    const result = await model.generateContent(prompt);
    const summary = result.response.text().trim();

    // DB にキャッシュ保存
    await prisma.article.update({
      where: { id },
      data: { aiSummary: summary },
    });

    return NextResponse.json({
      summary,
      cached: false,
    });
  } catch (error) {
    console.error('Article summarize error:', error);
    return NextResponse.json(
      { error: '要約の生成に失敗しました。もう一度お試しください。' },
      { status: 500 }
    );
  }
}
