'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { SlideRenderer } from '@/components/SlideRenderer';
import { Deck, SessionState, Slide } from '@/types';

interface DisplayPageProps {
    params: Promise<{ sessionId: string }>;
}

export default function DisplayPage({ params }: DisplayPageProps) {
    const { sessionId } = use(params);
    const [deck, setDeck] = useState<Deck | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentSlide, setCurrentSlide] = useState<Slide | null>(null);
    const [blackoutMode, setBlackoutMode] = useState<'none' | 'black' | 'white'>('none');

    // Fetch session data
    useEffect(() => {
        async function fetchSession() {
            try {
                const res = await fetch(`/api/sessions/${sessionId}`);
                const data = await res.json();

                if (data.success && data.data) {
                    setDeck(data.data.deck);
                    const initialState = data.data.state;
                    setCurrentSlide(data.data.deck.slides[initialState.slideIndex] || null);
                    setBlackoutMode(initialState.blackoutMode);
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
        if (deck) {
            setCurrentSlide(deck.slides[state.slideIndex] || null);
            setBlackoutMode(state.blackoutMode);
        }
    }, [deck]);

    // WebSocket connection
    const { isConnected } = useWebSocket({
        sessionId,
        role: 'display',
        deck: deck || undefined,
        onStateChange: handleStateChange,
    });

    // Keyboard shortcuts (optional for display)
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            // Display screen typically doesn't handle keyboard,
            // but we can add emergency controls if needed
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Request fullscreen on mount
    useEffect(() => {
        const requestFullscreen = async () => {
            try {
                if (document.documentElement.requestFullscreen) {
                    await document.documentElement.requestFullscreen();
                }
            } catch (e) {
                // Fullscreen might be denied by browser
                console.log('Fullscreen request denied');
            }
        };

        // Small delay to ensure page is loaded
        const timer = setTimeout(requestFullscreen, 500);
        return () => clearTimeout(timer);
    }, []);

    if (loading) {
        return (
            <div className="presentation-display" style={{ backgroundColor: '#000' }}>
                <div style={{ color: '#fff', fontSize: '24px' }}>Loading...</div>
            </div>
        );
    }

    if (error || !deck) {
        return (
            <div className="presentation-display" style={{ backgroundColor: '#000' }}>
                <div style={{ color: '#fff', fontSize: '24px' }}>{error || 'Session not found'}</div>
            </div>
        );
    }

    // Blackout overlay
    if (blackoutMode !== 'none') {
        return (
            <div
                className={`presentation-display blackout-${blackoutMode}`}
                style={{
                    backgroundColor: blackoutMode === 'black' ? '#000000' : '#ffffff',
                }}
            />
        );
    }

    if (!currentSlide) {
        return (
            <div
                className="presentation-display"
                style={{ backgroundColor: deck.settings.theme.bgColor }}
            />
        );
    }

    return (
        <div
            className="presentation-display"
            style={{
                backgroundColor: deck.settings.theme.bgColor,
                position: 'relative',
            }}
        >
            {/* Connection status indicator (subtle) */}
            {!isConnected && (
                <div
                    style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: '#f87171',
                        zIndex: 100,
                    }}
                    title="Disconnected - Attempting to reconnect..."
                />
            )}

            <SlideRenderer
                slide={currentSlide}
                settings={deck.settings}
                style={{ width: '100vw', height: '100vh' }}
            />
        </div>
    );
}
