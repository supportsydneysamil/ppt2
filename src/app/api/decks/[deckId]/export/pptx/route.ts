import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import PptxGenJS from 'pptxgenjs';
import { DeckSettings, Slide, ComputedStyle, DEFAULT_COMPUTED_STYLE } from '@/types';

interface RouteParams {
    params: Promise<{ deckId: string }>;
}

// GET /api/decks/[deckId]/export/pptx - Export deck as PPTX
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { deckId } = await params;

        const deck = await prisma.deck.findUnique({
            where: { id: deckId },
        });

        if (!deck) {
            return NextResponse.json(
                { success: false, error: 'Deck not found' },
                { status: 404 }
            );
        }

        const settings: DeckSettings = JSON.parse(deck.settings);
        const slides: Slide[] = JSON.parse(deck.slides);

        // Create PPTX
        const pptx = new PptxGenJS();

        // Set presentation properties
        pptx.author = 'Church Presentation App';
        pptx.title = deck.title;
        pptx.subject = 'Church Worship Presentation';

        // Set slide size based on aspect ratio
        if (settings.aspectRatio === '16:9') {
            pptx.defineLayout({ name: 'CUSTOM', width: 13.333, height: 7.5 }); // 16:9 in inches
        } else {
            pptx.defineLayout({ name: 'CUSTOM', width: 10, height: 7.5 }); // 4:3 in inches
        }
        pptx.layout = 'CUSTOM';

        const { bgColor, textColor } = settings.theme;
        const fontFace = 'Arial'; // Fallback for compatibility

        // Generate slides
        for (const slide of slides) {
            const pptSlide = pptx.addSlide();

            // Set background
            pptSlide.background = { color: bgColor.replace('#', '') };

            const computedStyle = slide.computedStyle || DEFAULT_COMPUTED_STYLE;
            const splitMode = slide.layout.splitMode || 'koOnly';
            const align = slide.layout.align;

            // Calculate positions (in inches, for 16:9: 13.333" x 7.5")
            const slideWidth = settings.aspectRatio === '16:9' ? 13.333 : 10;
            const slideHeight = 7.5;
            const padding = slideWidth * computedStyle.paddingScale;

            // Helper to convert px to inches (assuming 96 DPI base, scaled)
            const pxToInch = (px: number) => px / 72; // Approximate conversion

            if (slide.type === 'title') {
                // Title slide - centered large text
                const title = slide.content.title || '';
                const fontSize = Math.min(computedStyle.fontSizeMain, 80);

                pptSlide.addText(title, {
                    x: padding,
                    y: slideHeight * 0.35,
                    w: slideWidth - padding * 2,
                    h: slideHeight * 0.3,
                    fontSize: fontSize,
                    fontFace,
                    color: textColor.replace('#', ''),
                    align: 'center',
                    valign: 'middle',
                    bold: true,
                });
            } else if (slide.type === 'bible' || slide.type === 'lyrics') {
                if (splitMode === 'koOnly') {
                    // Korean only - full centered
                    const text = slide.content.korean || slide.content.body || '';
                    addCenteredText(pptSlide, text, {
                        slideWidth,
                        slideHeight,
                        padding,
                        fontSize: computedStyle.fontSizeMain,
                        fontFace,
                        textColor,
                        align,
                    });
                } else if (splitMode === 'enOnly') {
                    // English only - full centered
                    const text = slide.content.english || slide.content.body || '';
                    addCenteredText(pptSlide, text, {
                        slideWidth,
                        slideHeight,
                        padding,
                        fontSize: computedStyle.fontSizeMain,
                        fontFace,
                        textColor,
                        align,
                    });
                } else if (splitMode === 'koEn') {
                    // Korean on top, English on bottom
                    const korean = slide.content.korean || '';
                    const english = slide.content.english || '';

                    // Korean (main) - top 55%
                    pptSlide.addText(korean, {
                        x: padding,
                        y: padding,
                        w: slideWidth - padding * 2,
                        h: (slideHeight - padding * 2) * 0.5,
                        fontSize: computedStyle.fontSizeMain,
                        fontFace,
                        color: textColor.replace('#', ''),
                        align: align === 'center' ? 'center' : 'left',
                        valign: 'bottom',
                    });

                    // English (sub) - bottom 40%
                    pptSlide.addText(english, {
                        x: padding,
                        y: slideHeight * 0.55,
                        w: slideWidth - padding * 2,
                        h: (slideHeight - padding * 2) * 0.35,
                        fontSize: computedStyle.fontSizeSub,
                        fontFace,
                        color: textColor.replace('#', ''),
                        align: align === 'center' ? 'center' : 'left',
                        valign: 'top',
                    });
                }

                // Add reference if present (for Bible slides)
                if (slide.content.reference) {
                    pptSlide.addText(slide.content.reference, {
                        x: padding,
                        y: slideHeight - padding - 0.5,
                        w: slideWidth - padding * 2,
                        h: 0.4,
                        fontSize: 18,
                        fontFace,
                        color: textColor.replace('#', ''),
                        align: 'right',
                        italic: true,
                    });
                }
            } else if (slide.type === 'imageText') {
                // Image with text overlay
                const text = slide.content.body || slide.content.title || '';

                // Add image if present
                if (slide.content.imageUrl) {
                    try {
                        pptSlide.addImage({
                            path: slide.content.imageUrl,
                            x: 0,
                            y: 0,
                            w: slideWidth,
                            h: slideHeight,
                        });
                    } catch {
                        // Image loading failed, continue with text only
                        console.warn('Failed to load image:', slide.content.imageUrl);
                    }
                }

                // Add text overlay
                if (text) {
                    pptSlide.addText(text, {
                        x: padding,
                        y: slideHeight * 0.6,
                        w: slideWidth - padding * 2,
                        h: slideHeight * 0.3,
                        fontSize: computedStyle.fontSizeMain,
                        fontFace,
                        color: textColor.replace('#', ''),
                        align: 'center',
                        valign: 'middle',
                    });
                }
            }
        }

        // Generate PPTX buffer
        const pptxBuffer = await pptx.write({ outputType: 'arraybuffer' });

        // Create response with proper headers
        const response = new NextResponse(pptxBuffer as ArrayBuffer);
        response.headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        response.headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(deck.title)}.pptx"`);

        return response;
    } catch (error) {
        console.error('Error exporting PPTX:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to export PPTX' },
            { status: 500 }
        );
    }
}

// Helper function to add centered text
function addCenteredText(
    slide: PptxGenJS.Slide,
    text: string,
    options: {
        slideWidth: number;
        slideHeight: number;
        padding: number;
        fontSize: number;
        fontFace: string;
        textColor: string;
        align: 'center' | 'left';
    }
) {
    const { slideWidth, slideHeight, padding, fontSize, fontFace, textColor, align } = options;

    slide.addText(text, {
        x: padding,
        y: padding,
        w: slideWidth - padding * 2,
        h: slideHeight - padding * 2,
        fontSize: Math.min(fontSize, 72),
        fontFace,
        color: textColor.replace('#', ''),
        align: align === 'center' ? 'center' : 'left',
        valign: 'middle',
    });
}
