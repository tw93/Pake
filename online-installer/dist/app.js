const installButton = document.querySelector("#install-button");
const statusMessage = document.querySelector("#status-message");
const logOutput = document.querySelector("#log-output");
const progressTrack = document.querySelector(".progress-track");
const progressFill = document.querySelector("#progress-fill");
const appName = document.querySelector("#app-name");
const sourceSha = document.querySelector("#source-sha");
const connectionState = document.querySelector("#connection-state");
const copyLogButton = document.querySelector("#copy-log");
const stageItems = [...document.querySelectorAll(".stage-item")];

let running = false;
let activeStage = "resolve";
let followLog = true;

function timestamp() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function appendLog(kind, message) {
  const line = document.createElement("div");
  line.className = `log-line log-${kind}`;

  const time = document.createElement("span");
  time.className = "log-time";
  time.textContent = timestamp();

  const channel = document.createElement("span");
  channel.className = "log-channel";
  channel.textContent =
    kind === "stderr"
      ? "STDERR"
      : kind === "stdout"
        ? "STDOUT"
        : kind === "complete"
          ? "DONE"
          : "SYSTEM";

  const content = document.createElement("span");
  content.className = "log-message";
  content.textContent = message;

  line.append(time, channel, content);
  logOutput.append(line);
  if (followLog) logOutput.scrollTop = logOutput.scrollHeight;
}

function setStage(stage) {
  const order = ["resolve", "download", "verify", "install"];
  activeStage = stage;
  const activeIndex = order.indexOf(stage);
  stageItems.forEach((item) => {
    const index = order.indexOf(item.dataset.stage);
    item.classList.toggle("is-active", index === activeIndex);
    item.classList.toggle("is-complete", index < activeIndex);
  });
}

function setStatus(message, state = "neutral") {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("is-error", state === "error");
  statusMessage.classList.toggle("is-success", state === "success");
}

function handleEvent(event) {
  if (!event) return;
  const {
    kind,
    message,
    downloaded,
    total,
    applicationName,
    sourceSha: sha,
  } = event;

  if (kind === "manifest") {
    appName.textContent = applicationName || "Resolved Pake application";
    sourceSha.textContent = sha ? sha.slice(0, 12) : "—";
    setStage("download");
  } else if (kind === "progress") {
    setStage("download");
    const percent = total ? Math.min(100, (downloaded / total) * 100) : 0;
    progressFill.style.width = `${percent}%`;
    progressTrack.setAttribute("aria-valuenow", String(Math.round(percent)));
    if (percent >= 100) setStage("verify");
  } else if (
    kind === "stdout" ||
    kind === "stderr" ||
    message?.startsWith("Launching:")
  ) {
    setStage("install");
  }

  if (kind === "error") {
    setStatus(message, "error");
    connectionState.textContent = "FAILED";
  } else if (kind === "complete") {
    setStatus(message, "success");
    connectionState.textContent = "COMPLETE";
    stageItems.forEach((item) => {
      item.classList.remove("is-active");
      item.classList.add("is-complete");
    });
    progressFill.style.width = "100%";
    progressTrack.setAttribute("aria-valuenow", "100");
  } else if (kind === "status" || kind === "manifest") {
    setStatus(message);
  }

  appendLog(kind, message);
}

async function startInstall() {
  if (running) return;
  running = true;
  installButton.disabled = true;
  installButton.textContent = "Installing…";
  connectionState.textContent = "CONNECTED";
  setStage("resolve");
  appendLog("system", "Installation session started.");

  try {
    const tauriCore = window.__TAURI__?.core;
    if (!tauriCore) {
      throw new Error("The native installer bridge is unavailable.");
    }
    const channel = new tauriCore.Channel();
    channel.onmessage = handleEvent;
    await tauriCore.invoke("start_install", { onEvent: channel });
  } catch (error) {
    const message =
      typeof error === "string"
        ? error
        : error?.message || "Installation failed unexpectedly.";
    handleEvent({ kind: "error", message });
  } finally {
    running = false;
    installButton.disabled = false;
    installButton.textContent = "Retry latest";
  }
}

logOutput.addEventListener("scroll", () => {
  const remaining =
    logOutput.scrollHeight - logOutput.scrollTop - logOutput.clientHeight;
  followLog = remaining < 36;
});

copyLogButton.addEventListener("click", async () => {
  const text = [...logOutput.querySelectorAll(".log-line")]
    .map((line) => line.textContent.trim())
    .join("\n");
  try {
    await navigator.clipboard.writeText(text);
    copyLogButton.textContent = "Copied";
    window.setTimeout(() => {
      copyLogButton.textContent = "Copy log";
    }, 1200);
  } catch {
    setStatus("The log could not be copied.", "error");
  }
});

installButton.addEventListener("click", startInstall);

if (!window.__TAURI__?.core) {
  connectionState.textContent = "PREVIEW";
  appendLog("system", "UI preview mode; native installation is disabled.");
} else {
  window.addEventListener("DOMContentLoaded", () => {
    window.setTimeout(startInstall, 150);
  });
}
