(function () {
  function initIskaanEnhancements() {
    if (window.iskaanLoaded) return;
    window.iskaanLoaded = true;

    // --- 1. Inject Styles for Control Panel & Dark Mode ---
    const style = document.createElement("style");
    style.textContent = `
      #iskaan-tools-panel {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 999999;
        background: rgba(13, 47, 95, 0.95);
        color: #ffffff;
        padding: 10px 14px;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        display: flex;
        gap: 12px;
        align-items: center;
        border: 1px solid #C8A24D;
      }
      #iskaan-tools-panel button {
        background: #C8A24D;
        color: #0D2F5F;
        border: none;
        padding: 6px 12px;
        border-radius: 5px;
        font-weight: bold;
        cursor: pointer;
        transition: background 0.2s;
      }
      #iskaan-tools-panel button:hover {
        background: #e5ba5c;
      }
      #iskaan-tools-panel button:disabled {
        background: #888888;
        cursor: not-allowed;
      }
      #iskaan-tools-panel label {
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        user-select: none;
      }
      body.iskaan-dark-mode {
        filter: invert(0.9) hue-rotate(180deg) !important;
      }
      body.iskaan-dark-mode img, 
      body.iskaan-dark-mode video, 
      body.iskaan-dark-mode #iskaan-tools-panel {
        filter: invert(0.9) hue-rotate(180deg) !important;
      }
    `;
    document.head.appendChild(style);

    // --- 2. Create Floating Control Widget ---
    const panel = document.createElement("div");
    panel.id = "iskaan-tools-panel";
    panel.innerHTML = `
      <label>
        <input type="checkbox" id="auto-refresh-toggle"> Auto Refresh (30s)
      </label>
      <button id="dark-mode-toggle">🌙 Dark Mode</button>
      <button id="get-info-btn">⚡ Get Info</button>
    `;
    document.body.appendChild(panel);

    // --- 3. Auto Refresh Feature ---
    let refreshInterval = null;
    const refreshCheckbox = document.getElementById("auto-refresh-toggle");
    refreshCheckbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        refreshInterval = setInterval(() => {
          console.log("[Iskaan Tools] Executing auto-refresh...");
          location.reload();
        }, 30000); // 30 Seconds
      } else {
        clearInterval(refreshInterval);
        console.log("[Iskaan Tools] Auto-refresh disabled.");
      }
    });

    // --- 4. Light / Dark Mode Toggle ---
    const darkModeBtn = document.getElementById("dark-mode-toggle");
    darkModeBtn.addEventListener("click", () => {
      document.body.classList.toggle("iskaan-dark-mode");
      const isDark = document.body.classList.contains("iskaan-dark-mode");
      darkModeBtn.textContent = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";
    });

    // --- 5. Automated Get Info (3-Retry Limit + Loading Lock) ---
    const getInfoBtn = document.getElementById("get-info-btn");
    let isFetching = false;

    async function fetchInfoWithRetry(maxRetries = 3) {
      if (isFetching) return; // Loading Lock
      isFetching = true;
      getInfoBtn.disabled = true;
      getInfoBtn.textContent = "⏳ Processing...";

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[Get Info] Attempt ${attempt} of ${maxRetries}`);

          // Search for existing "Get Info" or "Search" button on the active Iskaan DOM
          const pageButton = Array.from(
            document.querySelectorAll('button, a, input[type="button"]'),
          ).find((el) => {
            const txt = (el.textContent || el.value || "").trim().toLowerCase();
            return (
              txt.includes("get info") ||
              txt.includes("search") ||
              txt.includes("fetch")
            );
          });

          if (pageButton) {
            pageButton.click();
            console.log(
              "[Get Info] Found and clicked native element successfully.",
            );
            break;
          } else {
            throw new Error("Target button not currently visible on page.");
          }
        } catch (err) {
          console.warn(`[Get Info] Attempt ${attempt} failed: ${err.message}`);
          if (attempt === maxRetries) {
            alert(
              "Could not trigger 'Get Info'. Ensure the search panel is loaded on screen.",
            );
          } else {
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Delay 1 second before retrying
          }
        }
      }

      // Unlock
      isFetching = false;
      getInfoBtn.disabled = false;
      getInfoBtn.textContent = "⚡ Get Info";
    }

    getInfoBtn.addEventListener("click", () => fetchInfoWithRetry(3));

    console.log("[Iskaan Tools] Controls initialized successfully.");
  }

  // DOM Load Observer / Polling Safeguard
  const waitForDOM = setInterval(() => {
    if (document.readyState === "complete" || document.body) {
      clearInterval(waitForDOM);
      initIskaanEnhancements();
    }
  }, 500);
})();
