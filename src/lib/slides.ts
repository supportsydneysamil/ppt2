import { v4 as uuidv4 } from 'uuid';
import { AlignType, Slide, SlideContent, SlideType, SplitMode } from '@/types';

export const SLIDE_TYPE_LABELS: Record<SlideType, string> = {
    title: '제목',
    bible: '성경',
    lyrics: '가사',
    imageText: '이미지',
};

export function splitStanzaBlocks(text: string): string[] {
    return text
        .replace(/\r\n/g, '\n')
        .split(/\n\s*\n/)
        .map((block) => block.trim())
        .filter((block) => block.length > 0);
}

export function getDefaultContent(type: SlideType): SlideContent {
    switch (type) {
        case 'title':
            return { title: '새 제목' };
        case 'bible':
            return { korean: '', english: '', reference: '' };
        case 'lyrics':
            return { korean: '', english: '' };
        case 'imageText':
            return { body: '', imageUrl: '' };
        default:
            return {};
    }
}

export function createSlide(type: SlideType): Slide {
    return {
        id: uuidv4(),
        type,
        content: getDefaultContent(type),
        layout: {
            align: 'center',
            splitMode: type === 'bible' || type === 'lyrics' ? 'koEn' : undefined,
        },
    };
}

export function slidesFromStanzas(options: {
    type: 'bible' | 'lyrics';
    korean: string;
    english: string;
    reference?: string;
    align?: AlignType;
}): Slide[] {
    const ko = splitStanzaBlocks(options.korean);
    const en = splitStanzaBlocks(options.english);
    const count = Math.max(ko.length, en.length);
    if (count === 0) return [];

    const hasKo = ko.length > 0;
    const hasEn = en.length > 0;
    const splitMode: SplitMode = hasKo && hasEn ? 'koEn' : hasEn ? 'enOnly' : 'koOnly';

    return Array.from({ length: count }, (_, i) => ({
        id: uuidv4(),
        type: options.type,
        content: {
            korean: ko[i] || '',
            english: en[i] || '',
            ...(options.type === 'bible' && options.reference ? { reference: options.reference } : {}),
        },
        layout: {
            align: options.align ?? 'center',
            splitMode,
        },
    }));
}

export function insertSlidesAfter(slides: Slide[], afterIndex: number, incoming: Slide[]): Slide[] {
    if (incoming.length === 0) return slides;
    if (afterIndex < 0) return [...incoming, ...slides];
    const index = Math.min(afterIndex + 1, slides.length);
    return [...slides.slice(0, index), ...incoming, ...slides.slice(index)];
}

export function slideTypeLabel(type: SlideType): string {
    return SLIDE_TYPE_LABELS[type] ?? type;
}

export function slidePreviewText(slide: Slide, maxLength = 40): string {
    const raw =
        slide.content.title ||
        slide.content.korean ||
        slide.content.english ||
        slide.content.body ||
        slide.content.reference ||
        '';
    const one = raw.replace(/\s+/g, ' ').trim();
    if (one.length <= maxLength) return one;
    return `${one.slice(0, maxLength)}…`;
}

export function cloneSlides(slides: Slide[]): Slide[] {
    return slides.map((slide) => ({
        ...slide,
        id: uuidv4(),
        content: { ...slide.content },
        layout: { ...slide.layout },
    }));
}
