'use client';

import { useEffect, useState } from 'react';
import { DISPLAY_READY, ENTER_FULLSCREEN } from '@/lib/display-window';

export function DisplayFullscreen() {
    const [fullscreen, setFullscreen] = useState(true);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const update = () => setFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', update);

        const enterFullscreen = async () => {
            try {
                if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
            } catch { /* Show the explicit user-activated fullscreen button. */ }
            update();
        };

        // The control window delegates its click so this window may go
        // fullscreen without the operator walking over to the projector.
        const onMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin || event.data !== ENTER_FULLSCREEN) return;
            void enterFullscreen();
        };
        window.addEventListener('message', onMessage);

        // Attempt automatically; browsers may require a click in this window.
        void enterFullscreen();
        try {
            window.opener?.postMessage(DISPLAY_READY, window.location.origin);
        } catch { /* Opened without an opener, so nobody can delegate a click. */ }

        return () => {
            document.removeEventListener('fullscreenchange', update);
            window.removeEventListener('message', onMessage);
        };
    }, []);

    if (fullscreen) return null;
    return (
        <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 1000 }}>
            <button className="btn btn-secondary" onClick={async () => {
                try {
                    await document.documentElement.requestFullscreen();
                    setFailed(false);
                } catch { setFailed(true); }
            }}>⛶ 전체 화면</button>
            {failed && <p role="status" style={{ color: '#fff', background: '#222', padding: 8 }}>브라우저의 전체 화면 기능(F11)을 사용해 주세요.</p>}
        </div>
    );
}
