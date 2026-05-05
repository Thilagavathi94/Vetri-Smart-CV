(function () {
    const DEFAULT_EXPIRED_MESSAGE = 'Your session has expired. Please log in again.';
    const ACTIVITY_EVENTS = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];

    let monitorState = null;

    function now() {
        return Date.now();
    }

    function getCurrentPath() {
        return window.location.pathname + window.location.search;
    }

    function showFallbackNotice(message, kind) {
        let box = document.getElementById('sessionMonitorNotice');
        if (!box) {
            box = document.createElement('div');
            box.id = 'sessionMonitorNotice';
            box.style.cssText = [
                'position:fixed',
                'top:20px',
                'left:50%',
                'transform:translateX(-50%)',
                'z-index:100000',
                'max-width:min(92vw, 540px)',
                'padding:14px 18px',
                'border-radius:14px',
                'font:600 14px/1.5 Segoe UI,sans-serif',
                'box-shadow:0 16px 40px rgba(0,0,0,0.18)'
            ].join(';');
            document.body.appendChild(box);
        }

        const isWarning = kind === 'warning';
        box.style.background = isWarning ? '#fff7ed' : '#fef2f2';
        box.style.color = isWarning ? '#9a3412' : '#b91c1c';
        box.style.border = isWarning ? '1px solid #fdba74' : '1px solid #fca5a5';
        box.textContent = message;
    }

    function notify(message, kind) {
        if (monitorState && typeof monitorState.onNotify === 'function') {
            monitorState.onNotify(message, kind);
            return;
        }
        if (typeof window.showToast === 'function') {
            window.showToast(message, kind === 'warning' ? 'error' : 'error');
            return;
        }
        showFallbackNotice(message, kind);
    }

    function cleanupListeners() {
        if (!monitorState) return;
        ACTIVITY_EVENTS.forEach((eventName) => {
            window.removeEventListener(eventName, monitorState.activityHandler, true);
        });
        document.removeEventListener('visibilitychange', monitorState.visibilityHandler, true);
    }

    function stop() {
        if (!monitorState) return;
        cleanupListeners();
        clearInterval(monitorState.tickTimer);
        monitorState = null;
    }

    function redirectToLogin(message) {
        if (!monitorState || monitorState.redirected) return;
        monitorState.redirected = true;
        sessionStorage.setItem('sessionExpiredMessage', message || DEFAULT_EXPIRED_MESSAGE);
        const redirect = encodeURIComponent((monitorState.getRedirectUrl || getCurrentPath)());
        window.location.href = '/login?sessionExpired=1&redirect=' + redirect;
    }

    async function syncSession(force) {
        if (!monitorState || monitorState.syncing || monitorState.redirected) return;
        const msSinceActivity = now() - monitorState.lastActivityAt;
        if (!force && msSinceActivity > monitorState.idleCutoffMs) return;

        monitorState.syncing = true;
        try {
            const response = await fetch('/api/auth/session', {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                credentials: 'same-origin',
                cache: 'no-store'
            });
            const data = await response.json();
            if (!data.loggedIn) {
                redirectToLogin(monitorState.expiredMessage);
                return;
            }

            const timeoutSeconds = Number(data.sessionTimeoutSeconds || monitorState.timeoutSeconds || 7200);
            monitorState.timeoutSeconds = timeoutSeconds;
            monitorState.timeoutMs = timeoutSeconds * 1000;
            monitorState.warningMs = Math.min(
                Number(data.warningThresholdSeconds || 60) * 1000,
                Math.max(30_000, monitorState.timeoutMs - 5_000)
            );
            monitorState.lastServerSyncAt = now();
            monitorState.warningShown = false;
            monitorState.lastKnownUser = data.user || monitorState.lastKnownUser;
        } catch (error) {
            console.warn('Session sync failed', error);
        } finally {
            monitorState.syncing = false;
        }
    }

    function evaluateSession() {
        if (!monitorState || monitorState.redirected) return;

        const remainingMs = (monitorState.lastServerSyncAt + monitorState.timeoutMs) - now();
        if (remainingMs <= 0) {
            redirectToLogin(monitorState.expiredMessage);
            return;
        }

        if (remainingMs <= monitorState.warningMs && !monitorState.warningShown) {
            monitorState.warningShown = true;
            notify(
                monitorState.warningMessage || 'Your session will expire soon. Continue using the app to stay signed in.',
                'warning'
            );
        }

        if (remainingMs <= monitorState.heartbeatLeadMs) {
            syncSession(false);
        }
    }

    function start(options) {
        stop();

        if (!options || !options.loggedIn) return;

        const timeoutSeconds = Number(options.sessionTimeoutSeconds || 7200);
        const timeoutMs = timeoutSeconds * 1000;

        monitorState = {
            timeoutSeconds,
            timeoutMs,
            warningMs: Math.min(Number(options.warningThresholdSeconds || 60) * 1000, Math.max(30_000, timeoutMs - 5_000)),
            heartbeatLeadMs: Math.min(5 * 60 * 1000, Math.max(60_000, Math.floor(timeoutMs / 6))),
            idleCutoffMs: Math.min(15 * 60 * 1000, Math.max(2 * 60 * 1000, Math.floor(timeoutMs / 3))),
            lastServerSyncAt: now(),
            lastActivityAt: now(),
            lastKnownUser: options.user || null,
            warningShown: false,
            syncing: false,
            redirected: false,
            expiredMessage: options.expiredMessage || DEFAULT_EXPIRED_MESSAGE,
            warningMessage: options.warningMessage || 'Your session is about to expire.',
            getRedirectUrl: options.getRedirectUrl || getCurrentPath,
            onNotify: options.onNotify
        };

        monitorState.activityHandler = function () {
            if (!monitorState) return;
            monitorState.lastActivityAt = now();
            const remainingMs = (monitorState.lastServerSyncAt + monitorState.timeoutMs) - now();
            if (remainingMs <= monitorState.heartbeatLeadMs) {
                syncSession(false);
            }
        };

        monitorState.visibilityHandler = function () {
            if (!monitorState || document.hidden) return;
            syncSession(false);
        };

        ACTIVITY_EVENTS.forEach((eventName) => {
            window.addEventListener(eventName, monitorState.activityHandler, { capture: true, passive: true });
        });
        document.addEventListener('visibilitychange', monitorState.visibilityHandler, true);

        monitorState.tickTimer = setInterval(evaluateSession, 15_000);
        evaluateSession();
    }

    window.VetriSessionMonitor = {
        start,
        stop,
        syncNow: function () { return syncSession(true); }
    };
})();