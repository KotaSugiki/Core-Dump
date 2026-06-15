'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import styles from './page.module.css';
import feat from './features.module.css';
import type { Article, Feed, ViewMode } from '@/lib/types';

// ===== ユーティリティ関数 =====

const getFaviconUrl = (url: string) => {
  try {
    const domain = new URL(url).hostname;
    return `https://s2.googleusercontent.com/s2/favicons?domain=${domain}&sz=64`;
  } catch {
    return '';
  }
};

/** フィードIDからユニークなHSLカラーを導出する */
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

/** 日付文字列を日本語の日付ラベルに変換 */
const formatDateLabel = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
};

/** 記事を日付ごとにグルーピングする */
const groupArticlesByDate = (articles: Article[]) => {
  const groups: Map<string, Article[]> = new Map();
  for (const article of articles) {
    const dateKey = new Date(article.pubDate).toISOString().split('T')[0];
    const existing = groups.get(dateKey);
    if (existing) {
      existing.push(article);
    } else {
      groups.set(dateKey, [article]);
    }
  }
  return groups;
};

// ===== タイムラインノードコンポーネント =====

function TimelineNode({
  article,
  onOpenReader,
  onToggleBookmark,
  onToggleReadLater,
  onSummarize,
  isSummarizing,
}: {
  article: Article;
  onOpenReader: (article: Article) => void;
  onToggleBookmark: (id: string, current: boolean) => void;
  onToggleReadLater: (id: string, current: boolean) => void;
  onSummarize: (id: string) => void;
  isSummarizing: boolean;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const color = getFeedColor(article.feed.id);

  // Intersection Observer で遅延表示アニメーションを実現
  useEffect(() => {
    const el = nodeRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={nodeRef}
      className={`${feat.node} ${isVisible ? feat.visible : ''}`}
      onClick={() => onOpenReader(article)}
    >
      <div
        className={feat.nodeAccent}
        style={{ background: color.text }}
      />
      <div
        className={feat.nodeFeedBadge}
        style={{ backgroundColor: color.bg, color: color.text }}
      >
        <img
          src={getFaviconUrl(article.feed.url)}
          alt=""
          className={feat.nodeFavicon}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        {article.feed.title}
      </div>
      <div className={feat.nodeTitle}>{article.title}</div>

      {/* AI要約がキャッシュ済みの場合は表示 */}
      {article.aiSummary && (
        <div className={feat.summarySection}>
          <div className={feat.summaryLabel}>⚡ AI 要約</div>
          <p className={feat.summaryText}>{article.aiSummary}</p>
        </div>
      )}

      <div className={feat.nodeMeta}>
        <span>
          {new Date(article.pubDate).toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        {article.creator && <span>by {article.creator}</span>}
      </div>
      <div
        className={feat.nodeActions}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className={`${feat.nodeActionBtn} ${article.isBookmarked ? feat.active : ''}`}
          onClick={() => onToggleBookmark(article.id, article.isBookmarked)}
          title={article.isBookmarked ? 'ブックマーク解除' : 'ブックマーク'}
        >
          {article.isBookmarked ? '★' : '☆'}
        </button>
        <button
          className={feat.nodeActionBtn}
          onClick={() => onToggleReadLater(article.id, article.isReadLater)}
          title={article.isReadLater ? 'キューから除外' : 'あとで読む'}
        >
          {article.isReadLater ? '📥' : '📄'}
        </button>
        {!article.aiSummary && (
          <button
            className={feat.aiSummaryBtn}
            onClick={() => onSummarize(article.id)}
            disabled={isSummarizing}
          >
            {isSummarizing ? '⏳' : '⚡ AI要約'}
          </button>
        )}
      </div>
    </div>
  );
}

// ===== Read Later パネルコンポーネント =====

function ReadLaterPanel({
  articles,
  onClose,
  onOpenReader,
  onRemove,
  onReorder,
}: {
  articles: Article[];
  onClose: () => void;
  onOpenReader: (article: Article) => void;
  onRemove: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    // 並び替えロジック: ドラッグ元をドロップ先の位置に挿入
    const reordered = [...articles];
    const [removed] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, removed);

    const orderedIds = reordered.map((a) => a.id);
    onReorder(orderedIds);

    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // Escキーで閉じる
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <>
      <div className={feat.readLaterOverlay} onClick={onClose} />
      <div className={feat.readLaterPanel}>
        <div className={feat.readLaterHeader}>
          <div className={feat.readLaterTitle}>
            📥 あとで読む
            {articles.length > 0 && (
              <span className={feat.readLaterBadge}>{articles.length}</span>
            )}
          </div>
          <button className={feat.readLaterClose} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={feat.readLaterBody}>
          {articles.length === 0 ? (
            <div className={feat.readLaterEmpty}>
              <p>📭 キューは空です</p>
              <p>記事の「📄」ボタンで追加できます</p>
            </div>
          ) : (
            articles.map((article, index) => {
              const color = getFeedColor(article.feed.id);
              return (
                <div
                  key={article.id}
                  className={`${feat.readLaterItem} ${dragIndex === index ? feat.dragging : ''} ${dragOverIndex === index ? feat.dragOver : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={handleDragEnd}
                >
                  <span className={feat.dragHandle}>≡</span>
                  <div
                    className={feat.readLaterItemContent}
                    onClick={() => onOpenReader(article)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className={feat.readLaterItemTitle}>{article.title}</div>
                    <div className={feat.readLaterItemMeta}>
                      <span style={{ color: color.text }}>{article.feed.title}</span>
                      {' · '}
                      {new Date(article.pubDate).toLocaleDateString('ja-JP')}
                    </div>
                  </div>
                  <div className={feat.readLaterItemActions}>
                    <button
                      className={feat.readLaterActionBtn}
                      onClick={() => onRemove(article.id)}
                      title="キューから除外"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {articles.length > 0 && (
          <div className={feat.readLaterFooter}>
            <button
              className={feat.readLaterClearBtn}
              onClick={() => {
                for (const a of articles) {
                  onRemove(a.id);
                }
              }}
            >
              すべてキューから除外
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ===== メインコンポーネント =====

export default function Home() {
  // --- 既存の状態 ---
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

  // --- 新機能の状態 ---
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [readLaterQueue, setReadLaterQueue] = useState<Article[]>([]);
  const [showReadLaterPanel, setShowReadLaterPanel] = useState(false);
  const [summarizingIds, setSummarizingIds] = useState<Set<string>>(new Set());

  // ===== リーダーモード =====
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

  // ===== カルーセル =====
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

  const goToSlide = useCallback((idx: number) => {
    setPrevIndex(heroIndex);
    setHeroIndex(idx);
    setProgress(0);
  }, [heroIndex]);

  useEffect(() => {
    if (featuredArticles.length <= 1) return;

    const INTERVAL = 6000;
    const TICK = 50;

    progressRef.current = setInterval(() => {
      if (isHoveredRef.current) return;
      setProgress(prev => {
        const next = prev + (TICK / INTERVAL) * 100;
        if (next >= 100) return 100;
        return next;
      });
    }, TICK);

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

  // ===== データ取得 =====
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

  const fetchReadLaterQueue = async () => {
    const res = await fetch('/api/articles/read-later');
    if (res.ok) {
      setReadLaterQueue(await res.json());
    }
  };

  useEffect(() => {
    fetchArticles();
    fetchFeeds();
    fetchReadLaterQueue();
  }, [search, showBookmarked]);

  // ===== 既存アクション =====
  const toggleBookmark = async (id: string, currentStatus: boolean) => {
    // オプティミスティック更新
    setArticles(prev => prev.map(a => a.id === id ? { ...a, isBookmarked: !currentStatus } : a));

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
      syncFeeds();
    }
  };

  const deleteFeed = async (id: string) => {
    await fetch(`/api/feeds/${id}`, { method: 'DELETE' });
    fetchFeeds();
    fetchArticles();
  };

  // ===== AI Digest =====
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

  // ===== 新機能: AI 記事要約 =====
  const summarizeArticle = async (id: string) => {
    setSummarizingIds(prev => new Set(prev).add(id));

    try {
      const res = await fetch(`/api/articles/${id}/summarize`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok && data.summary) {
        // ローカル state にも反映（再フェッチ不要）
        setArticles(prev =>
          prev.map(a => a.id === id ? { ...a, aiSummary: data.summary } : a)
        );
        // リーダーモードで開いている記事の場合も更新
        if (readerArticle?.id === id) {
          setReaderArticle(prev => prev ? { ...prev, aiSummary: data.summary } : prev);
        }
      }
    } catch (error) {
      console.error('Article summarize error:', error);
    } finally {
      setSummarizingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // ===== 新機能: あとで読む =====
  const toggleReadLater = async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;

    // オプティミスティック更新
    setArticles(prev =>
      prev.map(a => a.id === id ? { ...a, isReadLater: newStatus } : a)
    );

    await fetch(`/api/articles/${id}/read-later`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isReadLater: newStatus }),
    });

    // キュー一覧を再取得
    await fetchReadLaterQueue();
  };

  const removeFromReadLater = async (id: string) => {
    // オプティミスティック更新
    setReadLaterQueue(prev => prev.filter(a => a.id !== id));
    setArticles(prev =>
      prev.map(a => a.id === id ? { ...a, isReadLater: false } : a)
    );

    await fetch(`/api/articles/${id}/read-later`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isReadLater: false }),
    });
  };

  const reorderReadLater = async (orderedIds: string[]) => {
    // オプティミスティック更新: UI上ですぐに反映
    const reordered = orderedIds
      .map(id => readLaterQueue.find(a => a.id === id))
      .filter((a): a is Article => a !== undefined);
    setReadLaterQueue(reordered);

    await fetch('/api/articles/read-later/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds }),
    });
  };

  // Read Later キューのカウント
  const readLaterCount = readLaterQueue.length;

  // ===== タイムライン用: 日付グルーピング =====
  const articlesByDate = useMemo(() => groupArticlesByDate(articles), [articles]);

  // ===== レンダリング =====
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.title}>Core Dump</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            className={feat.readLaterHeaderBtn}
            onClick={() => {
              setShowReadLaterPanel(true);
              document.body.style.overflow = 'hidden';
            }}
          >
            📥 あとで読む
            {readLaterCount > 0 && (
              <span className={feat.headerBadge}>{readLaterCount}</span>
            )}
          </button>
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
            onClick={() => generateDigest()}
            disabled={digestLoading}
          >
            {digestLoading ? '🧠 生成中...' : '🧠 AI Digest'}
          </button>
        </div>
      </header>

      {/* ===== Feed Manager ===== */}
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

      {/* ===== 検索バー + ビュー切替 ===== */}
      <div className={styles.controls}>
        <input
          type="text"
          placeholder="Search articles..."
          className={styles.searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className={feat.viewToggle}>
          <button
            className={`${feat.viewToggleBtn} ${viewMode === 'grid' ? feat.viewToggleBtnActive : ''}`}
            onClick={() => setViewMode('grid')}
          >
            ▦ Grid
          </button>
          <button
            className={`${feat.viewToggleBtn} ${viewMode === 'timeline' ? feat.viewToggleBtnActive : ''}`}
            onClick={() => setViewMode('timeline')}
          >
            ⏐ Timeline
          </button>
        </div>
        <button
          className={`${styles.button} ${showBookmarked ? '' : styles.buttonOutline}`}
          onClick={() => setShowBookmarked(!showBookmarked)}
        >
          {showBookmarked ? '★ Bookmarked' : '☆ All Articles'}
        </button>
      </div>

      {/* ===== メインコンテンツ: Grid or Timeline ===== */}
      {viewMode === 'grid' ? (
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

              {/* AI 要約セクション */}
              {article.aiSummary ? (
                <div className={feat.summarySection}>
                  <div className={feat.summaryLabel}>⚡ AI 要約</div>
                  <p className={feat.summaryText}>{article.aiSummary}</p>
                </div>
              ) : (
                <button
                  className={feat.aiSummaryBtn}
                  onClick={() => summarizeArticle(article.id)}
                  disabled={summarizingIds.has(article.id)}
                  style={{ marginBottom: '0.75rem' }}
                >
                  {summarizingIds.has(article.id) ? (
                    <>
                      <span className={feat.skeleton} style={{ width: '100%', display: 'inline-block' }} />
                      <span className={feat.skeleton} style={{ width: '60%', display: 'inline-block' }} />
                    </>
                  ) : (
                    '⚡ AI要約'
                  )}
                </button>
              )}

              <div className={styles.articleMeta}>
                <span>{new Date(article.pubDate).toLocaleDateString()}</span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    className={`${styles.bookmarkBtn} ${article.isBookmarked ? styles.active : ''}`}
                    onClick={() => toggleBookmark(article.id, article.isBookmarked)}
                    title={article.isBookmarked ? "Remove Bookmark" : "Add Bookmark"}
                  >
                    {article.isBookmarked ? '★' : '☆'}
                  </button>
                  <button
                    className={`${feat.readLaterBtn} ${article.isReadLater ? feat.active : ''}`}
                    onClick={() => toggleReadLater(article.id, article.isReadLater)}
                    title={article.isReadLater ? 'キューから除外' : 'あとで読む'}
                  >
                    {article.isReadLater ? '📥' : '📄'}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        /* ===== Timeline ビュー ===== */
        <div className={feat.timeline}>
          {Array.from(articlesByDate.entries()).map(([dateKey, dayArticles]) => (
            <div key={dateKey} className={feat.dayGroup}>
              <div className={feat.dayHeader}>
                {formatDateLabel(dateKey)}
              </div>
              {dayArticles.map((article) => (
                <TimelineNode
                  key={article.id}
                  article={article}
                  onOpenReader={openReader}
                  onToggleBookmark={toggleBookmark}
                  onToggleReadLater={toggleReadLater}
                  onSummarize={summarizeArticle}
                  isSummarizing={summarizingIds.has(article.id)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {articles.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '4rem' }}>
          No articles found. Try adding a feed and syncing.
        </div>
      )}

      {/* ===== リーダーモード ===== */}
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
                {/* AI 要約ハイライト */}
                {readerArticle.aiSummary ? (
                  <div className={feat.summarySection}>
                    <div className={feat.summaryLabel}>⚡ AI 要約</div>
                    <p className={feat.summaryText}>{readerArticle.aiSummary}</p>
                  </div>
                ) : (
                  <button
                    className={feat.aiSummaryBtn}
                    onClick={() => summarizeArticle(readerArticle.id)}
                    disabled={summarizingIds.has(readerArticle.id)}
                    style={{ marginBottom: '1rem' }}
                  >
                    {summarizingIds.has(readerArticle.id) ? '⏳ 生成中...' : '⚡ AI要約を生成'}
                  </button>
                )}

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
                  <button
                    className={`${styles.readerBtn} ${readerArticle.isReadLater ? styles.readerBtnPrimary : ''}`}
                    onClick={() => {
                      toggleReadLater(readerArticle.id, readerArticle.isReadLater);
                      setReaderArticle({ ...readerArticle, isReadLater: !readerArticle.isReadLater });
                    }}
                  >
                    {readerArticle.isReadLater ? '📥 キュー追加済み' : '📄 あとで読む'}
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
                  <button className={styles.button} onClick={() => generateDigest()}>リトライ</button>
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

      {/* ===== Read Later サイドパネル ===== */}
      {showReadLaterPanel && (
        <ReadLaterPanel
          articles={readLaterQueue}
          onClose={() => {
            setShowReadLaterPanel(false);
            document.body.style.overflow = '';
          }}
          onOpenReader={(article) => {
            setShowReadLaterPanel(false);
            document.body.style.overflow = '';
            openReader(article);
          }}
          onRemove={removeFromReadLater}
          onReorder={reorderReadLater}
        />
      )}
    </main>
  );
}
