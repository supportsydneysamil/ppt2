import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Deck, DeckSettings, Slide, ApiResponse } from '@/types';

interface RouteParams {
    params: Promise<{ deckId: string }>;
}

// GET /api/decks/[deckId] - Get a single deck
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { deckId } = await params;

        const deck = await prisma.deck.findUnique({
            where: { id: deckId },
        });

        if (!deck) {
            return NextResponse.json<ApiResponse<Deck>>(
                { success: false, error: 'Deck not found' },
                { status: 404 }
            );
        }

        const parsedDeck: Deck = {
            id: deck.id,
            title: deck.title,
            settings: JSON.parse(deck.settings) as DeckSettings,
            slides: JSON.parse(deck.slides) as Slide[],
            createdAt: deck.createdAt.toISOString(),
            updatedAt: deck.updatedAt.toISOString(),
        };

        return NextResponse.json<ApiResponse<Deck>>({
            success: true,
            data: parsedDeck,
        });
    } catch (error) {
        console.error('Error fetching deck:', error);
        return NextResponse.json<ApiResponse<Deck>>(
            { success: false, error: 'Failed to fetch deck' },
            { status: 500 }
        );
    }
}

// PUT /api/decks/[deckId] - Update a deck
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const { deckId } = await params;
        const body = await request.json();
        const { title, settings, slides } = body;

        const existingDeck = await prisma.deck.findUnique({
            where: { id: deckId },
        });

        if (!existingDeck) {
            return NextResponse.json<ApiResponse<Deck>>(
                { success: false, error: 'Deck not found' },
                { status: 404 }
            );
        }

        const deck = await prisma.deck.update({
            where: { id: deckId },
            data: {
                ...(title !== undefined && { title }),
                ...(settings !== undefined && { settings: JSON.stringify(settings) }),
                ...(slides !== undefined && { slides: JSON.stringify(slides) }),
            },
        });

        const parsedDeck: Deck = {
            id: deck.id,
            title: deck.title,
            settings: JSON.parse(deck.settings) as DeckSettings,
            slides: JSON.parse(deck.slides) as Slide[],
            createdAt: deck.createdAt.toISOString(),
            updatedAt: deck.updatedAt.toISOString(),
        };

        return NextResponse.json<ApiResponse<Deck>>({
            success: true,
            data: parsedDeck,
        });
    } catch (error) {
        console.error('Error updating deck:', error);
        return NextResponse.json<ApiResponse<Deck>>(
            { success: false, error: 'Failed to update deck' },
            { status: 500 }
        );
    }
}

// DELETE /api/decks/[deckId] - Delete a deck
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { deckId } = await params;

        const existingDeck = await prisma.deck.findUnique({
            where: { id: deckId },
        });

        if (!existingDeck) {
            return NextResponse.json<ApiResponse<null>>(
                { success: false, error: 'Deck not found' },
                { status: 404 }
            );
        }

        await prisma.deck.delete({
            where: { id: deckId },
        });

        return NextResponse.json<ApiResponse<null>>({
            success: true,
            data: null,
        });
    } catch (error) {
        console.error('Error deleting deck:', error);
        return NextResponse.json<ApiResponse<null>>(
            { success: false, error: 'Failed to delete deck' },
            { status: 500 }
        );
    }
}
