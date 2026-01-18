import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Session, SessionState, Deck, DeckSettings, Slide, ApiResponse } from '@/types';

interface RouteParams {
    params: Promise<{ sessionId: string }>;
}

// GET /api/sessions/[sessionId] - Get session with deck data
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { sessionId } = await params;

        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: { deck: true },
        });

        if (!session) {
            return NextResponse.json<ApiResponse<null>>(
                { success: false, error: 'Session not found' },
                { status: 404 }
            );
        }

        const parsedSession = {
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
        };

        return NextResponse.json<ApiResponse<typeof parsedSession>>({
            success: true,
            data: parsedSession,
        });
    } catch (error) {
        console.error('Error fetching session:', error);
        return NextResponse.json<ApiResponse<null>>(
            { success: false, error: 'Failed to fetch session' },
            { status: 500 }
        );
    }
}

// PATCH /api/sessions/[sessionId] - Update session state
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const { sessionId } = await params;
        const body = await request.json();
        const { state, notes } = body;

        const existingSession = await prisma.session.findUnique({
            where: { id: sessionId },
        });

        if (!existingSession) {
            return NextResponse.json<ApiResponse<null>>(
                { success: false, error: 'Session not found' },
                { status: 404 }
            );
        }

        const currentState = JSON.parse(existingSession.state) as SessionState;
        const updatedState: SessionState = {
            ...currentState,
            ...state,
            updatedAt: new Date().toISOString(),
        };

        const session = await prisma.session.update({
            where: { id: sessionId },
            data: {
                state: JSON.stringify(updatedState),
                ...(notes !== undefined && { notes }),
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
        console.error('Error updating session:', error);
        return NextResponse.json<ApiResponse<null>>(
            { success: false, error: 'Failed to update session' },
            { status: 500 }
        );
    }
}

// DELETE /api/sessions/[sessionId]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { sessionId } = await params;

        const existingSession = await prisma.session.findUnique({
            where: { id: sessionId },
        });

        if (!existingSession) {
            return NextResponse.json<ApiResponse<null>>(
                { success: false, error: 'Session not found' },
                { status: 404 }
            );
        }

        await prisma.session.delete({
            where: { id: sessionId },
        });

        return NextResponse.json<ApiResponse<null>>({
            success: true,
            data: null,
        });
    } catch (error) {
        console.error('Error deleting session:', error);
        return NextResponse.json<ApiResponse<null>>(
            { success: false, error: 'Failed to delete session' },
            { status: 500 }
        );
    }
}
