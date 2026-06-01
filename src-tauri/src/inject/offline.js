(function() {
    const TARGET_URL = window.pakeConfig?.url || window.location.href;
    const OFFLINE_FILE = 'offline.html';

    function getLocalOfflineUrl() {
        // When already on a Tauri local page, use relative URL
        if (window.location.hostname === 'tauri.localhost' || window.location.protocol === 'tauri:') {
            return OFFLINE_FILE;
        }
        // When on a remote page, use absolute Tauri protocol URL
        return 'https://tauri.localhost/' + OFFLINE_FILE;
    }

    function isOffline() {
        return !navigator.onLine;
    }

    function goToOffline() {
        var href = window.location.href;
        if (!href.includes(OFFLINE_FILE)) {
            localStorage.setItem('pake_original_url', TARGET_URL);
            window.location.replace(getLocalOfflineUrl());
        }
    }

    function goOnline() {
        if (window.location.href.includes(OFFLINE_FILE)) {
            var original = localStorage.getItem('pake_original_url') || TARGET_URL;
            window.location.replace(original);
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
