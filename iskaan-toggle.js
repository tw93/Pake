window.addEventListener('DOMContentLoaded', () => {
  // --- Floating Control Panel (Bottom Right) ---
  const panel = document.createElement('div');
  panel.id = 'iskaan-control-panel';
  Object.assign(panel.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '99999',
    display: 'flex',
    gap: '10px'
  });

  function styleButton(btn, bgColor) {
    Object.assign(btn.style, {
      backgroundColor: bgColor,
      color: '#FFFFFF',
      border: '2px solid #C8A24D',
      borderRadius: '20px',
      padding: '10px 16px',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
      transition: 'all 0.2s ease'
    });
  }

  // 1. Auto-Refresh Toggle Button
  const refreshBtn = document.createElement('button');
  refreshBtn.innerHTML = '⚡ Auto-Refresh: ON';
  styleButton(refreshBtn, '#0D2F5F');

  let isRefreshEnabled = true;
  let refreshInterval = setInterval(() => location.reload(), 60000);

  refreshBtn.addEventListener('click', () => {
    isRefreshEnabled = !isRefreshEnabled;
    if (isRefreshEnabled) {
      refreshBtn.innerHTML = '⚡ Auto-Refresh: ON';
      refreshBtn.style.backgroundColor = '#0D2F5F';
      refreshInterval = setInterval(() => location.reload(), 60000);
    } else {
      refreshBtn.innerHTML = '⏸️ Auto-Refresh: OFF';
      refreshBtn.style.backgroundColor = '#64748B';
      clearInterval(refreshInterval);
    }
  });

  // 2. Light / Dark Mode Toggle Button
  const themeBtn = document.createElement('button');
  themeBtn.innerHTML = '🌙 Dark Mode';
  styleButton(themeBtn, '#1E293B');

  const darkStyleTag = document.createElement('style');
  darkStyleTag.id = 'iskaan-dark-theme';
  darkStyleTag.innerHTML = `
    body, .main-content, .card, table, header, nav, div.modal-content, .bg-white {
      background-color: #0f172a !important;
      color: #f8fafc !important;
    }
    .card, div.modal-content, div.card-body, .list-group-item {
      background-color: #1e293b !important;
      border-color: #334155 !important;
      color: #f8fafc !important;
    }
    h1, h2, h3, h4, h5, h6, p, span, td, th, label, div {
      color: #f8fafc !important;
    }
    input, select, textarea {
      background-color: #0f172a !important;
      color: #ffffff !important;
      border: 1px solid #475569 !important;
    }
  `;

  let isDarkMode = false;
  themeBtn.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    if (isDarkMode) {
      document.head.appendChild(darkStyleTag);
      themeBtn.innerHTML = '☀️ Light Mode';
      themeBtn.style.backgroundColor = '#C8A24D';
      themeBtn.style.color = '#000000';
    } else {
      if (document.getElementById('iskaan-dark-theme')) {
        document.getElementById('iskaan-dark-theme').remove();
      }
      themeBtn.innerHTML = '🌙 Dark Mode';
      themeBtn.style.backgroundColor = '#1E293B';
      themeBtn.style.color = '#FFFFFF';
    }
  });

  panel.appendChild(refreshBtn);
  panel.appendChild(themeBtn);
  document.body.appendChild(panel);

  // 3. Phone Auto-Detect & Loading Lock with 3 Retries (10s interval)
  let attempts = 0;
  let isExecuting = false;
  let lastTriggeredNumber = '';

  const observer = new MutationObserver(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const getInfoBtn = buttons.find(b => b.textContent.trim().toLowerCase() === 'get info');

    if (!getInfoBtn) {
      attempts = 0;
      lastTriggeredNumber = '';
      return;
    }

    const container = getInfoBtn.closest('div.input-group') || getInfoBtn.parentElement;
    const phoneInput = container ? container.querySelector('input') : null;

    if (phoneInput && !phoneInput.dataset.listenerAttached) {
      phoneInput.dataset.listenerAttached = 'true';

      phoneInput.addEventListener('input', (e) => {
        const digitsOnly = e.target.value.replace(/\D/g, '');
        const isComplete = digitsOnly.length >= 9;

        if (isComplete && digitsOnly !== lastTriggeredNumber && !isExecuting && attempts === 0) {
          lastTriggeredNumber = digitsOnly;
          attempts = 0;
          runGetInfoSequence(getInfoBtn);
        }
      });
    }
  });

  function runGetInfoSequence(button) {
    if (attempts >= 3 || isExecuting) return;

    isExecuting = true;
    attempts++;

    // Lock button state
    button.disabled = true;
    button.style.pointerEvents = 'none';
    button.style.opacity = '0.65';
    button.innerHTML = `⏳ Loading (${attempts}/3)...`;

    button.click();

    // 10-second check
    setTimeout(() => {
      isExecuting = false;
      const nameInput = document.querySelector('input[name*="name"]') || document.querySelectorAll('form input')[2];
      const hasData = nameInput && nameInput.value.trim().length > 0;

      if (!hasData && attempts < 3) {
        runGetInfoSequence(button);
      } else {
        // Reset button for manual use after success or 3 failed tries
        button.disabled = false;
        button.style.pointerEvents = 'auto';
        button.style.opacity = '1';
        button.innerHTML = 'Get Info';
      }
    }, 10000);
  }

  observer.observe(document.body, { childList: true, subtree: true });
});