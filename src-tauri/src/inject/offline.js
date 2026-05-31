(function() {
    const OFFLINE_URL = 'offline.html';
    const TARGET_URL = window.pakeConfig?.url || window.location.href;

    function isOffline() {
        return !navigator.onLine;
    }

    function goToOffline() {
        if (!window.location.href.includes(OFFLINE_URL)) {
            localStorage.setItem('pake_original_url', window.location.href);
            window.location.href = OFFLINE_URL;
        }
    }

    function goOnline() {
        if (window.location.href.includes(OFFLINE_URL)) {
            const original = localStorage.getItem('pake_original_url') || TARGET_URL;
            window.location.href = original;
        }
    }

    if (isOffline()) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', goToOffline);
        } else {
            goToOffline();
        }
    }

    window.addEventListener('offline', goToOffline);
    window.addEventListener('online', goOnline);
})();
