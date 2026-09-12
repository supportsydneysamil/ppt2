'use client';

import { useEffect, useState } from 'react';

export function DisplayFullscreen() {
    const [fullscreen, setFullscreen] = useState(true);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const update = () => setFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', update);
        // Attempt automatically; browsers may require a click in this window.
        const request = async () => {
            try {
                if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
            } catch { /* Show the explicit user-activated fullscreen button. */ }
            update();
        };
        void request();
        return () => document.removeEventListener('fullscreenchange', update);
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
