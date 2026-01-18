import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Deck, DeckSettings, Slide, DEFAULT_DECK_SETTINGS, ApiResponse } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// GET /api/decks - List all decks
export async function GET() {
    try {
        const decks = await prisma.deck.findMany({
            orderBy: { updatedAt: 'desc' },
        });

        const parsedDecks: Deck[] = decks.map((deck) => ({
            id: deck.id,
            title: deck.title,
            settings: JSON.parse(deck.settings) as DeckSettings,
            slides: JSON.parse(deck.slides) as Slide[],
            createdAt: deck.createdAt.toISOString(),
            updatedAt: deck.updatedAt.toISOString(),
        }));

        return NextResponse.json<ApiResponse<Deck[]>>({
            success: true,
            data: parsedDecks,
        });
    } catch (error) {
        console.error('Error fetching decks:', error);
        return NextResponse.json<ApiResponse<Deck[]>>(
            { success: false, error: 'Failed to fetch decks' },
            { status: 500 }
        );
    }
}

// POST /api/decks - Create a new deck
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { title, settings, slides } = body;

        const deck = await prisma.deck.create({
            data: {
                title: title || 'Untitled Presentation',
                settings: JSON.stringify(settings || DEFAULT_DECK_SETTINGS),
                slides: JSON.stringify(slides || [
                    {
                        id: uuidv4(),
                        type: 'title',
                        content: { title: '새 프레젠테이션' },
                        layout: { align: 'center' },
                    },
                ]),
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
        console.error('Error creating deck:', error);
        return NextResponse.json<ApiResponse<Deck>>(
            { success: false, error: 'Failed to create deck' },
            { status: 500 }
        );
    }
}
