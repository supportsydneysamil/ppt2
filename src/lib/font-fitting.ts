/**
 * Font Fitting Algorithm for Church Presentation
 * 
 * Goal: Find optimal font size that fills the container without overflowing,
 * while respecting min/max limits and padding requirements.
 */

import {
    FitTextOptions,
    FitTextResult,
    ComputedStyle,
    FONT_SIZE_LIMITS,
    SplitMode
} from '@/types';

/**
 * Measures text dimensions using Canvas API
 */
function measureText(
    text: string,
    fontSize: number,
    fontFamily: string
): { width: number; height: number; lines: string[] } {
    // Split text into lines
    const lines = text.split('\n').filter(line => line.trim() !== '');

    // For server-side, estimate width based on character count
    // Approximate character width is roughly 0.5-0.6 of font size for Korean/mixed text  
    const avgCharWidth = fontSize * 0.55;

    let maxWidth = 0;
    for (const line of lines) {
        const lineWidth = line.length * avgCharWidth;
        maxWidth = Math.max(maxWidth, lineWidth);
    }

    const lineHeight = fontSize * 1.3;
    const height = lines.length * lineHeight;

    return { width: maxWidth, height, lines };
}

/**
 * Wraps text to fit within a container width
 */
function wrapText(
    text: string,
    fontSize: number,
    fontFamily: string,
    containerWidth: number
): string[] {
    const avgCharWidth = fontSize * 0.55;
    const maxCharsPerLine = Math.floor(containerWidth / avgCharWidth);

    const inputLines = text.split('\n');
    const wrappedLines: string[] = [];

    for (const line of inputLines) {
        if (line.length <= maxCharsPerLine) {
            wrappedLines.push(line);
        } else {
            // Simple word wrapping
            let remaining = line;
            while (remaining.length > 0) {
                if (remaining.length <= maxCharsPerLine) {
                    wrappedLines.push(remaining);
                    break;
                }

                // Find a good break point
                let breakPoint = maxCharsPerLine;
                const spaceIndex = remaining.lastIndexOf(' ', maxCharsPerLine);
                if (spaceIndex > maxCharsPerLine * 0.3) {
                    breakPoint = spaceIndex;
                }

                wrappedLines.push(remaining.substring(0, breakPoint).trim());
                remaining = remaining.substring(breakPoint).trim();
            }
        }
    }

    return wrappedLines;
}

/**
 * Binary search to find optimal font size
 */
export function fitText(options: FitTextOptions): FitTextResult {
    const {
        containerWidth,
        containerHeight,
        text,
        fontFamily,
        minFontSize,
        maxFontSize,
        lineHeightRatio,
        paddingPercent,
    } = options;

    // Calculate available space after padding
    const availableWidth = containerWidth * (1 - paddingPercent * 2);
    const availableHeight = containerHeight * (1 - paddingPercent * 2);

    if (!text || text.trim() === '') {
        return {
            fontSize: maxFontSize,
            lineHeight: maxFontSize * lineHeightRatio,
            lines: 0,
        };
    }

    let low = minFontSize;
    let high = maxFontSize;
    let bestFit: FitTextResult = {
        fontSize: minFontSize,
        lineHeight: minFontSize * lineHeightRatio,
        lines: 1,
    };

    // Binary search for optimal font size
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const wrappedLines = wrapText(text, mid, fontFamily, availableWidth);
        const lineHeight = mid * lineHeightRatio;
        const totalHeight = wrappedLines.length * lineHeight;

        if (totalHeight <= availableHeight) {
            // This font size fits, try larger
            bestFit = {
                fontSize: mid,
                lineHeight,
                lines: wrappedLines.length,
            };
            low = mid + 1;
        } else {
            // Too big, try smaller
            high = mid - 1;
        }
    }

    return bestFit;
}

/**
 * Calculate computed style for a slide based on its content and layout
 */
export function calculateComputedStyle(
    content: { korean?: string; english?: string; title?: string; body?: string },
    splitMode: SplitMode | undefined,
    containerWidth: number,
    containerHeight: number,
    fontFamily: string
): ComputedStyle {
    const paddingScale = 0.1; // 10% padding on each side

    // Determine main and sub text based on split mode
    let mainText = '';
    let subText = '';

    if (splitMode === 'koOnly') {
        mainText = content.korean || content.title || content.body || '';
    } else if (splitMode === 'enOnly') {
        mainText = content.english || content.title || content.body || '';
    } else if (splitMode === 'koEn') {
        mainText = content.korean || '';
        subText = content.english || '';
    } else {
        mainText = content.title || content.body || content.korean || '';
        subText = content.english || '';
    }

    // Calculate available height for each section
    const availableHeight = containerHeight * (1 - paddingScale * 2);

    let mainHeight = availableHeight;
    let subHeight = 0;

    if (subText && splitMode === 'koEn') {
        // 60% for main (Korean), 35% for sub (English), 5% gap
        mainHeight = availableHeight * 0.55;
        subHeight = availableHeight * 0.35;
    }

    // Calculate main text fitting
    const mainFit = fitText({
        containerWidth,
        containerHeight: mainHeight,
        text: mainText,
        fontFamily,
        minFontSize: FONT_SIZE_LIMITS.mainMin,
        maxFontSize: FONT_SIZE_LIMITS.mainMax,
        lineHeightRatio: 1.3,
        paddingPercent: paddingScale,
    });

    // Calculate sub text fitting
    let subFit: FitTextResult = {
        fontSize: FONT_SIZE_LIMITS.subMin,
        lineHeight: FONT_SIZE_LIMITS.subMin * 1.3,
        lines: 0,
    };

    if (subText) {
        // Sub font is 0.7-0.85 ratio of main, capped by limits
        const subMaxFromMain = Math.min(mainFit.fontSize * 0.85, FONT_SIZE_LIMITS.subMax);

        subFit = fitText({
            containerWidth,
            containerHeight: subHeight,
            text: subText,
            fontFamily,
            minFontSize: FONT_SIZE_LIMITS.subMin,
            maxFontSize: Math.max(subMaxFromMain, FONT_SIZE_LIMITS.subMin),
            lineHeightRatio: 1.3,
            paddingPercent: paddingScale,
        });
    }

    return {
        fontSizeMain: mainFit.fontSize,
        fontSizeSub: subFit.fontSize,
        lineHeightMain: 1.3,
        lineHeightSub: 1.3,
        paddingScale,
        maxLinesMain: mainFit.lines || 6,
        maxLinesSub: subFit.lines || 4,
    };
}

/**
 * Get aspect ratio dimensions
 */
export function getAspectRatioDimensions(
    aspectRatio: '16:9' | '4:3',
    baseWidth: number = 1920
): { width: number; height: number } {
    if (aspectRatio === '16:9') {
        return { width: baseWidth, height: baseWidth * (9 / 16) };
    } else {
        return { width: baseWidth, height: baseWidth * (3 / 4) };
    }
}
