/* OXR JARVIS — chat, voice, saved conversations and website preview */
const $ = (selector, root = document) => root.querySelector(selector);
const form = $("#chat-form");
const textarea = $("#message");
const chat = $("#chat");
const welcome = $("#welcome");
const sendBtn = $("#send-btn");
const micBtn = $("#mic-btn");
const voiceStatus = $("#voice-status");
const speakReplies = $("#speak-replies");
const newChatBtn = $("#new-chat");
const composerWrap = $(".composer-wrap");
const main = $(".main");
if (!form || !textarea || !chat || !main) {
  console.error("OXR JARVIS: Required chat elements were not found.");
} else {
  let history = [];
  let busy = false;
  let recognition = null;
  let currentChatId = null;
  let sessions = [];
  let isSpeaking = false;
  let isListening = false;
  let requestController = null;
  let developerModeButton = null;
  let memoryButton = null;
  let previewFrame = null;
  let previewPanel = null;
  let previewStatus = null;
  const STORAGE_KEY = "oxr_jarvis_chats_v1";
  const MEMORY_KEY = "oxr_jarvis_memory_v1";
  let developerMode = readStoredFlag("oxr_jarvis_developer_mode_v1");
  let userMemory = readStoredMemory();
  let lastLanguage = /^(ar)(-|$)/i.test(navigator.language || "") ? "ar" : "en";
  function readStoredFlag(key) {
    try { return localStorage.getItem(key) === "true"; } catch { return false; }
  }
  function readStoredMemory() {
    try { return (localStorage.getItem(MEMORY_KEY) || "").slice(0, 3000); } catch { return ""; }
  }
  function textLanguage(text) {
    const value = String(text || "");
    const arabic = (value.match(/[\u0600-\u06FF]/g) || []).length;
    const latin = (value.match(/[A-Za-z]/g) || []).length;
    if (arabic > latin) return "ar";
    if (latin > arabic) return "en";
    return lastLanguage;
  }
  function applyDeveloperMode() {
    if (!developerModeButton) return;
    developerModeButton.textContent = developerMode ? "DEVELOPER MODE: ON" : "DEVELOPER MODE: OFF";
    developerModeButton.setAttribute("aria-pressed", String(developerMode));
    developerModeButton.classList.toggle("active", developerMode);
  }
  const makeId = () =>
    `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const escapeHtml = (value = "") =>
    String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      :root {
        --jarvis-cyan: #42eaff;
        --jarvis-blue: #079cce;
        --jarvis-bg: #050b14;
        --jarvis-panel: rgba(8, 20, 34, .94);
        --jarvis-border: rgba(66, 234, 255, .19);
        --jarvis-text: #e4f8ff;
        --jarvis-muted: #7b9aaa;
      }
      .oxr-jarvis {
        display: grid;
        grid-template-columns: 245px minmax(0, 1fr);
        gap: 14px;
        min-height: 760px;
        height: calc(100vh - 115px);
        max-height: 1100px;
        color: var(--jarvis-text);
        font-family: inherit;
        position: relative;
        isolation: isolate;
      }
      .oxr-jarvis * { box-sizing: border-box; }
      .oxr-history {
        background: var(--jarvis-panel);
        border: 1px solid var(--jarvis-border);
        border-radius: 18px;
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
      }
      .oxr-history-head {
        padding: 18px 14px 14px;
        border-bottom: 1px solid var(--jarvis-border);
      }
      .oxr-brand {
        color: var(--jarvis-cyan);
        font-size: 18px;
        font-weight: 800;
        letter-spacing: 3px;
      }
      .oxr-subbrand {
        color: var(--jarvis-muted);
        font-size: 10px;
        letter-spacing: 2px;
        margin-top: 5px;
      }
      .oxr-new-chat {
        width: 100%;
        margin-top: 17px;
        border: 1px solid rgba(66,234,255,.45);
        background: rgba(66,234,255,.08);
        color: var(--jarvis-cyan);
        border-radius: 10px;
        padding: 11px;
        cursor: pointer;
        font: inherit;
        font-size: 13px;
        transition: .2s;
      }
      .oxr-new-chat:hover {
        background: rgba(66,234,255,.17);
        box-shadow: 0 0 20px rgba(66,234,255,.1);
      }
      .oxr-history-label {
        color: var(--jarvis-muted);
        font-size: 10px;
        letter-spacing: 1.8px;
        padding: 16px 14px 8px;
      }
      .oxr-saved-chats {
        overflow-y: auto;
        padding: 0 8px 12px;
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .oxr-chat-entry {
        border: 1px solid transparent;
        background: transparent;
        color: #c8e2ec;
        padding: 11px 10px;
        border-radius: 9px;
        text-align: left;
        cursor: pointer;
        font: inherit;
        font-size: 12px;
        line-height: 1.45;
        overflow-wrap: anywhere;
      }
      .oxr-chat-entry:hover {
        background: rgba(66,234,255,.06);
      }
      .oxr-chat-entry.active {
        border-color: rgba(66,234,255,.25);
        background: rgba(66,234,255,.09);
        color: var(--jarvis-cyan);
      }
      .oxr-main-area {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 14px;
        min-width: 0;
        min-height: 0;
      }
      .oxr-stage {
        min-height: 235px;
        border: 1px solid var(--jarvis-border);
        border-radius: 18px;
        background:
          radial-gradient(ellipse at 50% 45%, rgba(0,143,194,.13), transparent 47%),
          linear-gradient(145deg, #07111e, #040912);
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .oxr-stage:before {
        content: "";
        position: absolute;
        inset: 0;
        opacity: .18;
        background-image:
          linear-gradient(rgba(66,234,255,.12) 1px, transparent 1px),
          linear-gradient(90deg, rgba(66,234,255,.12) 1px, transparent 1px);
        background-size: 32px 32px;
        mask-image: linear-gradient(transparent, black, transparent);
        pointer-events: none;
      }
      .oxr-stage-top {
        position: absolute;
        top: 15px;
        left: 18px;
        right: 18px;
        display: flex;
        justify-content: space-between;
        gap: 10px;
        color: var(--jarvis-muted);
        font-size: 10px;
        letter-spacing: 1.6px;
      }
      .oxr-live-dot {
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--jarvis-cyan);
        box-shadow: 0 0 10px var(--jarvis-cyan);
        margin-right: 7px;
      }
      .oxr-core {
        width: 125px;
        height: 125px;
        border-radius: 50%;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: 8px;
        filter: drop-shadow(0 0 16px rgba(66,234,255,.28));
      }
      .oxr-core:before, .oxr-core:after {
        content: "";
        position: absolute;
        border: 1px solid rgba(66,234,255,.48);
        border-radius: 50%;
        inset: 1px;
        animation: oxrOrbit 8s linear infinite;
      }
      .oxr-core:after {
        inset: 12px -8px;
        border-color: rgba(7,156,206,.65);
        animation-direction: reverse;
        animation-duration: 11s;
      }
      .oxr-core-inner {
        width: 78px;
        height: 78px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: radial-gradient(circle, #147e9b 0%, #073247 43%, #06101c 74%);
        border: 1px solid rgba(66,234,255,.85);
        box-shadow: inset 0 0 20px rgba(66,234,255,.3),
                    0 0 28px rgba(66,234,255,.2);
      }
      .oxr-wave {
        height: 42px;
        width: 57px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
      }
      .oxr-wave span {
        display: block;
        height: 5px;
        width: 3px;
        border-radius: 4px;
        background: var(--jarvis-cyan);
        box-shadow: 0 0 7px rgba(66,234,255,.75);
        transform-origin: center;
        transition: height .07s linear;
      }
      .oxr-jarvis.is-speaking .oxr-wave span,
      .oxr-jarvis.is-listening .oxr-wave span {
        animation: oxrWave .42s ease-in-out infinite alternate;
      }
      .oxr-jarvis.is-speaking .oxr-wave span:nth-child(2n),
      .oxr-jarvis.is-listening .oxr-wave span:nth-child(2n) {
        animation-delay: .13s;
      }
      .oxr-jarvis.is-thinking .oxr-core-inner {
        animation: oxrPulse 1s ease-in-out infinite;
      }
      .oxr-jarvis.is-speaking .oxr-core-inner {
        box-shadow: inset 0 0 24px rgba(66,234,255,.5),
                    0 0 34px rgba(66,234,255,.42);
      }
      .oxr-jarvis.is-listening .oxr-core {
        filter: drop-shadow(0 0 24px rgba(66,234,255,.6));
      }
      .oxr-system-status {
        margin-top: 12px;
        color: var(--jarvis-cyan);
        font-size: 11px;
        letter-spacing: 2.4px;
        text-align: center;
      }
      .oxr-system-hint {
        margin-top: 7px;
        color: var(--jarvis-muted);
        font-size: 11px;
        text-align: center;
      }
      .oxr-chat-panel {
        min-height: 0;
        display: flex;
        flex-direction: column;
        border: 1px solid var(--jarvis-border);
        border-radius: 18px;
        overflow: hidden;
        background: var(--jarvis-panel);
      }
      .oxr-chat-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid var(--jarvis-border);
        color: var(--jarvis-cyan);
        font-size: 11px;
        letter-spacing: 1.8px;
      }
      .oxr-chat-heading small {
        color: var(--jarvis-muted);
        letter-spacing: .4px;
        font-size: 10px;
      }
      .oxr-heading-controls {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 7px;
        min-width: 0;
        flex-wrap: wrap;
      }
      .oxr-mode-toggle, .oxr-memory-toggle {
        border: 1px solid rgba(66,234,255,.28);
        background: rgba(66,234,255,.05);
        color: var(--jarvis-muted);
        border-radius: 7px;
        padding: 6px 8px;
        font: inherit;
        font-size: 9px;
        letter-spacing: .5px;
        cursor: pointer;
      }
      .oxr-mode-toggle.active {
        background: rgba(66,234,255,.14);
        border-color: rgba(66,234,255,.7);
        color: var(--jarvis-cyan);
      }
      .oxr-mode-toggle:focus-visible, .oxr-memory-toggle:focus-visible {
        outline: 2px solid var(--jarvis-cyan);
        outline-offset: 2px;
      }
      .oxr-chat-content {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .oxr-chat-content #welcome {
        flex-shrink: 0;
      }
      .oxr-chat-content #chat {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 12px;
        scroll-behavior: smooth;
      }
      .oxr-chat-content .composer-wrap {
        flex-shrink: 0;
        padding: 10px;
        border-top: 1px solid var(--jarvis-border);
        background: rgba(3,10,18,.8);
      }
      .oxr-chat-content #message {
        max-width: 100%;
      }
      .oxr-jarvis .oxr-preview {
        display: none;
        min-height: 300px;
        border: 1px solid var(--jarvis-border);
        border-radius: 18px;
        overflow: hidden;
        background: #fff;
      }
      .oxr-jarvis.has-preview .oxr-main-area {
        grid-template-columns: minmax(0, 1fr) minmax(280px, .9fr);
      }
      .oxr-jarvis.has-preview .oxr-preview {
        display: flex;
        flex-direction: column;
      }
      .oxr-preview-head {
        background: #07111e;
        color: var(--jarvis-cyan);
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        font-size: 10px;
        letter-spacing: 1.5px;
      }
      .oxr-preview-head button {
        color: var(--jarvis-cyan);
        background: transparent;
        border: 1px solid var(--jarvis-border);
        padding: 5px 8px;
        border-radius: 6px;
        cursor: pointer;
      }
      .oxr-preview iframe {
        width: 100%;
        flex: 1;
        min-height: 300px;
        border: 0;
        background: white;
      }
      .oxr-jarvis .oxr-message {
        overflow-wrap: anywhere;
      }
      .oxr-jarvis .oxr-message pre {
        max-width: 100%;
        overflow-x: auto;
      }
      .oxr-jarvis .oxr-error {
        color: #ff9b9b;
      }
      @keyframes oxrOrbit {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes oxrWave {
        from { height: 5px; }
        to { height: 30px; }
      }
      @keyframes oxrPulse {
        0%,100% { transform: scale(1); }
        50% { transform: scale(1.045); }
      }
      @media (min-width: 1200px) {
        .oxr-jarvis.has-preview .oxr-main-area {
          grid-template-columns: minmax(0, 1fr) minmax(320px, .92fr);
        }
      }
      @media (max-width: 950px) {
        .oxr-jarvis {
          grid-template-columns: 210px minmax(0, 1fr);
          height: auto;
          min-height: 800px;
        }
        .oxr-jarvis.has-preview .oxr-main-area {
          grid-template-columns: minmax(0, 1fr);
        }
        .oxr-jarvis.has-preview .oxr-preview iframe {
          min-height: 430px;
        }
      }
      @media (max-width: 650px) {
        .oxr-jarvis {
          grid-template-columns: minmax(0, 1fr);
          min-height: 0;
          height: auto;
        }
        .oxr-history { min-height: 0; }
        .oxr-saved-chats {
          flex-direction: row;
          overflow-x: auto;
          max-height: 80px;
        }
        .oxr-chat-entry {
          min-width: 140px;
          max-width: 180px;
        }
        .oxr-history-head { padding: 13px; }
        .oxr-history-label { padding-top: 10px; }
        .oxr-stage { min-height: 225px; }
        .oxr-chat-panel { min-height: 520px; }
        .oxr-chat-content #chat { min-height: 250px; }
        .oxr-preview iframe { min-height: 380px; }
      }
    `;
    document.head.appendChild(style);
  }
  function buildInterface() {
    injectStyles();
    const shell = document.createElement("section");
    shell.className = "oxr-jarvis";
    shell.innerHTML = `
      <aside class="oxr-history">
        <div class="oxr-history-head">
          <div class="oxr-brand">OXR JARVIS</div>
          <div class="oxr-subbrand">PERSONAL AI SYSTEM</div>
          <button class="oxr-new-chat" type="button">＋ NEW CONVERSATION</button>
        </div>
        <div class="oxr-history-label">SAVED CONVERSATIONS</div>
        <div class="oxr-saved-chats"></div>
      </aside>
      <section class="oxr-main-area">
        <div class="oxr-main-column" style="display:flex;flex-direction:column;gap:14px;min-width:0;min-height:0">
          <div class="oxr-stage">
            <div class="oxr-stage-top">
              <span><i class="oxr-live-dot"></i> OXR NEURAL INTERFACE</span>
              <span>ONLINE</span>
            </div>
            <div class="oxr-core">
              <div class="oxr-core-inner">
                <div class="oxr-wave" aria-label="Voice activity">
                  ${Array.from({ length: 11 }, () => "<span></span>").join("")}
                </div>
              </div>
            </div>
            <div class="oxr-system-status">SYSTEM ONLINE</div>
            <div class="oxr-system-hint">Type or use the microphone to talk to JARVIS</div>
          </div>
          <section class="oxr-chat-panel">
            <div class="oxr-chat-heading">
              <span>JARVIS CONVERSATION</span>
              <div class="oxr-heading-controls">
                <small>LOCAL SESSION</small>
                <button type="button" class="oxr-memory-toggle" aria-label="Edit saved memory">MEMORY</button>
                <button type="button" class="oxr-mode-toggle" aria-pressed="false">DEVELOPER MODE: OFF</button>
              </div>
            </div>
            <div class="oxr-chat-content"></div>
          </section>
        </div>
        <section class="oxr-preview">
          <div class="oxr-preview-head">
            <span>LIVE WEBSITE PREVIEW</span>
            <button type="button" class="oxr-close-preview">CLOSE</button>
          </div>
          <iframe title="Generated website preview"
            sandbox="allow-scripts"
            referrerpolicy="no-referrer"></iframe>
        </section>
      </section>
    `;
    main.appendChild(shell);
    const content = $(".oxr-chat-content", shell);
    const historyList = $(".oxr-saved-chats", shell);
    // Keep the original chat elements and their IDs so existing controls still work.
    if (welcome) content.appendChild(welcome);
    content.appendChild(chat);
    if (composerWrap) content.appendChild(composerWrap);
    if (newChatBtn) {
      const placeholderNewChat = $(".oxr-history-head > .oxr-new-chat", shell);
      if (placeholderNewChat) placeholderNewChat.remove();
      newChatBtn.textContent = "＋ NEW CONVERSATION";
      $(".oxr-history-head", shell).appendChild(newChatBtn);
      newChatBtn.className = "oxr-new-chat";
    }
    previewPanel = $(".oxr-preview", shell);
    previewFrame = $("iframe", previewPanel);
    previewStatus = $(".oxr-system-status", shell);
    developerModeButton = $(".oxr-mode-toggle", shell);
    memoryButton = $(".oxr-memory-toggle", shell);
    if (developerModeButton) {
      developerModeButton.addEventListener("click", () => {
        developerMode = !developerMode;
        try { localStorage.setItem("oxr_jarvis_developer_mode_v1", String(developerMode)); } catch {}
        applyDeveloperMode();
        setStatus(developerMode ? "DEVELOPER MODE ACTIVE" : "SYSTEM ONLINE");
      });
    }
    if (memoryButton) {
      memoryButton.addEventListener("click", () => {
        const updated = window.prompt(
          "JARVIS saved memory (stored only in this browser). Do not save passwords or sensitive information. Leave blank to clear it:",
          userMemory
        );
        if (updated === null) return;
        userMemory = updated.trim().slice(0, 3000);
        try {
          if (userMemory) localStorage.setItem(MEMORY_KEY, userMemory);
          else localStorage.removeItem(MEMORY_KEY);
          setStatus(userMemory ? "MEMORY SAVED LOCALLY" : "MEMORY CLEARED");
        } catch {
          setStatus("MEMORY COULD NOT BE SAVED");
        }
      });
    }
    $(".oxr-close-preview", shell).addEventListener("click", () => {
      shell.classList.remove("has-preview");
    });
    return { shell, historyList };
  }
  const { shell, historyList } = buildInterface();
  function setStatus(label, mode = "") {
    shell.classList.remove("is-speaking", "is-listening", "is-thinking");
    if (mode) shell.classList.add(mode);
    if (previewStatus) previewStatus.textContent = label;
  }
  function saveSessions() {
    try {
      // Keep the latest 25 conversations to avoid unbounded local storage growth.
      sessions.sort((a, b) => b.updatedAt - a.updatedAt);
      sessions = sessions.slice(0, 25);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.warn("OXR JARVIS could not save conversations in this browser.", error);
    }
  }
  function loadSessions() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      sessions = Array.isArray(stored)
        ? stored.filter((item) => item && item.id && Array.isArray(item.messages))
        : [];
    } catch {
      sessions = [];
    }
  }
  function currentSession() {
    return sessions.find((item) => item.id === currentChatId);
  }
  function ensureSession() {
    let session = currentSession();
    if (!session) {
      session = {
        id: makeId(),
        title: "New conversation",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
        history: [],
        projectHtml: ""
      };
      sessions.unshift(session);
      currentChatId = session.id;
    }
    return session;
  }
  function renderSessionList() {
    historyList.replaceChildren();
    const ordered = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!ordered.length) {
      const empty = document.createElement("div");
      empty.textContent = "Your conversations will appear here.";
      empty.style.cssText = "padding:12px;color:var(--jarvis-muted);font-size:12px;line-height:1.5";
      historyList.appendChild(empty);
      return;
    }
    ordered.forEach((session) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "oxr-chat-entry" +
        (session.id === currentChatId ? " active" : "");
      button.textContent = session.title || "New conversation";
      button.title = button.textContent;
      button.addEventListener("click", () => {
        if (busy || session.id === currentChatId) return;
        openSession(session.id);
      });
      historyList.appendChild(button);
    });
  }
  function addMessage(role, text, isError = false) {
  const isUser = role === "user";
  const row = document.createElement("div");
  row.className = `oxr-message ${
    isUser ? "oxr-user-message" : "oxr-jarvis-message"
  }`;
  if (isError) row.classList.add("oxr-error");
  const header = document.createElement("div");
  header.className = "oxr-message-header";
  const dot = document.createElement("span");
  dot.className = "oxr-message-dot";
  dot.textContent = isUser ? "●" : "◉";
  const name = document.createElement("span");
  name.className = "oxr-message-name";
  name.textContent = isUser ? "ME" : "JARVIS TALKING";
  header.append(dot, name);
  const body = document.createElement("div");
  body.className = "oxr-message-content";
  body.textContent = text;
  row.append(header, body);
  chat.appendChild(row);
  if (welcome) welcome.classList.add("hidden");
  chat.classList.remove("hidden");
  chat.scrollTop = chat.scrollHeight;
  return body;
}
  function clearVisibleChat() {
    chat.replaceChildren();
    if (welcome) welcome.classList.remove("hidden");
    chat.classList.add("hidden");
  }
  function showPreview(html) {
    if (!html || !previewFrame) return;
    previewFrame.srcdoc = html;
    shell.classList.add("has-preview");
  }
  function clearPreview() {
    if (previewFrame) previewFrame.srcdoc = "";
    shell.classList.remove("has-preview");
  }
  function extractWebsite(data) {
    const isCompleteDocument = (value) =>
      typeof value === "string" &&
      /<html\b[^>]*>/i.test(value) &&
      /<head\b[^>]*>/i.test(value) &&
      /<body\b[^>]*>/i.test(value) &&
      /<\/body\s*>/i.test(value) &&
      /<\/html\s*>/i.test(value);
    if (isCompleteDocument(data?.projectHtml)) return data.projectHtml;
    const reply = typeof data?.reply === "string" ? data.reply : "";
    const fenced = reply.match(/```(?:html|htm)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1].trim() : reply.trim();
    return isCompleteDocument(candidate) ? candidate : "";
  }
  function saveCurrentSession() {
    const session = currentSession();
    if (!session) return;
    session.history = history.slice(-20);
    session.updatedAt = Date.now();
    saveSessions();
    renderSessionList();
  }
  function renderSavedMessages(session) {
    clearVisibleChat();
    history = Array.isArray(session.history) ? session.history.slice(-20) : [];
    for (const message of session.messages || []) {
      addMessage(message.role, message.text || "", Boolean(message.isError));
    }
    if (!session.messages?.length && welcome) {
      welcome.classList.remove("hidden");
      chat.classList.add("hidden");
    }
    if (session.projectHtml) showPreview(session.projectHtml);
    else clearPreview();
    renderSessionList();
  }
  function openSession(id) {
    const session = sessions.find((item) => item.id === id);
    if (!session) return;
    currentChatId = id;
    renderSessionList();
    renderSavedMessages(session);
    setStatus("SYSTEM ONLINE");
  }
  function createNewSession() {
    if (busy) return;
    if (recognition && isListening) {
      try { recognition.stop(); } catch {}
    }
    stopSpeech();
    const session = {
      id: makeId(),
      title: "New conversation",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      history: [],
      projectHtml: ""
    };
    sessions.unshift(session);
    currentChatId = session.id;
    history = [];
    clearVisibleChat();
    clearPreview();
    textarea.value = "";
    saveSessions();
    renderSessionList();
    setStatus("SYSTEM ONLINE");
  }
  function setSessionTitle(session, message) {
    if (!session || session.title !== "New conversation") return;
    session.title = String(message).trim().replace(/\s+/g, " ").slice(0, 38)
      || "New conversation";
  }
  function stopSpeech() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    isSpeaking = false;
    if (!isListening && !busy) setStatus("SYSTEM ONLINE");
  }
  function speakText(text) {
    if (!speakReplies?.checked || !("speechSynthesis" in window) || !text) return;
    const content = String(text).trim();
    if (!content) return;
    stopSpeech();
    const language = textLanguage(content);
    lastLanguage = language;
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = language === "ar" ? "ar-SA" : "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((item) => item.lang?.toLowerCase().startsWith(language));
    if (voice) utterance.voice = voice;
    utterance.onstart = () => {
      isSpeaking = true;
      setStatus("JARVIS SPEAKING", "is-speaking");
    };
    utterance.onend = () => {
      isSpeaking = false;
      if (!busy && !isListening) setStatus("SYSTEM ONLINE");
    };
    utterance.onerror = (event) => {
      isSpeaking = false;
      console.warn("JARVIS speech error:", event.error);
      if (!busy && !isListening) setStatus("SYSTEM ONLINE");
    };
    window.speechSynthesis.speak(utterance);
  }
  async function runSafeCommand(message, command) {
    if (busy) return;
    const session = ensureSession();
    setSessionTitle(session, message);
    addMessage("user", message);
    busy = true;
    if (sendBtn) sendBtn.disabled = true;
    if (micBtn) micBtn.disabled = true;
    setStatus("WAITING FOR CONFIRMATION", "is-thinking");
    let resultText = "";
    try {
      const approved = window.confirm(
        `Allow OXR JARVIS to run the read-only Windows command \"${command}\" on this computer?\n\nOnly a fixed allowlisted command will run. No files will be changed.`
      );
      if (!approved) {
        resultText = "Command cancelled. Nothing was executed.";
      } else {
        const response = await fetch("/api/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command, confirmed: true })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Command failed (${response.status}).`);
        resultText = `${data.command}\n\n${data.output}`;
      }
      addMessage("assistant", resultText);
      history.push({ role: "user", content: message }, { role: "assistant", content: resultText });
      history = history.slice(-20);
      session.messages.push({ role: "user", text: message }, { role: "assistant", text: resultText });
      session.history = history.slice(-20);
      session.updatedAt = Date.now();
      saveCurrentSession();
    } catch (error) {
      resultText = `Command error: ${error.message || "Command failed."}`;
      addMessage("assistant", resultText, true);
      session.messages.push({ role: "user", text: message }, { role: "assistant", text: resultText, isError: true });
      session.updatedAt = Date.now();
      saveSessions();
      renderSessionList();
    } finally {
      busy = false;
      if (sendBtn) sendBtn.disabled = false;
      if (micBtn) micBtn.disabled = false;
      setStatus("SYSTEM ONLINE");
      textarea.focus();
    }
  }
  async function sendMessage(rawText) {
    const message = String(rawText || "").trim();
    if (!message || busy) return;
    const commandMatch = developerMode && message.match(/^\/run\s+(hostname|whoami|ipconfig|systeminfo|ver)\s*$/i);
    if (commandMatch) {
      return runSafeCommand(message, commandMatch[1].toLowerCase());
    }
    const session = ensureSession();
    setSessionTitle(session, message);
    addMessage("user", message);
    const thinkingBubble = addMessage("assistant", "JARVIS is processing your request…");
    busy = true;
    if (sendBtn) sendBtn.disabled = true;
    if (micBtn) micBtn.disabled = true;
    setStatus("THINKING", "is-thinking");
    const controller = new AbortController();
    requestController = controller;
    const requestTimeout = setTimeout(() => controller.abort(), 190000);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: history.slice(-20),
          memory: userMemory,
          mode: developerMode ? "developer" : "chat"
        }),
        signal: controller.signal
      });
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("The server returned an unreadable response.");
      }
      if (!response.ok) {
        throw new Error(data.error || data.reply || `Server error (${response.status})`);
      }
      const reply = String(data.reply || "I couldn't generate a response.");
      thinkingBubble.textContent = reply;
      history.push(
        { role: "user", content: message },
        { role: "assistant", content: reply }
      );
      history = history.slice(-20);
      session.messages.push(
        { role: "user", text: message },
        { role: "assistant", text: reply }
      );
      const projectHtml = extractWebsite(data);
      if (projectHtml) {
        session.projectHtml = projectHtml;
        showPreview(projectHtml);
      }
      session.updatedAt = Date.now();
      saveCurrentSession();
      speakText(reply);
    } catch (error) {
      const friendlyError = error?.name === "AbortError"
        ? "The request timed out. Try a shorter request or retry."
        : (error.message || "Could not reach the server.");
      const errorText = `JARVIS error: ${friendlyError}`;
      thinkingBubble.textContent = errorText;
      thinkingBubble.classList.add("oxr-error");
      session.messages.push(
        { role: "user", text: message },
        { role: "assistant", text: errorText, isError: true }
      );
      session.updatedAt = Date.now();
      saveSessions();
      renderSessionList();
      setStatus("CONNECTION ERROR");
      console.error("OXR JARVIS request failed:", error);
    } finally {
      clearTimeout(requestTimeout);
      if (requestController === controller) requestController = null;
      busy = false;
      if (sendBtn) sendBtn.disabled = false;
      if (micBtn) micBtn.disabled = false;
      if (!isSpeaking && !isListening) setStatus("SYSTEM ONLINE");
      textarea.focus();
    }
  }
  function setupVoiceRecognition() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!micBtn) return;
    if (!SpeechRecognition) {
      micBtn.title = "Voice recognition is not supported in this browser.";
      micBtn.addEventListener("click", () => {
        if (voiceStatus) {
          voiceStatus.textContent =
            "Voice input isn't supported here. Try Chrome or Edge.";
        }
      });
      return;
    }
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = lastLanguage === "ar" ? "ar-SA" : "en-US";
    let finalTranscript = "";
    recognition.onstart = () => {
      isListening = true;
      finalTranscript = "";
      setStatus("LISTENING", "is-listening");
      if (voiceStatus) voiceStatus.textContent = "JARVIS is listening…";
      micBtn.setAttribute("aria-pressed", "true");
    };
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const part = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += part;
        else interim += part;
      }
      const spoken = (finalTranscript + " " + interim).trim();
      if (spoken) {
        lastLanguage = textLanguage(spoken);
        textarea.value = spoken;
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };
    recognition.onerror = (event) => {
      if (voiceStatus) {
        voiceStatus.textContent = event.error === "not-allowed"
          ? "Please allow microphone access in your browser."
          : `Voice input: ${event.error}`;
      }
    };
    recognition.onend = () => {
      isListening = false;
      micBtn.setAttribute("aria-pressed", "false");
      if (voiceStatus) voiceStatus.textContent = "";
      const spoken = textarea.value.trim();
      if (spoken && finalTranscript.trim() && !busy) {
        textarea.value = "";
        sendMessage(spoken);
      } else if (!busy && !isSpeaking) {
        setStatus("SYSTEM ONLINE");
      }
    };
    micBtn.addEventListener("click", () => {
      if (busy) return;
      if (isListening) {
        recognition.stop();
      } else {
        stopSpeech();
        finalTranscript = "";
        const sourceText = textarea.value || history.at(-1)?.content || "";
        const language = textLanguage(sourceText);
        recognition.lang = language === "ar" ? "ar-SA" : "en-US";
        try {
          recognition.start();
        } catch (error) {
          console.warn("Microphone could not start:", error);
        }
      }
    });
  }
  // Main chat submit
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = textarea.value.trim();
    if (!message || busy) return;
    textarea.value = "";
    sendMessage(message);
  });
  // Enter sends; Shift+Enter inserts a new line.
  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  if (newChatBtn) {
    newChatBtn.addEventListener("click", createNewSession);
  }
  // Preserve any suggestion buttons already present in index.html.
  document.querySelectorAll(".suggestion").forEach((button) => {
    button.addEventListener("click", () => {
      const prompt = button.dataset.prompt || button.textContent.trim();
      if (prompt) sendMessage(prompt);
    });
  });
  if (speakReplies) {
    speakReplies.addEventListener("change", () => {
      if (!speakReplies.checked) stopSpeech();
    });
  }
  applyDeveloperMode();
  setupVoiceRecognition();
  loadSessions();
  if (sessions.length) {
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    openSession(sessions[0].id);
  } else {
    ensureSession();
    renderSessionList();
  }
  // If browser speech stops unexpectedly, restore the idle status.
  window.addEventListener("beforeunload", () => {
    if (recognition && isListening) {
      try { recognition.stop(); } catch {}
    }
  });
}
