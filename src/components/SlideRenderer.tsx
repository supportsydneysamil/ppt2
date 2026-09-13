'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Slide, DeckSettings, ComputedStyle, FONT_SIZE_LIMITS } from '@/types';

interface SlideRendererProps {
    slide: Slide;
    settings: DeckSettings;
    className?: string;
    isPreview?: boolean; // For smaller thumbnail preview
    style?: React.CSSProperties;
}

/**
 * Client-side font fitting using canvas measurement
 */
function fitTextClient(
    text: string,
    containerWidth: number,
    containerHeight: number,
    fontFamily: string,
    minFontSize: number,
    maxFontSize: number,
    paddingPercent: number = 0.1
): { fontSize: number; lines: string[] } {
    if (!text || text.trim() === '') {
        return { fontSize: maxFontSize, lines: [] };
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return { fontSize: maxFontSize, lines: [text] };
    }

    const availableWidth = containerWidth * (1 - paddingPercent * 2);
    const availableHeight = containerHeight * (1 - paddingPercent * 2);

    function measureLineWidth(line: string, fontSize: number): number {
        if (!ctx) return line.length * fontSize * 0.55;
        ctx.font = `${fontSize}px ${fontFamily}`;
        return ctx.measureText(line).width;
    }

    function wrapText(fontSize: number): string[] {
        const inputLines = text.split('\n');
        const wrappedLines: string[] = [];

        for (const line of inputLines) {
            if (!line.trim()) {
                wrappedLines.push('');
                continue;
            }

            if (measureLineWidth(line, fontSize) <= availableWidth) {
                wrappedLines.push(line);
            } else {
                // Word wrap
                const words = line.split(/(\s+)/);
                let currentLine = '';

                for (const word of words) {
                    const testLine = currentLine + word;
                    if (measureLineWidth(testLine, fontSize) <= availableWidth) {
                        currentLine = testLine;
                    } else {
                        if (currentLine.trim()) {
                            wrappedLines.push(currentLine.trim());
                        }
                        currentLine = word.trim() ? word : '';
                    }
                }
                if (currentLine.trim()) {
                    wrappedLines.push(currentLine.trim());
                }
            }
        }

        return wrappedLines;
    }

    // Binary search for optimal font size
    let low = minFontSize;
    let high = maxFontSize;
    let bestFit = { fontSize: minFontSize, lines: wrapText(minFontSize) };

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const lines = wrapText(mid);
        const lineHeight = mid * 1.3;
        const totalHeight = lines.length * lineHeight;

        if (totalHeight <= availableHeight) {
            bestFit = { fontSize: mid, lines };
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    return bestFit;
}

export function SlideRenderer({
    slide,
    settings,
    className = '',
    isPreview = false,
    style = {},
}: SlideRendererProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [fittedMain, setFittedMain] = useState<{ fontSize: number; lines: string[] }>({ fontSize: 72, lines: [] });
    const [fittedSub, setFittedSub] = useState<{ fontSize: number; lines: string[] }>({ fontSize: 48, lines: [] });

    const { bgColor, textColor } = settings.theme;
    const fontFamily = settings.defaultFontFamily;
    const splitMode = slide.layout.splitMode || 'koOnly';
    const align = slide.layout.align;

    // Get main and sub text
    const { mainText, subText } = useMemo(() => {
        if (slide.type === 'title') {
            return { mainText: slide.content.title || '', subText: '' };
        }

        if (splitMode === 'koOnly') {
            return { mainText: slide.content.korean || slide.content.body || '', subText: '' };
        } else if (splitMode === 'enOnly') {
            return { mainText: slide.content.english || slide.content.body || '', subText: '' };
        } else if (splitMode === 'koEn') {
            return {
                mainText: slide.content.korean || '',
                subText: slide.content.english || '',
            };
        }

        return { mainText: slide.content.body || '', subText: '' };
    }, [slide, splitMode]);

    // Observe container size
    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setDimensions({ width, height });
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Calculate font sizes when dimensions or content changes
    useEffect(() => {
        if (dimensions.width === 0 || dimensions.height === 0) return;
        if (isPreview) {
            // Use smaller fixed sizes for previews
            const scale = Math.min(dimensions.width / 1920, dimensions.height / 1080);
            setFittedMain({ fontSize: Math.max(12, 72 * scale), lines: mainText.split('\n') });
            setFittedSub({ fontSize: Math.max(10, 48 * scale), lines: subText.split('\n') });
            return;
        }

        const mainHeight = subText ? dimensions.height * 0.55 : dimensions.height;
        const subHeight = subText ? dimensions.height * 0.35 : 0;

        // Fit main text
        const mainFit = fitTextClient(
            mainText,
            dimensions.width,
            mainHeight,
            fontFamily,
            FONT_SIZE_LIMITS.mainMin,
            FONT_SIZE_LIMITS.mainMax,
            0.1
        );
        setFittedMain(mainFit);

        // Fit sub text
        if (subText) {
            const subMaxFromMain = Math.min(mainFit.fontSize * 0.85, FONT_SIZE_LIMITS.subMax);
            const subFit = fitTextClient(
                subText,
                dimensions.width,
                subHeight,
                fontFamily,
                FONT_SIZE_LIMITS.subMin,
                Math.max(subMaxFromMain, FONT_SIZE_LIMITS.subMin),
                0.1
            );
            setFittedSub(subFit);
        }
    }, [dimensions, mainText, subText, fontFamily, isPreview]);

    const textAlign = align === 'center' ? 'center' : 'left';

    return (
        <div
            ref={containerRef}
            className={`slide-renderer ${className}`}
            style={{
                backgroundColor: bgColor,
                color: textColor,
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: subText ? 'flex-start' : 'center',
                padding: isPreview ? '5%' : '8%',
                fontFamily,
                overflow: 'hidden',
                ...style,
            }}
        >
            {/* Main Text */}
            <div
                className="slide-main-text"
                style={{
                    fontSize: fittedMain.fontSize,
                    lineHeight: 1.3,
                    textAlign,
                    fontWeight: slide.type === 'title' ? 700 : 500,
                    wordBreak: 'keep-all',
                    whiteSpace: 'pre-wrap',
                    flex: subText ? '0 0 55%' : '0 0 auto',
                    display: 'flex',
                    alignItems: subText ? 'flex-end' : 'center',
                    justifyContent: textAlign === 'center' ? 'center' : 'flex-start',
                    width: '100%',
                    paddingBottom: subText ? '2%' : 0,
                    // Preview font sizes are estimated, not fitted, so clip instead of spilling over the sub text.
                    overflow: isPreview ? 'hidden' : undefined,
                }}
            >
                {mainText}
            </div>

            {/* Sub Text (for koEn mode) */}
            {subText && (
                <div
                    className="slide-sub-text"
                    style={{
                        fontSize: fittedSub.fontSize,
                        lineHeight: 1.3,
                        textAlign,
                        fontWeight: 400,
                        wordBreak: 'keep-all',
                        whiteSpace: 'pre-wrap',
                        flex: '0 0 35%',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: textAlign === 'center' ? 'center' : 'flex-start',
                        width: '100%',
                        paddingTop: '2%',
                        opacity: 0.9,
                        overflow: isPreview ? 'hidden' : undefined,
                    }}
                >
                    {subText}
                </div>
            )}

            {/* Reference (for Bible slides) */}
            {slide.content.reference && !isPreview && (
                <div
                    className="slide-reference"
                    style={{
                        position: 'absolute',
                        bottom: '5%',
                        right: '5%',
                        fontSize: fittedMain.fontSize * 0.3,
                        fontStyle: 'italic',
                        opacity: 0.7,
                    }}
                >
                    {slide.content.reference}
                </div>
            )}
        </div>
    );
}

export default SlideRenderer;
