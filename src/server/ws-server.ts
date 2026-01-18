/**
 * WebSocket Server for Real-time Session Synchronization
 * 
 * This is a standalone WebSocket server that handles real-time
 * communication between Control and Display screens.
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { config } from 'dotenv';

config();

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Types
interface SessionState {
    slideIndex: number;
    blackoutMode: 'none' | 'black' | 'white';
    updatedAt: string;
}

interface WSMessage {
    type: string;
    sessionId: string;
    payload?: unknown;
}

interface Client {
    ws: WebSocket;
    sessionId: string;
    role: 'control' | 'display';
}

// Session rooms - map of sessionId to clients
const rooms = new Map<string, Set<Client>>();

// Session states - cached states for quick access
const sessionStates = new Map<string, SessionState>();

/**
 * Broadcast message to all clients in a session room
 */
function broadcastToRoom(sessionId: string, message: WSMessage, excludeWs?: WebSocket) {
    const room = rooms.get(sessionId);
    if (!room) return;

    const messageStr = JSON.stringify(message);
    room.forEach((client) => {
        if (client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(messageStr);
        }
    });
}

/**
 * Send message to a specific client
 */
function sendToClient(ws: WebSocket, message: WSMessage) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

/**
 * Handle WebSocket connection
 */
wss.on('connection', (ws: WebSocket) => {
    let clientInfo: Client | null = null;

    console.log('New WebSocket connection');

    ws.on('message', (data: Buffer) => {
        try {
            const message: WSMessage = JSON.parse(data.toString());
            console.log('Received:', message.type, message.sessionId);

            switch (message.type) {
                case 'SESSION_JOIN': {
                    const { sessionId, role, initialState } = message.payload as {
                        sessionId: string;
                        role: 'control' | 'display';
                        initialState?: SessionState;
                    };

                    // Create room if doesn't exist
                    if (!rooms.has(sessionId)) {
                        rooms.set(sessionId, new Set());
                    }

                    // Store initial state if provided
                    if (initialState && !sessionStates.has(sessionId)) {
                        sessionStates.set(sessionId, initialState);
                    }

                    // Add client to room
                    clientInfo = { ws, sessionId, role };
                    rooms.get(sessionId)!.add(clientInfo);

                    console.log(`Client joined session ${sessionId} as ${role}`);

                    // Send current state to the new client
                    const currentState = sessionStates.get(sessionId);
                    if (currentState) {
                        sendToClient(ws, {
                            type: 'SESSION_STATE',
                            sessionId,
                            payload: { state: currentState },
                        });
                    }

                    // Notify room of new participant
                    broadcastToRoom(
                        sessionId,
                        {
                            type: 'PARTICIPANT_JOINED',
                            sessionId,
                            payload: { role },
                        },
                        ws
                    );
                    break;
                }

                case 'SET_SLIDE_INDEX': {
                    const { sessionId, slideIndex } = message.payload as {
                        sessionId: string;
                        slideIndex: number;
                    };

                    // Update cached state
                    const state = sessionStates.get(sessionId) || {
                        slideIndex: 0,
                        blackoutMode: 'none' as const,
                        updatedAt: new Date().toISOString(),
                    };

                    state.slideIndex = slideIndex;
                    state.updatedAt = new Date().toISOString();
                    sessionStates.set(sessionId, state);

                    // Broadcast to all clients in room
                    broadcastToRoom(sessionId, {
                        type: 'SESSION_STATE',
                        sessionId,
                        payload: { state },
                    });

                    console.log(`Session ${sessionId}: slide index set to ${slideIndex}`);
                    break;
                }

                case 'SET_BLACKOUT': {
                    const { sessionId, blackoutMode } = message.payload as {
                        sessionId: string;
                        blackoutMode: 'none' | 'black' | 'white';
                    };

                    // Update cached state
                    const state = sessionStates.get(sessionId) || {
                        slideIndex: 0,
                        blackoutMode: 'none' as const,
                        updatedAt: new Date().toISOString(),
                    };

                    state.blackoutMode = blackoutMode;
                    state.updatedAt = new Date().toISOString();
                    sessionStates.set(sessionId, state);

                    // Broadcast to all clients in room
                    broadcastToRoom(sessionId, {
                        type: 'SESSION_STATE',
                        sessionId,
                        payload: { state },
                    });

                    console.log(`Session ${sessionId}: blackout mode set to ${blackoutMode}`);
                    break;
                }

                case 'HEARTBEAT': {
                    sendToClient(ws, {
                        type: 'HEARTBEAT',
                        sessionId: message.sessionId,
                        payload: { timestamp: Date.now() },
                    });
                    break;
                }

                default:
                    console.warn('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Error processing message:', error);
            sendToClient(ws, {
                type: 'ERROR',
                sessionId: '',
                payload: { error: 'Invalid message format' },
            });
        }
    });

    ws.on('close', () => {
        if (clientInfo) {
            const room = rooms.get(clientInfo.sessionId);
            if (room) {
                room.delete(clientInfo);
                if (room.size === 0) {
                    rooms.delete(clientInfo.sessionId);
                    // Keep state for a while in case of reconnection
                    // sessionStates.delete(clientInfo.sessionId);
                } else {
                    // Notify room of participant leaving
                    broadcastToRoom(clientInfo.sessionId, {
                        type: 'PARTICIPANT_LEFT',
                        sessionId: clientInfo.sessionId,
                        payload: { role: clientInfo.role },
                    });
                }
            }
            console.log(`Client left session ${clientInfo.sessionId}`);
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        rooms: rooms.size,
        connections: Array.from(rooms.values()).reduce((acc, room) => acc + room.size, 0),
    });
});

// Get session state endpoint (for reconnection)
app.get('/session/:sessionId/state', (req, res) => {
    const { sessionId } = req.params;
    const state = sessionStates.get(sessionId);

    if (state) {
        res.json({ success: true, state });
    } else {
        res.status(404).json({ success: false, error: 'Session not found' });
    }
});

const PORT = process.env.WS_PORT || 3001;

server.listen(PORT, () => {
    console.log(`WebSocket server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});
