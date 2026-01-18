import { describe, it, expect } from 'vitest';
import { fitText, calculateComputedStyle, getAspectRatioDimensions } from '../lib/font-fitting';
import { FONT_SIZE_LIMITS } from '../types';

describe('fitText', () => {
    it('should return max font size for empty text', () => {
        const result = fitText({
            containerWidth: 1920,
            containerHeight: 1080,
            text: '',
            fontFamily: 'Arial',
            minFontSize: 24,
            maxFontSize: 110,
            lineHeightRatio: 1.3,
            paddingPercent: 0.1,
        });

        expect(result.fontSize).toBe(110);
        expect(result.lines).toBe(0);
    });

    it('should fit short text with large font', () => {
        const result = fitText({
            containerWidth: 1920,
            containerHeight: 1080,
            text: '짧은 텍스트',
            fontFamily: 'Arial',
            minFontSize: 24,
            maxFontSize: 110,
            lineHeightRatio: 1.3,
            paddingPercent: 0.1,
        });

        expect(result.fontSize).toBeGreaterThan(50);
        expect(result.fontSize).toBeLessThanOrEqual(110);
    });

    it('should reduce font size for long text', () => {
        const shortResult = fitText({
            containerWidth: 800,
            containerHeight: 400,
            text: 'Hi',
            fontFamily: 'Arial',
            minFontSize: 24,
            maxFontSize: 110,
            lineHeightRatio: 1.3,
            paddingPercent: 0.1,
        });

        const longResult = fitText({
            containerWidth: 800,
            containerHeight: 400,
            text: '이 텍스트는 매우 긴 텍스트입니다. 여러 줄에 걸쳐 표시될 수 있으며, 폰트 크기가 자동으로 줄어들어야 합니다. 가독성을 위해 적절한 크기로 조절됩니다. 더 많은 텍스트를 추가하여 폰트 크기가 실제로 줄어드는지 확인합니다. 이것은 정말 긴 텍스트입니다.',
            fontFamily: 'Arial',
            minFontSize: 24,
            maxFontSize: 110,
            lineHeightRatio: 1.3,
            paddingPercent: 0.1,
        });

        expect(longResult.fontSize).toBeLessThan(shortResult.fontSize);
        expect(longResult.lines).toBeGreaterThan(1);
    });

    it('should respect minimum font size', () => {
        const result = fitText({
            containerWidth: 200,
            containerHeight: 100,
            text: 'A'.repeat(1000), // Very long text in small container
            fontFamily: 'Arial',
            minFontSize: 24,
            maxFontSize: 110,
            lineHeightRatio: 1.3,
            paddingPercent: 0.1,
        });

        expect(result.fontSize).toBeGreaterThanOrEqual(24);
    });

    it('should handle multi-line text', () => {
        const result = fitText({
            containerWidth: 1920,
            containerHeight: 1080,
            text: '첫 번째 줄\n두 번째 줄\n세 번째 줄',
            fontFamily: 'Arial',
            minFontSize: 24,
            maxFontSize: 110,
            lineHeightRatio: 1.3,
            paddingPercent: 0.1,
        });

        expect(result.lines).toBeGreaterThanOrEqual(3);
    });
});

describe('calculateComputedStyle', () => {
    it('should calculate style for koOnly mode', () => {
        const style = calculateComputedStyle(
            { korean: '한국어 텍스트' },
            'koOnly',
            1920,
            1080,
            'Arial'
        );

        expect(style.fontSizeMain).toBeGreaterThanOrEqual(FONT_SIZE_LIMITS.mainMin);
        expect(style.fontSizeMain).toBeLessThanOrEqual(FONT_SIZE_LIMITS.mainMax);
        expect(style.paddingScale).toBe(0.1);
    });

    it('should calculate style for koEn mode with sub text smaller than main', () => {
        const style = calculateComputedStyle(
            { korean: '한국어', english: 'English' },
            'koEn',
            1920,
            1080,
            'Arial'
        );

        expect(style.fontSizeSub).toBeLessThanOrEqual(style.fontSizeMain * 0.85);
    });

    it('should handle empty content', () => {
        const style = calculateComputedStyle(
            {},
            'koOnly',
            1920,
            1080,
            'Arial'
        );

        expect(style.fontSizeMain).toBe(FONT_SIZE_LIMITS.mainMax);
    });
});

describe('getAspectRatioDimensions', () => {
    it('should return 16:9 dimensions', () => {
        const dims = getAspectRatioDimensions('16:9', 1920);
        expect(dims.width).toBe(1920);
        expect(dims.height).toBe(1080);
    });

    it('should return 4:3 dimensions', () => {
        const dims = getAspectRatioDimensions('4:3', 1920);
        expect(dims.width).toBe(1920);
        expect(dims.height).toBe(1440);
    });

    it('should use default base width', () => {
        const dims = getAspectRatioDimensions('16:9');
        expect(dims.width).toBe(1920);
    });
});
