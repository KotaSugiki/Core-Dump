'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import styles from './page.module.css';

const getFaviconUrl = (url: string) => {
  try {
    const domain = new URL(url).hostname;
    return `https://s2.googleusercontent.com/s2/favicons?domain=${domain}&sz=64`;
  } catch {
    return '';
  }
};

const getFeedColor = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.floor(Math.abs(hash) * 137.508) % 360;
  return {
    bg: `hsl(${h}, 80%, 15%)`,
    text: `hsl(${h}, 80%, 75%)`
  };
};

type Feed = {
  id: string;
  title: string;
  url: string;
};

type Article = {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  content?: string;
  creator?: string;
  feed: Feed;
  isBookmarked: boolean;
};

export default function Home() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [search, setSearch] = useState('');
  const [showBookmarked, setShowBookmarked] = useState(false);
  const [showFeedManager, setShowFeedManager] = useState(false);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState(-1);
  const [progress, setProgress] = useState(0);
  const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isHoveredRef = useRef(false);
  const [readerArticle, setReaderArticle] = useState<Article | null>(null);
  const [digestHtml, setDigestHtml] = useState('');
  const [digestLoading, setDigestLoading] = useState(false);
  const [showDigest, setShowDigest] = useState(false);
  const [digestError, setDigestError] = useState('');
  const [digestGeneratedAt, setDigestGeneratedAt] = useState('');
  const [digestCached, setDigestCached] = useState(false);

  // リーダーモードの開閉
  const openReader = (article: Article) => {
    setReaderArticle(article);
    document.body.style.overflow = 'hidden';
  };

  const closeReader = () => {
    setReaderArticle(null);
    document.body.style.overflow = '';
  };

  // Escキーでリーダーモードを閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && readerArticle) closeReader();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readerArticle]);

  // 各フィードの最新記事を1つずつ抽出（カルーセル用）
  const featuredArticles = useMemo(() => {
    const seen = new Set<string>();
    const result: Article[] = [];
    for (const article of articles) {
      if (!seen.has(article.feed.id)) {
        seen.add(article.feed.id);
        result.push(article);
      }
    }
    return result;
  }, [articles]);

  // カルーセル自動送り
  const goToSlide = useCallback((idx: number) => {
    setPrevIndex(heroIndex);
    setHeroIndex(idx);
    setProgress(0);
  }, [heroIndex]);

  useEffect(() => {
    if (featuredArticles.length <= 1) return;

    const INTERVAL = 6000; // 6秒
    const TICK = 50;

    // プログレスバー更新
    progressRef.current = setInterval(() => {
      if (isHoveredRef.current) return;
      setProgress(prev => {
        const next = prev + (TICK / INTERVAL) * 100;
        if (next >= 100) return 100;
        return next;
      });
    }, TICK);

    // スライド切り替え
    heroTimerRef.current = setInterval(() => {
      if (isHoveredRef.current) return;
      setHeroIndex(prev => {
        setPrevIndex(prev);
        return (prev + 1) % featuredArticles.length;
      });
      setProgress(0);
    }, INTERVAL);

    return () => {
      if (heroTimerRef.current) clearInterval(heroTimerRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [featuredArticles.length]);

  const fetchArticles = async () => {
    const params = new URLSearchParams();
    if (search) params.append('q', search);
    if (showBookmarked) params.append('bookmarked', 'true');
    const res = await fetch(`/api/articles?${params.toString()}`);
    if (res.ok) {
      const newArticles = await res.json();
      if (!document.startViewTransition) {
        setArticles(newArticles);
      } else {
        try {
          document.startViewTransition(() => {
            flushSync(() => {
              setArticles(newArticles);
            });
          });
        } catch {
          // トランジション競合時はフォールバック
          setArticles(newArticles);
        }
      }
    }
  };

  const fetchFeeds = async () => {
    const res = await fetch('/api/feeds');
    if (res.ok) {
      setFeeds(await res.json());
    }
  };

  useEffect(() => {
    fetchArticles();
    fetchFeeds();
  }, [search, showBookmarked]);

  const toggleBookmark = async (id: string, currentStatus: boolean) => {
    // Optimistic update
    setArticles(articles.map(a => a.id === id ? { ...a, isBookmarked: !currentStatus } : a));
    
    await fetch(`/api/articles/${id}/bookmark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isBookmarked: !currentStatus })
    });
  };

  const syncFeeds = async () => {
    setIsSyncing(true);
    await fetch('/api/sync', { method: 'POST' });
    await fetchArticles();
    setIsSyncing(false);
  };

  const addFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeedUrl) return;
    const res = await fetch('/api/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: newFeedUrl })
    });
    if (res.ok) {
      setNewFeedUrl('');
      fetchFeeds();
      syncFeeds(); // Trigger sync to get new articles
    }
  };

  const deleteFeed = async (id: string) => {
    await fetch(`/api/feeds/${id}`, { method: 'DELETE' });
    fetchFeeds();
    fetchArticles();
  };

  // AIダイジェスト生成
  const generateDigest = async (force = false) => {
    setShowDigest(true);
    setDigestLoading(true);
    setDigestError('');
    setDigestHtml('');
    setDigestCached(false);
    document.body.style.overflow = 'hidden';

    try {
      const res = await fetch('/api/digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();

      if (!res.ok) {
        setDigestError(data.error || 'ダイジェストの生成に失敗しました');
      } else {
        setDigestHtml(data.html);
        setDigestGeneratedAt(data.generatedAt);
        setDigestCached(data.cached === true);
      }
    } catch {
      setDigestError('ネットワークエラーが発生しました');
    } finally {
      setDigestLoading(false);
    }
  };

  const closeDigest = () => {
    setShowDigest(false);
    document.body.style.overflow = '';
  };

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.title}>Core Dump</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className={`${styles.button} ${styles.buttonOutline}`}
            onClick={() => setShowFeedManager(!showFeedManager)}
          >
            Manage Feeds
          </button>
          <button 
            className={styles.button}
            onClick={syncFeeds}
            disabled={isSyncing}
          >
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
          <button
            className={styles.digestBtn}
            onClick={generateDigest}
            disabled={digestLoading}
          >
            {digestLoading ? '🧠 生成中...' : '🧠 AI Digest'}
          </button>
        </div>
      </header>

      {showFeedManager && (
        <div className={`${styles.glass} ${styles.feedManager} ${styles['animate-fade-in']}`}>
          <h2>Manage Feeds</h2>
          <form onSubmit={addFeed} className={styles.feedForm}>
            <input 
              type="url" 
              placeholder="https://example.com/feed.xml" 
              className={styles.searchInput}
              value={newFeedUrl}
              onChange={(e) => setNewFeedUrl(e.target.value)}
              required
            />
            <button type="submit" className={styles.button}>Add Feed</button>
          </form>
          <ul className={styles.feedList}>
            {feeds.map(feed => (
              <li key={feed.id} className={styles.feedItem}>
                <div>
                  <strong>{feed.title}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{feed.url}</div>
                </div>
                <button 
                  className={`${styles.button} ${styles.buttonOutline}`}
                  style={{ padding: '0.5rem 1rem', borderColor: '#ef4444', color: '#ef4444' }}
                  onClick={() => deleteFeed(feed.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ===== ヒーローカルーセル ===== */}
      {featuredArticles.length > 0 && (
        <section className={styles.heroSection}>
          <div className={styles.heroLabel}>🔥 Featured</div>
          <div
            className={`${styles.glass} ${styles.heroCarousel}`}
            onMouseEnter={() => { isHoveredRef.current = true; }}
            onMouseLeave={() => { isHoveredRef.current = false; }}
          >
            {featuredArticles.map((article, idx) => {
              const color = getFeedColor(article.feed.id);
              let slideClass = styles.heroSlide;
              if (idx === heroIndex) slideClass += ` ${styles.heroSlideActive}`;
              else if (idx === prevIndex) slideClass += ` ${styles.heroSlidePrev}`;

              return (
                <div key={article.id} className={slideClass}>
                  <div
                    className={styles.heroAccent}
                    style={{ background: `linear-gradient(90deg, ${color.text}, transparent)` }}
                  />
                  <div
                    className={styles.heroFeedBadge}
                    style={{ backgroundColor: color.bg, color: color.text }}
                  >
                    <img
                      src={getFaviconUrl(article.feed.url)}
                      alt=""
                      className={styles.heroFavicon}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    {article.feed.title}
                  </div>
                  <h2 className={styles.heroTitle}>
                    <a
                      href={article.link}
                      onClick={(e) => { e.preventDefault(); openReader(article); }}
                      style={{ cursor: 'pointer' }}
                    >
                      {article.title}
                    </a>
                  </h2>
                  <div className={styles.heroMeta}>
                    {new Date(article.pubDate).toLocaleDateString('ja-JP', {
                      year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </div>
                </div>
              );
            })}
            <div
              className={styles.heroProgress}
              style={{ width: `${progress}%` }}
            />
          </div>
          {featuredArticles.length > 1 && (
            <div className={styles.heroControls}>
              {featuredArticles.map((_, idx) => (
                <button
                  key={idx}
                  className={`${styles.heroDot} ${idx === heroIndex ? styles.heroDotActive : ''}`}
                  onClick={() => goToSlide(idx)}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <div className={styles.controls}>
        <input 
          type="text" 
          placeholder="Search articles..." 
          className={styles.searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button 
          className={`${styles.button} ${showBookmarked ? '' : styles.buttonOutline}`}
          onClick={() => setShowBookmarked(!showBookmarked)}
        >
          {showBookmarked ? '★ Bookmarked' : '☆ All Articles'}
        </button>
      </div>

      <div className={styles.grid}>
        {articles.map((article, index) => (
          <article 
            key={article.id} 
            className={`${styles.glass} ${styles.card} ${styles['animate-fade-in']}`}
            style={{ 
              animationDelay: `${index * 0.05}s`,
              // @ts-ignore
              '--card-id': `card-${article.id}`
            }}
          >
            <div 
              className={styles.feedName}
              style={{
                backgroundColor: getFeedColor(article.feed.id).bg,
                color: getFeedColor(article.feed.id).text,
              }}
            >
              <img src={getFaviconUrl(article.feed.url)} alt="" className={styles.favicon} onError={(e) => { e.currentTarget.style.display = 'none' }} />
              {article.feed.title}
            </div>
            <h3 className={styles.articleTitle}>
              <a
                href={article.link}
                onClick={(e) => { e.preventDefault(); openReader(article); }}
                style={{ cursor: 'pointer' }}
              >
                {article.title}
              </a>
            </h3>
            <div className={styles.articleMeta}>
              <span>{new Date(article.pubDate).toLocaleDateString()}</span>
              <button 
                className={`${styles.bookmarkBtn} ${article.isBookmarked ? styles.active : ''}`}
                onClick={() => toggleBookmark(article.id, article.isBookmarked)}
                title={article.isBookmarked ? "Remove Bookmark" : "Add Bookmark"}
              >
                {article.isBookmarked ? '★' : '☆'}
              </button>
            </div>
          </article>
        ))}
      </div>
      
      {articles.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '4rem' }}>
          No articles found. Try adding a feed and syncing.
        </div>
      )}

      {/* ===== リーダーモード（集中モード） ===== */}
      {readerArticle && (() => {
        const color = getFeedColor(readerArticle.feed.id);
        const hasContent = readerArticle.content && readerArticle.content.trim().length > 0;
        return (
          <div
            className={styles.readerOverlay}
            onClick={(e) => { if (e.target === e.currentTarget) closeReader(); }}
          >
            <div className={`${styles.glass} ${styles.readerPanel}`}>
              <button className={styles.readerClose} onClick={closeReader} aria-label="Close">✕</button>
              <div className={styles.readerAccent} style={{ background: `linear-gradient(90deg, ${color.text}, var(--primary))` }} />
              <div className={styles.readerHeader}>
                <div
                  className={styles.readerFeedBadge}
                  style={{ backgroundColor: color.bg, color: color.text }}
                >
                  <img
                    src={getFaviconUrl(readerArticle.feed.url)}
                    alt=""
                    className={styles.readerFavicon}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  {readerArticle.feed.title}
                </div>
                <h2 className={styles.readerTitle}>{readerArticle.title}</h2>
                <div className={styles.readerMeta}>
                  <span>{new Date(readerArticle.pubDate).toLocaleDateString('ja-JP', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  })}</span>
                  {readerArticle.creator && <span>by {readerArticle.creator}</span>}
                </div>
              </div>
              <div className={styles.readerBody}>
                {hasContent ? (
                  <div
                    className={styles.readerContent}
                    dangerouslySetInnerHTML={{ __html: readerArticle.content! }}
                  />
                ) : (
                  <div className={styles.readerEmpty}>
                    <p>📄 この記事のプレビューはありません</p>
                    <p>元のサイトで全文をお読みください</p>
                  </div>
                )}
              </div>
              <div className={styles.readerFooter}>
                <div className={styles.readerActions}>
                  <button
                    className={`${styles.readerBtn} ${readerArticle.isBookmarked ? styles.readerBtnPrimary : ''}`}
                    onClick={() => {
                      toggleBookmark(readerArticle.id, readerArticle.isBookmarked);
                      setReaderArticle({ ...readerArticle, isBookmarked: !readerArticle.isBookmarked });
                    }}
                  >
                    {readerArticle.isBookmarked ? '★ Bookmarked' : '☆ Bookmark'}
                  </button>
                </div>
                <a
                  href={readerArticle.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.readerBtn} ${styles.readerBtnPrimary}`}
                >
                  元の記事を開く ↗
                </a>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== AI Daily Digest モーダル ===== */}
      {showDigest && (
        <div
          className={styles.readerOverlay}
          onClick={(e) => { if (e.target === e.currentTarget) closeDigest(); }}
        >
          <div className={`${styles.glass} ${styles.readerPanel}`}>
            <button className={styles.readerClose} onClick={closeDigest} aria-label="Close">✕</button>
            <div className={styles.digestAccent} />
            <div className={styles.readerHeader}>
              <h2 className={styles.readerTitle}>🧠 AI Daily Digest</h2>
              <div className={styles.readerMeta}>
                <span>Core Dump — AIが生成した今日のテックニュースブリーフィング</span>
              </div>
              {digestGeneratedAt && (
                <div className={styles.digestMeta}>
                  生成日時: {new Date(digestGeneratedAt).toLocaleString('ja-JP')}
                  {digestCached && ' （キャッシュ済み）'}
                </div>
              )}
            </div>
            <div className={styles.readerBody}>
              {digestLoading && (
                <div className={styles.digestLoading}>
                  <div className={styles.spinner} />
                  <div className={styles.digestLoadingText}>
                    Gemini AI が記事を分析中...
                    <span>トレンドの検出、要約の生成、インサイトの抽出を行っています</span>
                  </div>
                </div>
              )}
              {digestError && (
                <div className={styles.digestError}>
                  <p>⚠️ {digestError}</p>
                  <button className={styles.button} onClick={generateDigest}>リトライ</button>
                </div>
              )}
              {digestHtml && (
                <div
                  className={styles.digestContent}
                  dangerouslySetInnerHTML={{ __html: digestHtml }}
                />
              )}
            </div>
            {digestHtml && (
              <div className={styles.readerFooter}>
                <div className={styles.digestMeta}>
                  {digestCached ? '📦 キャッシュから表示中' : '✨ 新規生成済み'}
                </div>
                <button
                  className={styles.readerBtn}
                  onClick={() => generateDigest(true)}
                  disabled={digestLoading}
                >
                  🔄 最新の記事で再生成
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
