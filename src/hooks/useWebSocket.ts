'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { WSMessage, SessionState, Deck } from '@/types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

interface UseWebSocketOptions {
    sessionId: string;
    role: 'control' | 'display';
    deck?: Deck;
    initialState?: SessionState;
    onStateChange?: (state: SessionState) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Error) => void;
}

export function useWebSocket({
    sessionId,
    role,
    deck,
    initialState,
    onStateChange,
    onConnect,
    onDisconnect,
    onError,
}: UseWebSocketOptions) {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [currentState, setCurrentState] = useState<SessionState | null>(initialState || null);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        try {
            const ws = new WebSocket(WS_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('WebSocket connected');
                setIsConnected(true);
                onConnect?.();

                // Join session
                const joinMessage: WSMessage = {
                    type: 'SESSION_JOIN',
                    sessionId,
                    payload: {
                        sessionId,
                        role,
                        initialState: initialState || {
                            slideIndex: 0,
                            blackoutMode: 'none',
                            updatedAt: new Date().toISOString(),
                        },
                    },
                };
                ws.send(JSON.stringify(joinMessage));

                // Start heartbeat
                heartbeatIntervalRef.current = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'HEARTBEAT',
                            sessionId,
                        }));
                    }
                }, 30000); // Every 30 seconds
            };

            ws.onmessage = (event) => {
                try {
                    const message: WSMessage = JSON.parse(event.data);

                    if (message.type === 'SESSION_STATE') {
                        const { state } = message.payload as { state: SessionState };
                        setCurrentState(state);
                        onStateChange?.(state);
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            ws.onclose = () => {
                console.log('WebSocket disconnected');
                setIsConnected(false);
                onDisconnect?.();

                // Clear heartbeat
                if (heartbeatIntervalRef.current) {
                    clearInterval(heartbeatIntervalRef.current);
                }

                // Attempt reconnection
                reconnectTimeoutRef.current = setTimeout(() => {
                    console.log('Attempting reconnection...');
                    connect();
                }, 3000);
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                onError?.(new Error('WebSocket connection error'));
            };
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            onError?.(error as Error);
        }
    }, [sessionId, role, initialState, onConnect, onDisconnect, onStateChange, onError]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
    }, []);

    const setSlideIndex = useCallback((slideIndex: number) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            const message: WSMessage = {
                type: 'SET_SLIDE_INDEX',
                sessionId,
                payload: { sessionId, slideIndex },
            };
            wsRef.current.send(JSON.stringify(message));
        }
    }, [sessionId]);

    const setBlackout = useCallback((blackoutMode: 'none' | 'black' | 'white') => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            const message: WSMessage = {
                type: 'SET_BLACKOUT',
                sessionId,
                payload: { sessionId, blackoutMode },
            };
            wsRef.current.send(JSON.stringify(message));
        }
    }, [sessionId]);

    useEffect(() => {
        connect();
        return () => {
            disconnect();
        };
    }, [connect, disconnect]);

    return {
        isConnected,
        currentState,
        setSlideIndex,
        setBlackout,
        reconnect: connect,
        disconnect,
    };
}
