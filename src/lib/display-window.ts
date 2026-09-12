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

export const DISPLAY_MESSAGES: Record<DisplayPlacement, string> = {
    placed: '다른 모니터에 송출 창을 배치했습니다. 전체 화면이 아니면 송출 창의 전체 화면 버튼을 눌러 주세요.',
    manual: '자동 모니터 배치를 사용할 수 없습니다. 송출 창을 원하는 모니터로 옮긴 뒤 전체 화면 버튼을 눌러 주세요.',
    denied: '모니터 접근 권한을 얻지 못했습니다. 브라우저의 사이트 권한에서 창 관리를 허용한 뒤 Display 열기를 다시 눌러 주세요. 송출 창을 직접 옮겨도 됩니다.',
    single: '모니터가 하나만 감지되었습니다. 두 번째 모니터를 확장 모드로 연결한 뒤 Display 열기를 다시 눌러 주세요.',
    blocked: '송출 창이 차단되었습니다. 브라우저에서 팝업을 허용한 뒤 Display 열기를 눌러 주세요. 내장 브라우저에서는 Chrome 또는 Edge로 앱을 열어 주세요.',
    closed: '송출 창이 닫혔습니다. Display 열기를 눌러 다시 열어 주세요.',
};

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
        popup = window.open('', 'church-presentation-display', 'popup,width=1280,height=720');
    } catch { /* Some embedded browsers do not support popups. */ }

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
