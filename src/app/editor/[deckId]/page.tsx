'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { v4 as uuidv4 } from 'uuid';
import { Deck, Slide, SlideType, SplitMode } from '@/types';
import { delegateFullscreenWhenReady, prepareDisplayWindow } from '@/lib/display-window';
import { createPresentationSession } from '@/lib/session-launch';
import {
    createSlide,
    insertSlidesAfter,
    slidePreviewText,
    slideTypeLabel,
    slidesFromStanzas,
} from '@/lib/slides';

// Dynamically import SlideRenderer to avoid SSR issues
const SlideRenderer = dynamic(() => import('@/components/SlideRenderer'), { ssr: false });

interface EditorPageProps {
    params: Promise<{ deckId: string }>;
}

export default function EditorPage({ params }: EditorPageProps) {
    const { deckId } = use(params);
    const router = useRouter();

    const [deck, setDeck] = useState<Deck | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [starting, setStarting] = useState(false);
    const [startError, setStartError] = useState<string | null>(null);
    const [bulkType, setBulkType] = useState<'lyrics' | 'bible'>('lyrics');
    const [bulkKorean, setBulkKorean] = useState('');
    const [bulkEnglish, setBulkEnglish] = useState('');
    const [bulkReference, setBulkReference] = useState('');
    const [bulkError, setBulkError] = useState<string | null>(null);

    // Fetch deck data
    useEffect(() => {
        async function fetchDeck() {
            try {
                const res = await fetch(`/api/decks/${deckId}`);
                const data = await res.json();

                if (data.success && data.data) {
                    setDeck(data.data);
                } else {
                    setError(data.error || 'Failed to load presentation');
                }
            } catch (err) {
                setError('Failed to load presentation');
                console.error(err);
            } finally {
                setLoading(false);
            }
        }

        fetchDeck();
    }, [deckId]);

    // Auto-save with debounce
    const saveDeck = useCallback(async () => {
        if (!deck || saving) return;

        setSaving(true);
        try {
            await fetch(`/api/decks/${deckId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: deck.title,
                    settings: deck.settings,
                    slides: deck.slides,
                }),
            });
            setSaved(true);
        } catch (err) {
            console.error('Failed to save:', err);
        } finally {
            setSaving(false);
        }
    }, [deck, deckId, saving]);

    // Debounced save
    useEffect(() => {
        if (saved || starting) return;
        const timer = setTimeout(saveDeck, 1000);
        return () => clearTimeout(timer);
    }, [saved, saveDeck, starting]);

    useEffect(() => {
        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            if (saved) return;
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [saved]);

    // Mark as unsaved when deck changes
    const updateDeck = useCallback((updates: Partial<Deck>) => {
        setDeck((prev) => {
            if (!prev) return prev;
            return { ...prev, ...updates };
        });
        setSaved(false);
    }, []);

    // Update slide
    const updateSlide = useCallback((slideId: string, updates: Partial<Slide>) => {
        setDeck((prev) => {
            if (!prev) return prev;
            const slides = prev.slides.map((slide) =>
                slide.id === slideId ? { ...slide, ...updates } : slide
            );
            return { ...prev, slides };
        });
        setSaved(false);
    }, []);

    const addIncomingSlides = useCallback((incoming: Slide[]) => {
        if (incoming.length === 0) return;
        setDeck((prev) => {
            if (!prev) return prev;
            const after = prev.slides.length === 0 ? -1 : selectedSlideIndex;
            return { ...prev, slides: insertSlidesAfter(prev.slides, after, incoming) };
        });
        setSelectedSlideIndex(!deck || deck.slides.length === 0 ? 0 : selectedSlideIndex + 1);
        setSaved(false);
    }, [deck, selectedSlideIndex]);

    const addSlide = useCallback((type: SlideType) => {
        addIncomingSlides([createSlide(type)]);
    }, [addIncomingSlides]);

    const importStanzas = useCallback(() => {
        const incoming = slidesFromStanzas({
            type: bulkType,
            korean: bulkKorean,
            english: bulkEnglish,
            reference: bulkType === 'bible' ? bulkReference.trim() : undefined,
        });
        if (incoming.length === 0) {
            setBulkError('빈 줄로 구분된 가사를 입력해 주세요.');
            return;
        }
        setBulkError(null);
        addIncomingSlides(incoming);
        setBulkKorean('');
        setBulkEnglish('');
        setBulkReference('');
    }, [addIncomingSlides, bulkEnglish, bulkKorean, bulkReference, bulkType]);

    // Delete slide
    const deleteSlide = useCallback((slideId: string) => {
        if (!confirm('이 슬라이드를 삭제하시겠습니까?')) return;
        setDeck((prev) => {
            if (!prev) return prev;
            const slides = prev.slides.filter((s) => s.id !== slideId);
            return { ...prev, slides };
        });
        setSelectedSlideIndex((i) => Math.max(0, i - 1));
        setSaved(false);
    }, []);

    // Duplicate slide
    const duplicateSlide = useCallback((slideId: string) => {
        setDeck((prev) => {
            if (!prev) return prev;
            const index = prev.slides.findIndex((s) => s.id === slideId);
            if (index === -1) return prev;

            const newSlide = {
                ...prev.slides[index],
                id: uuidv4(),
            };
            const slides = [
                ...prev.slides.slice(0, index + 1),
                newSlide,
                ...prev.slides.slice(index + 1),
            ];
            return { ...prev, slides };
        });
        setSaved(false);
    }, []);

    // Drag and drop handlers
    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (draggedIndex === null || !deck) return;

        const slides = [...deck.slides];
        const [removed] = slides.splice(draggedIndex, 1);
        slides.splice(dropIndex, 0, removed);

        setDeck({ ...deck, slides });
        setSelectedSlideIndex(dropIndex);
        setDraggedIndex(null);
        setSaved(false);
    };

    // Start presentation
    const startPresentation = async () => {
        if (starting || !deck) return;
        setStarting(true);
        setStartError(null);
        const display = prepareDisplayWindow();
        delegateFullscreenWhenReady(display.popup);
        try {
            const saveResponse = await fetch(`/api/decks/${deckId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: deck.title, settings: deck.settings, slides: deck.slides }),
            });
            const saveResult = await saveResponse.json();
            if (!saveResponse.ok || !saveResult.success) throw new Error('Failed to save deck');
            const session = await createPresentationSession(deckId);
            let placement = await display.placement;
            if (!display.show(session.id) && placement !== 'blocked') placement = 'closed';
            router.push(`/present/${session.id}/control?display=${placement}`);
        } catch (err) {
            display.popup?.close();
            setStartError('프레젠테이션을 시작하지 못했습니다. 다시 시도해 주세요.');
            setStarting(false);
            console.error('Failed to create session:', err);
        }
    };

    // Export PPTX
    const exportPptx = async () => {
        try {
            const res = await fetch(`/api/decks/${deckId}/export/pptx`);
            const blob = await res.blob();

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${deck?.title || 'presentation'}.pptx`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to export PPTX:', err);
        }
    };

    if (loading) {
        return (
            <div className="editor-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div>불러오는 중...</div>
            </div>
        );
    }

    if (error || !deck) {
        return (
            <div className="editor-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div>{error || 'Presentation not found'}</div>
            </div>
        );
    }

    const selectedSlide = deck.slides[selectedSlideIndex];

    return (
        <div className="editor-layout">
            {/* Header */}
            <div className="editor-header">
                <div className="flex items-center gap-md">
                    <a href="/" className="btn btn-icon btn-secondary" aria-label="Go to home">
                        ←
                    </a>
                    <input
                        type="text"
                        className="input"
                        style={{ width: '300px', fontSize: '18px', fontWeight: 600 }}
                        value={deck.title}
                        onChange={(e) => updateDeck({ title: e.target.value })}
                        aria-label="Presentation title"
                    />
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {saving ? '저장 중...' : saved ? '✓ 저장됨' : '● 저장 대기'}
                    </span>
                    <label className="flex items-center gap-sm" style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        배경
                        <input
                            type="color"
                            value={deck.settings.theme.bgColor}
                            onChange={(e) =>
                                updateDeck({
                                    settings: {
                                        ...deck.settings,
                                        theme: { ...deck.settings.theme, bgColor: e.target.value },
                                    },
                                })
                            }
                            aria-label="배경색"
                        />
                    </label>
                    <label className="flex items-center gap-sm" style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        글자
                        <input
                            type="color"
                            value={deck.settings.theme.textColor}
                            onChange={(e) =>
                                updateDeck({
                                    settings: {
                                        ...deck.settings,
                                        theme: { ...deck.settings.theme, textColor: e.target.value },
                                    },
                                })
                            }
                            aria-label="글자색"
                        />
                    </label>
                </div>
                <div className="flex items-center gap-md">
                    <button className="btn btn-secondary" onClick={exportPptx} aria-label="Export as PPTX">
                        📥 PPTX 다운로드
                    </button>
                    {startError && <span role="alert">{startError}</span>}
                    <button className="btn btn-primary" onClick={startPresentation} disabled={starting || saving} aria-label="Start presentation">
                        {starting ? '송출 준비 중...' : '▶ 프레젠테이션 시작'}
                    </button>
                </div>
            </div>

            {/* Sidebar - Slide List */}
            <div className="editor-sidebar">
                <div className="flex justify-between items-center" style={{ padding: '0 8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {deck.slides.length}개 슬라이드
                    </span>
                </div>

                {/* Slide thumbnails */}
                <div className="flex flex-col gap-sm">
                    {deck.slides.map((slide, index) => (
                        <div
                            key={slide.id}
                            className={`slide-thumbnail drag-item ${index === selectedSlideIndex ? 'active' : ''} ${draggedIndex === index ? 'dragging' : ''}`}
                            onClick={() => setSelectedSlideIndex(index)}
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDrop={(e) => handleDrop(e, index)}
                            role="button"
                            tabIndex={0}
                            aria-label={`Slide ${index + 1}`}
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
                                    right: 4,
                                    fontSize: '10px',
                                    backgroundColor: 'rgba(0,0,0,0.75)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    lineHeight: 1.3,
                                }}
                            >
                                {index + 1} · {slideTypeLabel(slide.type)}
                                {slidePreviewText(slide, 18) ? ` · ${slidePreviewText(slide, 18)}` : ''}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Add Slide Buttons */}
                <div className="card" style={{ marginTop: '16px', padding: '12px' }}>
                    <h4 style={{ fontSize: '12px', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
                        현재 슬라이드 뒤에 추가
                    </h4>
                    <div className="flex flex-col gap-sm">
                        <button className="btn btn-secondary" onClick={() => addSlide('title')} style={{ fontSize: '12px' }}>
                            + 제목 슬라이드
                        </button>
                        <button className="btn btn-secondary" onClick={() => addSlide('bible')} style={{ fontSize: '12px' }}>
                            + 성경 슬라이드
                        </button>
                        <button className="btn btn-secondary" onClick={() => addSlide('lyrics')} style={{ fontSize: '12px' }}>
                            + 가사 슬라이드
                        </button>
                        <button className="btn btn-secondary" onClick={() => addSlide('imageText')} style={{ fontSize: '12px' }}>
                            + 이미지+텍스트
                        </button>
                    </div>
                    <h4 style={{ fontSize: '12px', margin: '16px 0 8px', color: 'var(--color-text-secondary)' }}>
                        가사/성경 일괄 입력
                    </h4>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                        절과 절 사이를 빈 줄로 구분하면 슬라이드가 여러 장으로 나뉩니다.
                    </p>
                    <select
                        className="input select"
                        value={bulkType}
                        onChange={(e) => setBulkType(e.target.value as 'lyrics' | 'bible')}
                        style={{ fontSize: '12px', marginBottom: '8px' }}
                        aria-label="일괄 입력 유형"
                    >
                        <option value="lyrics">가사</option>
                        <option value="bible">성경</option>
                    </select>
                    <textarea
                        className="input textarea"
                        value={bulkKorean}
                        onChange={(e) => setBulkKorean(e.target.value)}
                        placeholder="한국어 (빈 줄로 절 구분)"
                        rows={4}
                        style={{ fontSize: '12px', marginBottom: '8px' }}
                    />
                    <textarea
                        className="input textarea"
                        value={bulkEnglish}
                        onChange={(e) => setBulkEnglish(e.target.value)}
                        placeholder="English (optional, blank line per verse)"
                        rows={3}
                        style={{ fontSize: '12px', marginBottom: '8px' }}
                    />
                    {bulkType === 'bible' && (
                        <input
                            type="text"
                            className="input"
                            value={bulkReference}
                            onChange={(e) => setBulkReference(e.target.value)}
                            placeholder="구절 (예: 요한복음 3:16)"
                            style={{ fontSize: '12px', marginBottom: '8px' }}
                        />
                    )}
                    {bulkError && (
                        <p role="alert" style={{ fontSize: '12px', color: 'var(--color-danger)', marginBottom: '8px' }}>
                            {bulkError}
                        </p>
                    )}
                    <button className="btn btn-primary" onClick={importStanzas} style={{ fontSize: '12px', width: '100%' }}>
                        절마다 슬라이드 만들기
                    </button>
                </div>
            </div>

            {/* Main - Slide Editor */}
            <div className="editor-main">
                {selectedSlide ? (
                    <SlideEditor
                        slide={selectedSlide}
                        settings={deck.settings}
                        onUpdate={(updates) => updateSlide(selectedSlide.id, updates)}
                        onDelete={() => deleteSlide(selectedSlide.id)}
                        onDuplicate={() => duplicateSlide(selectedSlide.id)}
                    />
                ) : (
                    <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)' }}>
                        슬라이드를 선택하거나 새로 추가하세요
                    </div>
                )}
            </div>
        </div>
    );
}

// Slide Editor Component
interface SlideEditorProps {
    slide: Slide;
    settings: Deck['settings'];
    onUpdate: (updates: Partial<Slide>) => void;
    onDelete: () => void;
    onDuplicate: () => void;
}

function SlideEditor({ slide, settings, onUpdate, onDelete, onDuplicate }: SlideEditorProps) {
    const updateContent = (updates: Partial<Slide['content']>) => {
        onUpdate({ content: { ...slide.content, ...updates } });
    };

    const updateLayout = (updates: Partial<Slide['layout']>) => {
        onUpdate({ layout: { ...slide.layout, ...updates } });
    };

    return (
        <div className="flex flex-col gap-lg">
            {/* Preview */}
            <div>
                <h3 style={{ marginBottom: '12px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                    미리보기
                </h3>
                <div
                    style={{
                        aspectRatio: '16/9',
                        maxWidth: '800px',
                        backgroundColor: settings.theme.bgColor,
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: '1px solid var(--border-color)',
                    }}
                >
                    <SlideRenderer slide={slide} settings={settings} style={{ width: '100%', height: '100%' }} />
                </div>
            </div>

            {/* Editor Form */}
            <div className="card">
                <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '16px' }}>슬라이드 편집</h3>
                    <div className="flex gap-sm">
                        <button className="btn btn-secondary" onClick={onDuplicate} aria-label="Duplicate slide">
                            복제
                        </button>
                        <button className="btn btn-danger" onClick={onDelete} aria-label="Delete slide">
                            삭제
                        </button>
                    </div>
                </div>

                {/* Slide Type */}
                <div className="form-group">
                    <label className="label">슬라이드 유형</label>
                    <select
                        className="input select"
                        value={slide.type}
                        onChange={(e) => onUpdate({ type: e.target.value as SlideType })}
                    >
                        <option value="title">제목</option>
                        <option value="bible">성경</option>
                        <option value="lyrics">가사</option>
                        <option value="imageText">이미지+텍스트</option>
                    </select>
                </div>

                {/* Title Slide */}
                {slide.type === 'title' && (
                    <div className="form-group">
                        <label className="label">제목</label>
                        <textarea
                            className="input textarea"
                            value={slide.content.title || ''}
                            onChange={(e) => updateContent({ title: e.target.value })}
                            placeholder="제목을 입력하세요"
                            rows={3}
                        />
                    </div>
                )}

                {/* Bible/Lyrics Slide */}
                {(slide.type === 'bible' || slide.type === 'lyrics') && (
                    <>
                        <div className="form-group">
                            <label className="label">표시 모드</label>
                            <select
                                className="input select"
                                value={slide.layout.splitMode || 'koEn'}
                                onChange={(e) => updateLayout({ splitMode: e.target.value as SplitMode })}
                            >
                                <option value="koOnly">한국어만</option>
                                <option value="enOnly">영어만</option>
                                <option value="koEn">한국어 + 영어</option>
                            </select>
                        </div>

                        {(slide.layout.splitMode === 'koOnly' || slide.layout.splitMode === 'koEn') && (
                            <div className="form-group">
                                <label className="label">한국어</label>
                                <textarea
                                    className="input textarea"
                                    value={slide.content.korean || ''}
                                    onChange={(e) => updateContent({ korean: e.target.value })}
                                    placeholder="한국어 텍스트를 입력하세요"
                                    rows={4}
                                />
                            </div>
                        )}

                        {(slide.layout.splitMode === 'enOnly' || slide.layout.splitMode === 'koEn') && (
                            <div className="form-group">
                                <label className="label">영어 (English)</label>
                                <textarea
                                    className="input textarea"
                                    value={slide.content.english || ''}
                                    onChange={(e) => updateContent({ english: e.target.value })}
                                    placeholder="Enter English text"
                                    rows={4}
                                />
                            </div>
                        )}

                        {slide.type === 'bible' && (
                            <div className="form-group">
                                <label className="label">성경 구절 (예: 요한복음 3:16)</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={slide.content.reference || ''}
                                    onChange={(e) => updateContent({ reference: e.target.value })}
                                    placeholder="요한복음 3:16"
                                />
                            </div>
                        )}
                    </>
                )}

                {/* ImageText Slide */}
                {slide.type === 'imageText' && (
                    <>
                        <div className="form-group">
                            <label className="label">텍스트</label>
                            <textarea
                                className="input textarea"
                                value={slide.content.body || ''}
                                onChange={(e) => updateContent({ body: e.target.value })}
                                placeholder="텍스트를 입력하세요"
                                rows={3}
                            />
                        </div>
                        <div className="form-group">
                            <label className="label">이미지 URL</label>
                            <input
                                type="text"
                                className="input"
                                value={slide.content.imageUrl || ''}
                                onChange={(e) => updateContent({ imageUrl: e.target.value })}
                                placeholder="https://..."
                            />
                        </div>
                    </>
                )}

                {/* Alignment */}
                <div className="form-group">
                    <label className="label">정렬</label>
                    <select
                        className="input select"
                        value={slide.layout.align}
                        onChange={(e) => updateLayout({ align: e.target.value as 'center' | 'left' })}
                    >
                        <option value="center">가운데</option>
                        <option value="left">왼쪽</option>
                    </select>
                </div>
            </div>
        </div>
    );
}

