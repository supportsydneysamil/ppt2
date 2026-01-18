import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Session, SessionState, Deck, DeckSettings, Slide, DEFAULT_SESSION_STATE, ApiResponse } from '@/types';

// POST /api/sessions - Create a new session for a deck
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { deckId } = body;

        if (!deckId) {
            return NextResponse.json<ApiResponse<Session>>(
                { success: false, error: 'deckId is required' },
                { status: 400 }
            );
        }

        // Verify deck exists
        const deck = await prisma.deck.findUnique({
            where: { id: deckId },
        });

        if (!deck) {
            return NextResponse.json<ApiResponse<Session>>(
                { success: false, error: 'Deck not found' },
                { status: 404 }
            );
        }

        const initialState: SessionState = {
            ...DEFAULT_SESSION_STATE,
            updatedAt: new Date().toISOString(),
        };

        const session = await prisma.session.create({
            data: {
                deckId,
                state: JSON.stringify(initialState),
            },
        });

        const parsedSession: Session = {
            id: session.id,
            deckId: session.deckId,
            state: JSON.parse(session.state) as SessionState,
            notes: session.notes || undefined,
            createdAt: session.createdAt.toISOString(),
            updatedAt: session.updatedAt.toISOString(),
        };

        return NextResponse.json<ApiResponse<Session>>({
            success: true,
            data: parsedSession,
        });
    } catch (error) {
        console.error('Error creating session:', error);
        return NextResponse.json<ApiResponse<Session>>(
            { success: false, error: 'Failed to create session' },
            { status: 500 }
        );
    }
}

// GET /api/sessions - List all sessions (optional filtering by deckId)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const deckId = searchParams.get('deckId');

        const sessions = await prisma.session.findMany({
            where: deckId ? { deckId } : undefined,
            orderBy: { updatedAt: 'desc' },
            include: { deck: true },
        });

        const parsedSessions = sessions.map((session) => ({
            id: session.id,
            deckId: session.deckId,
            state: JSON.parse(session.state) as SessionState,
            notes: session.notes || undefined,
            createdAt: session.createdAt.toISOString(),
            updatedAt: session.updatedAt.toISOString(),
            deck: {
                id: session.deck.id,
                title: session.deck.title,
                settings: JSON.parse(session.deck.settings) as DeckSettings,
                slides: JSON.parse(session.deck.slides) as Slide[],
                createdAt: session.deck.createdAt.toISOString(),
                updatedAt: session.deck.updatedAt.toISOString(),
            } as Deck,
        }));

        return NextResponse.json<ApiResponse<typeof parsedSessions>>({
            success: true,
            data: parsedSessions,
        });
    } catch (error) {
        console.error('Error fetching sessions:', error);
        return NextResponse.json<ApiResponse<null>>(
            { success: false, error: 'Failed to fetch sessions' },
            { status: 500 }
        );
    }
}
