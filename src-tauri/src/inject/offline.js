(function() {
    var TARGET_URL = window.pakeConfig?.url || window.location.href;

    var OFFLINE_HTML = '<!DOCTYPE html>'
      + '<html><head><meta charset="utf-8"><style>'
      + '*{margin:0;padding:0;box-sizing:border-box}'
      + 'body{display:flex;justify-content:center;align-items:center;height:100vh;background:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,system-ui,sans-serif}'
      + '.card{text-align:center;max-width:400px;padding:40px}'
      + '.icon{width:64px;height:64px;stroke:#636366;margin-bottom:24px}'
      + '.heading{font-size:24px;font-weight:700;color:#fff;margin-bottom:8px}'
      + '.subtext{font-size:16px;color:#AEAEB2;margin-bottom:32px}'
      + '.retry-btn{display:inline-flex;align-items:center;justify-content:center;min-width:120px;height:44px;padding:0 16px;background:#0A84FF;color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;transition:background .15s}'
      + '.retry-btn:hover{background:#409CFF}'
      + '.retry-btn:disabled{background:#636366;cursor:not-allowed}'
      + '.spinner{display:none;width:20px;height:20px;border:2px solid #FFF;border-top-color:transparent;border-radius:50%;animation:spin .6s linear infinite}'
      + '.retry-btn.loading .btn-text{display:none}'
      + '.retry-btn.loading .spinner{display:inline-block}'
      + '@keyframes spin{to{transform:rotate(360deg)}}'
      + '</style></head><body>'
      + '<div class="card">'
      + '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M1 1l22 22"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>'
      + '<path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>'
      + '<path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>'
      + '<path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>'
      + '<path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>'
      + '<line x1="12" y1="20" x2="12.01" y2="20"/>'
      + '</svg>'
      + '<h1 class="heading">No Internet Connection</h1>'
      + '<p class="subtext">Check your network and try again</p>'
      + '<button class="retry-btn" onclick="retry()">'
      + '<span class="btn-text">Retry</span><span class="spinner"></span></button>'
      + '</div>'
      + '<script>var cooldown=false;function retry(){if(cooldown)return;cooldown=true;var b=document.querySelector(".retry-btn");b.classList.add("loading");b.disabled=true;setTimeout(function(){var o=localStorage.getItem("pake_original_url");if(o)window.location.href=o;else window.location.reload()},3000)}</'
      + 'script></body></html>';

    function isOffline() {
        return !navigator.onLine;
    }

    function goToOffline() {
        var href = window.location.href;
        if (!href.includes('offline.html') && !href.includes('data:text/html')) {
            localStorage.setItem('pake_original_url', TARGET_URL);
            document.open();
            document.write(OFFLINE_HTML);
            document.close();
        }
    }

    function goOnline() {
        if (window.location.href.includes('data:text/html') || document.querySelector('.retry-btn')) {
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
