import { describe, it, expect } from 'vitest';
import {
    splitStanzaBlocks,
    slidesFromStanzas,
    insertSlidesAfter,
    slidePreviewText,
    slideTypeLabel,
    createSlide,
    cloneSlides,
} from '../lib/slides';
import { Slide } from '../types';

describe('splitStanzaBlocks', () => {
    it('splits on blank lines and trims', () => {
        expect(splitStanzaBlocks('한 줄\n\n두 줄\n\n\n세 줄')).toEqual(['한 줄', '두 줄', '세 줄']);
    });

    it('returns empty for whitespace only', () => {
        expect(splitStanzaBlocks('  \n  \n')).toEqual([]);
    });

    it('keeps inner newlines inside a stanza', () => {
        expect(splitStanzaBlocks('첫째\n둘째\n\n다음')).toEqual(['첫째\n둘째', '다음']);
    });
});

describe('slidesFromStanzas', () => {
    it('creates koEn slides paired by index', () => {
        const slides = slidesFromStanzas({
            type: 'lyrics',
            korean: '주 은혜\n\n나를 사랑',
            english: 'Grace\n\nLove me',
        });
        expect(slides).toHaveLength(2);
        expect(slides[0].layout.splitMode).toBe('koEn');
        expect(slides[0].content.korean).toBe('주 은혜');
        expect(slides[1].content.english).toBe('Love me');
        expect(slides[0].id).not.toBe(slides[1].id);
    });

    it('pads missing language with empty string', () => {
        const slides = slidesFromStanzas({
            type: 'bible',
            korean: '가\n\n나',
            english: 'A',
            reference: '요한복음 3:16',
        });
        expect(slides).toHaveLength(2);
        expect(slides[1].content.english).toBe('');
        expect(slides[0].content.reference).toBe('요한복음 3:16');
        expect(slides[1].content.reference).toBe('요한복음 3:16');
    });

    it('uses koOnly when english is empty', () => {
        const slides = slidesFromStanzas({ type: 'lyrics', korean: '가\n\n나', english: '' });
        expect(slides[0].layout.splitMode).toBe('koOnly');
    });

    it('returns empty when both texts are empty', () => {
        expect(slidesFromStanzas({ type: 'lyrics', korean: '', english: '  ' })).toEqual([]);
    });
});

describe('insertSlidesAfter', () => {
    const a = createSlide('title');
    const b = createSlide('title');
    const extra = createSlide('lyrics');

    it('inserts after selected index', () => {
        const result = insertSlidesAfter([a, b], 0, [extra]);
        expect(result.map((s) => s.id)).toEqual([a.id, extra.id, b.id]);
    });

    it('inserts at start when index is negative', () => {
        const result = insertSlidesAfter([a], -1, [extra]);
        expect(result[0].id).toBe(extra.id);
    });
});

describe('slidePreviewText and labels', () => {
    it('prefers korean then title', () => {
        const slide: Slide = {
            id: '1',
            type: 'bible',
            content: { korean: '하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 이는 그를 믿는 자마다 멸망하지 않고 영생을 얻게 하려 하심이라', english: 'For God' },
            layout: { align: 'center', splitMode: 'koEn' },
        };
        expect(slideTypeLabel('bible')).toBe('성경');
        expect(slidePreviewText(slide).endsWith('…')).toBe(true);
        expect(slidePreviewText(slide).length).toBeLessThanOrEqual(41);
    });
});

describe('cloneSlides', () => {
    it('assigns new ids', () => {
        const original = [createSlide('title')];
        const cloned = cloneSlides(original);
        expect(cloned[0].id).not.toBe(original[0].id);
        expect(cloned[0].content).toEqual(original[0].content);
    });
});
