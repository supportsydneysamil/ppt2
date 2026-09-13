export interface PresentationScreen {
    availLeft: number;
    availTop: number;
    availWidth: number;
    availHeight: number;
    isPrimary?: boolean;
}

interface ScreenDetails {
    screens: PresentationScreen[];
    currentScreen: PresentationScreen;
}

export type DisplayPlacement = 'placed' | 'manual' | 'denied' | 'single' | 'blocked' | 'closed';

const DISPLAY_WINDOW_NAME = 'church-presentation-display';

export const DISPLAY_READY = 'DISPLAY_READY';
export const ENTER_FULLSCREEN = 'ENTER_FULLSCREEN';
export const EXIT_FULLSCREEN = 'EXIT_FULLSCREEN';
export const DISPLAY_FULLSCREEN = 'DISPLAY_FULLSCREEN';

export interface DisplayFullscreenMessage {
    type: typeof DISPLAY_FULLSCREEN;
    fullscreen: boolean;
}

let displayWindow: Window | null = null;

export const DISPLAY_MESSAGES: Record<DisplayPlacement, string> = {
    placed: '다른 모니터에 송출 창을 배치했습니다. 전체 화면이 아니면 송출 창의 전체 화면 버튼을 눌러 주세요.',
    manual: '자동 모니터 배치를 사용할 수 없습니다. 송출 창을 원하는 모니터로 옮긴 뒤 전체 화면 버튼을 눌러 주세요.',
    denied: '모니터 접근 권한을 얻지 못했습니다. 브라우저의 사이트 권한에서 창 관리를 허용한 뒤 Display 열기를 다시 눌러 주세요. 송출 창을 직접 옮겨도 됩니다.',
    single: '모니터가 하나만 감지되었습니다. 두 번째 모니터를 확장 모드로 연결한 뒤 Display 열기를 다시 눌러 주세요.',
    blocked: '송출 창이 차단되었습니다. 브라우저에서 팝업을 허용한 뒤 Display 열기를 눌러 주세요. 내장 브라우저에서는 Chrome 또는 Edge로 앱을 열어 주세요.',
    closed: '송출 창이 닫혔습니다. Display 열기를 눌러 다시 열어 주세요.',
};

export type ScreenPermission = 'granted' | 'prompt' | 'unavailable';

export const SCREEN_PERMISSION_MESSAGES: Record<'prompt' | 'granted', string> = {
    prompt: '자동 모니터 배치를 위해 "모니터 권한 허용"을 눌러 주세요.',
    granted: '모니터 권한을 허용했습니다. Display 열기를 누르면 다른 모니터에 자동으로 배치됩니다.',
};

export async function readScreenPermission(): Promise<ScreenPermission> {
    if (!(window as Window & { getScreenDetails?: unknown }).getScreenDetails) return 'unavailable';
    for (const name of ['window-management', 'window-placement']) {
        try {
            const status = await navigator.permissions.query({ name: name as PermissionName });
            return status.state === 'granted' ? 'granted' : 'prompt';
        } catch { /* Older browsers only know one of the two permission names. */ }
    }
    return 'prompt';
}

// Must run directly in the click handler. Chrome only shows the window
// management prompt when getScreenDetails() consumes a user activation, and
// the window.open() below consumes it first, so the popup cannot share a click.
export async function requestScreenPermission() {
    const host = window as Window & { getScreenDetails?: () => Promise<ScreenDetails> };
    if (!host.getScreenDetails) return false;
    try {
        await host.getScreenDetails();
        return true;
    } catch {
        return false;
    }
}

export function selectDisplayScreen(details: ScreenDetails) {
    const others = details.screens.filter((screen) =>
        screen.availLeft !== details.currentScreen.availLeft ||
        screen.availTop !== details.currentScreen.availTop
    );
    return others.find((screen) => !screen.isPrimary) ?? others[0];
}

// Must run directly in the click handler, before any network await, to avoid
// losing the browser's user activation required for opening a popup.
export function prepareDisplayWindow() {
    let popup: Window | null = null;
    try {
        popup = window.open('', DISPLAY_WINDOW_NAME, 'popup,width=1280,height=720');
    } catch { /* Some embedded browsers do not support popups. */ }

    displayWindow = popup;
    const display = popup;
    const placement = (async (): Promise<DisplayPlacement> => {
        if (!display) return 'blocked';
        const host = window as Window & { getScreenDetails?: () => Promise<ScreenDetails> };
        if (!host.getScreenDetails) return 'manual';
        let details: ScreenDetails;
        try {
            details = await host.getScreenDetails();
        } catch {
            return 'denied';
        }
        try {
            const target = selectDisplayScreen(details);
            if (display.closed) return 'closed';
            if (!target) return 'single';
            display.moveTo(target.availLeft, target.availTop);
            display.resizeTo(target.availWidth, target.availHeight);
            // Window movement is asynchronous on some operating systems.
            // Allow a small border offset, but do not claim ignored moves worked.
            for (let attempt = 0; attempt < 6; attempt++) {
                if (display.closed) return 'closed';
                if (Math.abs(display.screenX - target.availLeft) <= 32 &&
                    Math.abs(display.screenY - target.availTop) <= 32) return 'placed';
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return 'manual';
        } catch {
            return 'manual';
        }
    })();

    return {
        popup,
        placement,
        show(sessionId: string) {
            if (!display || display.closed) return false;
            try {
                display.location.href = `/present/${encodeURIComponent(sessionId)}/display`;
                return true;
            } catch {
                return false;
            }
        },
    };
}

export function getDisplayWindow(): Window | null {
    return displayWindow && !displayWindow.closed ? displayWindow : null;
}

// A popup cannot enter fullscreen on its own, so the operator's click here is
// handed over with capability delegation and spent by the display window.
export function requestDisplayFullscreen(popup: Window | null = getDisplayWindow()) {
    if (!popup || popup.closed) return false;
    try {
        popup.postMessage(ENTER_FULLSCREEN, {
            targetOrigin: window.location.origin,
            delegate: 'fullscreen',
        } as WindowPostMessageOptions);
        return true;
    } catch {
        return false;
    }
}

// Leaving fullscreen needs no user activation, so a plain message is enough.
export function exitDisplayFullscreen(popup: Window | null = getDisplayWindow()) {
    if (!popup || popup.closed) return false;
    try {
        popup.postMessage(EXIT_FULLSCREEN, window.location.origin);
        return true;
    } catch {
        return false;
    }
}

// The display window owns the truth: it reports every fullscreen change, including
// the ones the operator makes with Esc or F11 over on the projector.
export function watchDisplayFullscreen(onChange: (fullscreen: boolean) => void) {
    const onMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        const message = event.data as DisplayFullscreenMessage | string | null;
        if (!message || typeof message !== 'object' || message.type !== DISPLAY_FULLSCREEN) return;
        onChange(Boolean(message.fullscreen));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
}

// The delegation only works once the display document listens, and the click it
// carries expires in seconds, so give up quietly and leave the manual buttons.
export function delegateFullscreenWhenReady(popup: Window | null, timeoutMs = 4000) {
    if (!popup) return;
    const onMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin || event.data !== DISPLAY_READY) return;
        stop();
        requestDisplayFullscreen(popup);
    };
    const timer = setTimeout(() => stop(), timeoutMs);
    function stop() {
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
    }
    window.addEventListener('message', onMessage);
}

export function closeDisplayWindow() {
    // The window name also reaches a popup that outlived a Control page reload;
    // when none is left this only flashes a blank window we close right away.
    let popup = getDisplayWindow();
    if (!popup) {
        try {
            popup = window.open('', DISPLAY_WINDOW_NAME);
        } catch { /* Nothing to close in browsers without popups. */ }
    }
    try {
        popup?.close();
    } catch { /* The operator can close the window manually. */ }
    displayWindow = null;
}
