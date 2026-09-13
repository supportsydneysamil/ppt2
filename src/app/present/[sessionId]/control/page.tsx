'use client';

import { useEffect, useState, useCallback, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { useWebSocket } from '@/hooks/useWebSocket';
import { SlideRenderer } from '@/components/SlideRenderer';
import { Deck, SessionState, BlackoutMode } from '@/types';
import { slidePreviewText } from '@/lib/slides';
import {
    DISPLAY_MESSAGES,
    DisplayPlacement,
    SCREEN_PERMISSION_MESSAGES,
    ScreenPermission,
    closeDisplayWindow,
    delegateFullscreenWhenReady,
    exitDisplayFullscreen,
    prepareDisplayWindow,
    readScreenPermission,
    requestDisplayFullscreen,
    requestScreenPermission,
    watchDisplayFullscreen,
} from '@/lib/display-window';

interface ControlPageProps {
    params: Promise<{ sessionId: string }>;
}

export default function ControlPage({ params }: ControlPageProps) {
    const { sessionId } = use(params);
    const router = useRouter();
    const [deck, setDeck] = useState<Deck | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [slideIndex, setSlideIndex] = useState(0);
    const [blackoutMode, setBlackoutModeState] = useState<BlackoutMode>('none');
    const [displayMessage, setDisplayMessage] = useState('');
    const [openingDisplay, setOpeningDisplay] = useState(false);
    const [screenPermission, setScreenPermission] = useState<ScreenPermission>('unavailable');
    const [displayFullscreen, setDisplayFullscreen] = useState(false);

    useEffect(() => watchDisplayFullscreen(setDisplayFullscreen), []);

    useEffect(() => {
        const status = new URLSearchParams(window.location.search).get('display');
        if (status && Object.prototype.hasOwnProperty.call(DISPLAY_MESSAGES, status)) {
            setDisplayMessage(DISPLAY_MESSAGES[status as DisplayPlacement]);
        }
        readScreenPermission().then((permission) => {
            setScreenPermission(permission);
            if (permission === 'prompt') setDisplayMessage(SCREEN_PERMISSION_MESSAGES.prompt);
        });
    }, []);

    // Timer state
    const [timerRunning, setTimerRunning] = useState(false);
    const [timerSeconds, setTimerSeconds] = useState(0);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [notes, setNotes] = useState('');
    const [notesSaved, setNotesSaved] = useState(true);

    // Fetch session data
    useEffect(() => {
        async function fetchSession() {
            try {
                const res = await fetch(`/api/sessions/${sessionId}`);
                const data = await res.json();

                if (data.success && data.data) {
                    setDeck(data.data.deck);
                    const initialState = data.data.state;
                    setSlideIndex(initialState.slideIndex);
                    setBlackoutModeState(initialState.blackoutMode);
                    setNotes(data.data.notes || '');
                } else {
                    setError(data.error || 'Failed to load session');
                }
            } catch (err) {
                setError('Failed to load session');
                console.error(err);
            } finally {
                setLoading(false);
            }
        }

        fetchSession();
    }, [sessionId]);

    // Handle state changes from WebSocket
    const handleStateChange = useCallback((state: SessionState) => {
        setSlideIndex(state.slideIndex);
        setBlackoutModeState(state.blackoutMode);
    }, []);

    // WebSocket connection
    const { isConnected, setSlideIndex: wsSetSlideIndex, setBlackout: wsSetBlackout } = useWebSocket({
        sessionId,
        role: 'control',
        deck: deck || undefined,
        onStateChange: handleStateChange,
    });

    // Navigation functions
    const goToSlide = useCallback((index: number) => {
        if (!deck) return;
        const newIndex = Math.max(0, Math.min(index, deck.slides.length - 1));
        setSlideIndex(newIndex);
        wsSetSlideIndex(newIndex);
        // Also update on server
        fetch(`/api/sessions/${sessionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: { slideIndex: newIndex } }),
        });
    }, [deck, wsSetSlideIndex, sessionId]);

    const nextSlide = useCallback(() => {
        goToSlide(slideIndex + 1);
    }, [goToSlide, slideIndex]);

    const prevSlide = useCallback(() => {
        goToSlide(slideIndex - 1);
    }, [goToSlide, slideIndex]);

    const toggleBlackout = useCallback((mode: BlackoutMode) => {
        const newMode = blackoutMode === mode ? 'none' : mode;
        setBlackoutModeState(newMode);
        wsSetBlackout(newMode);
        // Also update on server
        fetch(`/api/sessions/${sessionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: { blackoutMode: newMode } }),
        });
    }, [blackoutMode, wsSetBlackout, sessionId]);

    // Timer functions
    const startTimer = () => {
        setTimerRunning(true);
    };

    const stopTimer = () => {
        setTimerRunning(false);
    };

    const resetTimer = () => {
        setTimerRunning(false);
        setTimerSeconds(0);
    };

    useEffect(() => {
        if (timerRunning) {
            timerIntervalRef.current = setInterval(() => {
                setTimerSeconds((s) => s + 1);
            }, 1000);
        } else {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        }
        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        };
    }, [timerRunning]);

    useEffect(() => {
        if (notesSaved) return;
        const timer = setTimeout(async () => {
            try {
                await fetch(`/api/sessions/${sessionId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notes }),
                });
                setNotesSaved(true);
            } catch (err) {
                console.error('Failed to save notes:', err);
            }
        }, 600);
        return () => clearTimeout(timer);
    }, [notes, notesSaved, sessionId]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Keyboard shortcuts
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
                return;
            }

            switch (e.key) {
                case 'ArrowRight':
                case ' ':
                case 'Enter':
                    e.preventDefault();
                    nextSlide();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    prevSlide();
                    break;
                case 'b':
                case 'B':
                    e.preventDefault();
                    toggleBlackout('black');
                    break;
                case 'w':
                case 'W':
                    e.preventDefault();
                    toggleBlackout('white');
                    break;
                case 'Escape':
                    e.preventDefault();
                    if (blackoutMode !== 'none') toggleBlackout(blackoutMode);
                    break;
                case 'Home':
                    e.preventDefault();
                    goToSlide(0);
                    break;
                case 'End':
                    e.preventDefault();
                    if (deck) goToSlide(deck.slides.length - 1);
                    break;
            }
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [nextSlide, prevSlide, toggleBlackout, goToSlide, deck, blackoutMode]);

    // Open display window
    const openDisplay = async () => {
        if (openingDisplay) return;
        setOpeningDisplay(true);
        const display = prepareDisplayWindow();
        delegateFullscreenWhenReady(display.popup);
        let placement = await display.placement;
        if (!display.show(sessionId) && placement !== 'blocked') placement = 'closed';
        setDisplayMessage(DISPLAY_MESSAGES[placement]);
        setOpeningDisplay(false);
    };

    const toggleDisplayFullscreen = () => {
        const missing = '송출 창을 찾을 수 없습니다. Display 열기를 눌러 주세요.';
        if (displayFullscreen) {
            setDisplayMessage(exitDisplayFullscreen() ? '송출 창을 창 모드로 전환했습니다.' : missing);
            return;
        }
        setDisplayMessage(requestDisplayFullscreen() ? '송출 창을 전체 화면으로 전환했습니다.' : missing);
    };

    const endPresentation = async () => {
        if (!confirm('송출을 종료하고 편집 화면으로 돌아가시겠습니까?')) return;
        closeDisplayWindow();
        try {
            await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
        } catch (err) {
            console.error('Failed to delete session:', err);
        }
        router.push(`/editor/${deck?.id ?? ''}`);
    };

    // Keep the button available for a retry when the prompt is dismissed.
    const allowScreenAccess = async () => {
        const granted = await requestScreenPermission();
        setScreenPermission(granted ? 'granted' : 'prompt');
        setDisplayMessage(granted ? SCREEN_PERMISSION_MESSAGES.granted : DISPLAY_MESSAGES.denied);
    };

    if (loading) {
        return (
            <div className="control-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: '#fff', fontSize: '24px' }}>불러오는 중...</div>
            </div>
        );
    }

    if (error || !deck) {
        return (
            <div className="control-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: '#fff', fontSize: '24px' }}>{error || '세션을 찾을 수 없습니다'}</div>
            </div>
        );
    }

    const currentSlide = deck.slides[slideIndex];
    const nextSlideData = deck.slides[slideIndex + 1];

    return (
        <div className="control-panel">
            {/* Header */}
            <div className="control-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
                <div className="flex items-center gap-md">
                    <h1 style={{ fontSize: '20px', fontWeight: 600 }}>{deck.title}</h1>
                    <div className="flex items-center gap-sm">
                        <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
                        <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                            {isConnected ? '연결됨' : '연결 끊김 · 재시도 중'}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-md">
                    {screenPermission === 'prompt' && (
                        <button className="btn btn-secondary" onClick={allowScreenAccess} aria-label="Allow window management">
                            🖥 모니터 권한 허용
                        </button>
                    )}
                    <button className="btn btn-primary" onClick={openDisplay} disabled={openingDisplay} aria-label="Open display window">
                        {openingDisplay ? '송출 준비 중...' : '📺 Display 열기'}
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={toggleDisplayFullscreen}
                        aria-pressed={displayFullscreen}
                        aria-label={displayFullscreen ? '송출 창 창 모드' : '송출 창 전체 화면'}
                    >
                        {displayFullscreen ? '🗗 송출 창 모드' : '⛶ 송출 전체 화면'}
                    </button>
                    <a href={`/editor/${deck.id}`} className="btn btn-secondary" aria-label="Edit presentation">
                        ✏️ 편집
                    </a>
                    <button className="btn btn-danger" onClick={endPresentation} aria-label="송출 종료">
                        ■ 송출 종료
                    </button>
                </div>
                {displayMessage && <p role="status" style={{ flexBasis: '100%', margin: 0 }}>{displayMessage}</p>}
            </div>

            {/* Slide List */}
            <div className="control-slides">
                <div className="flex flex-col gap-sm" style={{ padding: '8px' }}>
                    {deck.slides.map((slide, index) => (
                        <div
                            key={slide.id}
                            className={`slide-thumbnail ${index === slideIndex ? 'active' : ''}`}
                            onClick={() => goToSlide(index)}
                            role="button"
                            tabIndex={0}
                            aria-label={`Go to slide ${index + 1}`}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    goToSlide(index);
                                }
                            }}
                        >
                            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                                <SlideRenderer
                                    slide={slide}
                                    settings={deck.settings}
                                    isPreview
                                    style={{ position: 'absolute', inset: 0 }}
                                />
                            </div>
                            <div
                                style={{
                                    position: 'absolute',
                                    bottom: 4,
                                    left: 4,
                                    fontSize: '10px',
                                    backgroundColor: 'rgba(0,0,0,0.7)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                }}
                            >
                                {index + 1}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Preview */}
            <div className="control-preview">
                <div>
                    <h3 style={{ marginBottom: '8px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                        현재 슬라이드 ({slideIndex + 1}/{deck.slides.length})
                    </h3>
                    <div
                        style={{
                            aspectRatio: '16/9',
                            backgroundColor: deck.settings.theme.bgColor,
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '2px solid var(--color-accent)',
                        }}
                    >
                        {currentSlide && (
                            <SlideRenderer
                                slide={currentSlide}
                                settings={deck.settings}
                                isPreview
                                style={{ width: '100%', height: '100%' }}
                            />
                        )}
                    </div>
                </div>

                <div>
                    <h3 style={{ marginBottom: '8px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                        다음 슬라이드
                        {nextSlideData && slidePreviewText(nextSlideData, 28) ? (
                            <span style={{ marginLeft: 8, fontWeight: 400 }}>
                                {slidePreviewText(nextSlideData, 28)}
                            </span>
                        ) : null}
                    </h3>
                    <div
                        style={{
                            aspectRatio: '16/9',
                            backgroundColor: nextSlideData ? deck.settings.theme.bgColor : 'var(--color-bg-tertiary)',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '1px solid var(--border-color)',
                            opacity: nextSlideData ? 1 : 0.5,
                        }}
                    >
                        {nextSlideData ? (
                            <SlideRenderer
                                slide={nextSlideData}
                                settings={deck.settings}
                                isPreview
                                style={{ width: '100%', height: '100%' }}
                            />
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)' }}>
                                마지막 슬라이드
                            </div>
                        )}
                    </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex gap-md" style={{ marginTop: 'auto' }}>
                    <button
                        className="btn btn-lg btn-secondary"
                        onClick={prevSlide}
                        disabled={slideIndex === 0}
                        style={{ flex: 1 }}
                        aria-label="Previous slide"
                    >
                        ◀ 이전
                    </button>
                    <button
                        className="btn btn-lg btn-primary"
                        onClick={nextSlide}
                        disabled={slideIndex === deck.slides.length - 1}
                        style={{ flex: 1 }}
                        aria-label="Next slide"
                    >
                        다음 ▶
                    </button>
                </div>
            </div>

            {/* Actions */}
            <div className="control-actions">
                {/* Blackout Controls */}
                <div className="card">
                    <h3 style={{ marginBottom: '12px', fontSize: '14px' }}>화면 제어</h3>
                    <div className="flex gap-sm">
                        <button
                            className={`btn btn-lg ${blackoutMode === 'black' ? 'btn-danger' : 'btn-secondary'}`}
                            onClick={() => toggleBlackout('black')}
                            style={{ flex: 1 }}
                            aria-label="Toggle black screen"
                        >
                            ⬛ 검정
                        </button>
                        <button
                            className={`btn btn-lg ${blackoutMode === 'white' ? 'btn-success' : 'btn-secondary'}`}
                            onClick={() => toggleBlackout('white')}
                            style={{ flex: 1, color: blackoutMode === 'white' ? '#000' : undefined }}
                            aria-label="Toggle white screen"
                        >
                            ⬜ 흰색
                        </button>
                    </div>
                    {blackoutMode !== 'none' && (
                        <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--color-warning)', textAlign: 'center' }}>
                            화면이 {blackoutMode === 'black' ? '검은색' : '흰색'}으로 가려져 있습니다
                        </p>
                    )}
                </div>

                <div className="card">
                    <h3 style={{ marginBottom: '12px', fontSize: '14px' }}>운영 메모</h3>
                    <textarea
                        className="input textarea"
                        value={notes}
                        onChange={(e) => {
                            setNotes(e.target.value);
                            setNotesSaved(false);
                        }}
                        placeholder="다음 순서, 기도자, 큐를 적어 두세요"
                        rows={5}
                        aria-label="운영 메모"
                    />
                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 8 }}>
                        {notesSaved ? '저장됨' : '저장 중...'}
                    </p>
                </div>

                {/* Timer */}
                <div className="card">
                    <h3 style={{ marginBottom: '12px', fontSize: '14px' }}>타이머</h3>
                    <div className="timer" style={{ textAlign: 'center', marginBottom: '12px' }}>
                        {formatTime(timerSeconds)}
                    </div>
                    <div className="flex gap-sm">
                        {!timerRunning ? (
                            <button
                                className="btn btn-success"
                                onClick={startTimer}
                                style={{ flex: 1 }}
                                aria-label="Start timer"
                            >
                                ▶ 시작
                            </button>
                        ) : (
                            <button
                                className="btn btn-warning"
                                onClick={stopTimer}
                                style={{ flex: 1, color: '#000' }}
                                aria-label="Stop timer"
                            >
                                ⏸ 정지
                            </button>
                        )}
                        <button
                            className="btn btn-secondary"
                            onClick={resetTimer}
                            style={{ flex: 1 }}
                            aria-label="Reset timer"
                        >
                            ↺ 리셋
                        </button>
                    </div>
                </div>

                {/* Keyboard Shortcuts */}
                <div className="card" style={{ marginTop: 'auto' }}>
                    <h3 style={{ marginBottom: '8px', fontSize: '14px' }}>단축키</h3>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
                        <div><kbd style={{ backgroundColor: 'var(--color-bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>→</kbd> / <kbd style={{ backgroundColor: 'var(--color-bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>Space</kbd> 다음 슬라이드</div>
                        <div><kbd style={{ backgroundColor: 'var(--color-bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>←</kbd> 이전 슬라이드</div>
                        <div><kbd style={{ backgroundColor: 'var(--color-bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>B</kbd> 검정 화면</div>
                        <div><kbd style={{ backgroundColor: 'var(--color-bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>W</kbd> 흰색 화면</div>
                        <div><kbd style={{ backgroundColor: 'var(--color-bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>Esc</kbd> 가림 해제</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
