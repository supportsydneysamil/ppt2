'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Deck } from '@/types';
import { delegateFullscreenWhenReady, prepareDisplayWindow } from '@/lib/display-window';
import { createPresentationSession } from '@/lib/session-launch';
import { cloneSlides } from '@/lib/slides';

export default function HomePage() {
  const router = useRouter();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDecks() {
      try {
        const res = await fetch('/api/decks');
        const data = await res.json();
        if (data.success) {
          setDecks(data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch decks:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDecks();
  }, []);

  const visibleDecks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return decks;
    return decks.filter((deck) => deck.title.toLowerCase().includes(q));
  }, [decks, query]);

  const createNewDeck = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '새 프레젠테이션' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.data?.id) {
        throw new Error(data.error || 'Failed to create deck');
      }
      router.push(`/editor/${data.data.id}`);
    } catch (err) {
      console.error('Failed to create deck:', err);
      setError('프레젠테이션을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.');
      setCreating(false);
    }
  };

  const deleteDeck = async (deckId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('이 프레젠테이션을 삭제하시겠습니까?')) return;

    try {
      await fetch(`/api/decks/${deckId}`, { method: 'DELETE' });
      setDecks((prev) => prev.filter((d) => d.id !== deckId));
    } catch (err) {
      console.error('Failed to delete deck:', err);
    }
  };

  const duplicateDeck = async (deck: Deck, e: React.MouseEvent) => {
    e.stopPropagation();
    if (busyId) return;
    setBusyId(deck.id);
    setError(null);
    try {
      const res = await fetch('/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${deck.title} 복사`,
          settings: deck.settings,
          slides: cloneSlides(deck.slides),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.data) throw new Error(data.error);
      setDecks((prev) => [data.data as Deck, ...prev]);
    } catch (err) {
      console.error('Failed to duplicate deck:', err);
      setError('복제하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusyId(null);
    }
  };

  const startDeck = async (deckId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (busyId) return;
    setBusyId(deckId);
    setError(null);
    const display = prepareDisplayWindow();
    delegateFullscreenWhenReady(display.popup);
    try {
      const session = await createPresentationSession(deckId);
      let placement = await display.placement;
      if (!display.show(session.id) && placement !== 'blocked') placement = 'closed';
      router.push(`/present/${session.id}/control?display=${placement}`);
    } catch (err) {
      display.popup?.close();
      console.error('Failed to start presentation:', err);
      setError('프레젠테이션을 시작하지 못했습니다. 다시 시도해 주세요.');
      setBusyId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="container" style={{ paddingTop: '48px', paddingBottom: '48px' }}>
      {/* Header */}
      <header style={{ marginBottom: '48px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '16px' }}>
          ⛪ 교회 프레젠테이션
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '18px', maxWidth: '600px', margin: '0 auto' }}>
          예배를 위한 프레젠테이션을 제작하고, 듀얼 스크린으로 송출하세요.
        </p>
      </header>

      {/* Create New Button */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '48px' }}>
        <button
          className="btn btn-primary btn-lg"
          onClick={createNewDeck}
          disabled={creating}
          style={{ padding: '16px 32px', fontSize: '18px' }}
          aria-label="Create new presentation"
        >
          {creating ? '만드는 중...' : '✨ 새 프레젠테이션 만들기'}
        </button>
      </div>

      {error && (
        <p role="alert" style={{ textAlign: 'center', marginBottom: '24px', color: 'var(--color-error, #ef4444)' }}>
          {error}
        </p>
      )}

      {/* Deck List */}
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '16px', color: 'var(--color-text-secondary)' }}>
          내 프레젠테이션
        </h2>
        {decks.length > 0 && (
          <input
            type="search"
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목 검색"
            aria-label="프레젠테이션 검색"
            style={{ marginBottom: '16px', width: '100%' }}
          />
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)' }}>
            로딩 중...
          </div>
        ) : decks.length === 0 ? (
          <div
            className="card"
            style={{
              textAlign: 'center',
              padding: '48px',
              color: 'var(--color-text-muted)',
              border: '2px dashed var(--border-color)',
              background: 'transparent',
            }}
          >
            <p style={{ marginBottom: '16px' }}>아직 프레젠테이션이 없습니다.</p>
            <button className="btn btn-secondary" onClick={createNewDeck} disabled={creating}>
              {creating ? '만드는 중...' : '첫 번째 프레젠테이션 만들기'}
            </button>
          </div>
        ) : visibleDecks.length === 0 ? (
          <div
            className="card"
            style={{
              textAlign: 'center',
              padding: '48px',
              color: 'var(--color-text-muted)',
              border: '2px dashed var(--border-color)',
              background: 'transparent',
            }}
          >
            <p>검색 결과가 없습니다.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-md">
            {visibleDecks.map((deck) => (
              <div
                key={deck.id}
                className="card"
                style={{
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
                onClick={() => router.push(`/editor/${deck.id}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-accent)';
                  e.currentTarget.style.transform = 'translateX(4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.transform = 'translateX(0)';
                }}
                role="button"
                tabIndex={0}
                aria-label={`${deck.title} 편집`}
              >
                <div className="flex justify-between items-center" style={{ gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>
                      {deck.title}
                    </h3>
                    <p style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
                      {deck.slides.length}개 슬라이드 · {formatDate(deck.updatedAt)}
                    </p>
                  </div>
                  <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-primary"
                      onClick={(e) => startDeck(deck.id, e)}
                      disabled={busyId === deck.id}
                      aria-label="프레젠테이션 시작"
                    >
                      ▶ 송출
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={(e) => duplicateDeck(deck, e)}
                      disabled={busyId === deck.id}
                      aria-label="복제"
                    >
                      복제
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/api/decks/${deck.id}/export/pptx`, '_blank');
                      }}
                      aria-label="PPTX 다운로드"
                    >
                      PPTX
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={(e) => deleteDeck(deck.id, e)}
                      aria-label="삭제"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Features */}
      <div style={{ marginTop: '80px', maxWidth: '1000px', margin: '80px auto 0' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '32px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          주요 기능
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
          }}
        >
          <FeatureCard
            icon="📺"
            title="듀얼 스크린 송출"
            description="프로젝터/TV용 Display 화면과 운영자용 Control 화면을 분리하여 운영할 수 있습니다."
          />
          <FeatureCard
            icon="🔤"
            title="자동 폰트 크기"
            description="텍스트 양에 따라 자동으로 폰트 크기가 조절되어 항상 최적의 가독성을 제공합니다."
          />
          <FeatureCard
            icon="🌐"
            title="한영 동시 표시"
            description="성경 구절이나 찬양 가사를 한국어와 영어로 동시에 표시할 수 있습니다."
          />
          <FeatureCard
            icon="📥"
            title="PPTX 내보내기"
            description="제작한 프레젠테이션을 PowerPoint 파일로 다운로드할 수 있습니다."
          />
          <FeatureCard
            icon="⏱️"
            title="예배 타이머"
            description="예배 시작 후 경과 시간을 측정하여 시간 관리에 도움을 줍니다."
          />
          <FeatureCard
            icon="⚡"
            title="실시간 동기화"
            description="Control 화면의 조작이 Display 화면에 즉시 반영됩니다."
          />
        </div>
      </div>

      {/* Footer */}
      <footer style={{ marginTop: '80px', textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)', fontSize: '14px' }}>
        교회 예배를 위한 프레젠테이션 도구
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '36px', marginBottom: '12px' }}>{icon}</div>
      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>{title}</h3>
      <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{description}</p>
    </div>
  );
}
