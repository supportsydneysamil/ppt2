import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareDisplayWindow, selectDisplayScreen } from '@/lib/display-window';

const primary = { availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1040, isPrimary: true };
const secondary = { availLeft: -1920, availTop: 0, availWidth: 1920, availHeight: 1080, isPrimary: false };

afterEach(() => vi.unstubAllGlobals());

function setup(getScreenDetails?: () => Promise<unknown>, blocked = false) {
    const popup = {
        closed: false,
        screenX: 0,
        screenY: 0,
        moveTo: vi.fn((x: number, y: number) => { popup.screenX = x; popup.screenY = y; }),
        resizeTo: vi.fn(),
        location: { href: '' },
    };
    const open = vi.fn(() => blocked ? null : popup);
    vi.stubGlobal('window', { open, getScreenDetails });
    return { popup, open };
}

describe('presentation display launch', () => {
    it('opens synchronously before screen permissions resolve, then uses the other monitor including negative coordinates', async () => {
        let grant!: (value: unknown) => void;
        const { popup, open } = setup(() => new Promise(resolve => { grant = resolve; }));
        const display = prepareDisplayWindow();
        expect(open).toHaveBeenCalledOnce();
        expect(popup.moveTo).not.toHaveBeenCalled();
        grant({ screens: [primary, secondary], currentScreen: primary });
        expect(await display.placement).toBe('placed');
        expect(popup.moveTo).toHaveBeenCalledWith(-1920, 0);
        expect(popup.resizeTo).toHaveBeenCalledWith(1920, 1080);
        expect(display.show('session-1')).toBe(true);
        expect(popup.location.href).toBe('/present/session-1/display');
    });

    it('uses the primary monitor if controls are on the secondary monitor', () => {
        expect(selectDisplayScreen({ screens: [primary, secondary], currentScreen: secondary })).toBe(primary);
    });

    it('keeps a usable popup when the API is unsupported', async () => {
        setup();
        const display = prepareDisplayWindow();
        expect(await display.placement).toBe('manual');
        expect(display.show('session-1')).toBe(true);
    });

    it('keeps a usable popup when screen access is denied', async () => {
        setup(() => Promise.reject(new Error('Permission denied')));
        const display = prepareDisplayWindow();
        expect(await display.placement).toBe('denied');
        expect(display.show('session-1')).toBe(true);
    });

    it('reports a blocked popup without requesting screen permission', async () => {
        const getDetails = vi.fn();
        setup(getDetails, true);
        const display = prepareDisplayWindow();
        expect(await display.placement).toBe('blocked');
        expect(getDetails).not.toHaveBeenCalled();
        expect(display.show('session-1')).toBe(false);
    });

    it('reports a single monitor without moving over the controls', async () => {
        const { popup } = setup(async () => ({ screens: [primary], currentScreen: primary }));
        expect(await prepareDisplayWindow().placement).toBe('single');
        expect(popup.moveTo).not.toHaveBeenCalled();
    });

    it('reports a popup closed while waiting for permission', async () => {
        const { popup } = setup(async () => ({ screens: [primary, secondary], currentScreen: primary }));
        const display = prepareDisplayWindow();
        popup.closed = true;
        expect(await display.placement).toBe('closed');
        expect(display.show('session-1')).toBe(false);
    });

    it('does not claim placement succeeded if the browser ignores movement', async () => {
        const { popup } = setup(async () => ({ screens: [primary, secondary], currentScreen: primary }));
        popup.moveTo = vi.fn();
        expect(await prepareDisplayWindow().placement).toBe('manual');
    });
});
