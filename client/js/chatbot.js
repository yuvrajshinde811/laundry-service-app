/**
 * FreshWave Laundry - Customer AI Chatbot Widget
 * Reusable floating chat widget across all customer-facing pages.
 */

(function () {
  const WELCOME_MESSAGE = `Hello! 👋 Welcome to our Laundry Service.

I'm your AI Laundry Assistant. I can help you explore services, understand prices, book laundry pickups, track orders, and answer your questions.

How can I help you today?`;

  const SUGGESTED_QUESTIONS = [
    'What laundry services do you offer?',
    'What are your prices?',
    'How can I book a pickup?',
    'How long does laundry take?',
    'Do you provide home delivery?',
    'How can I track my order?',
    'What are your working hours?',
    'How can I contact the laundry team?'
  ];

  const STORAGE_SESSION_KEY = 'freshwave_customer_ai_session';
  const STORAGE_MESSAGES_KEY = 'freshwave_customer_ai_messages';

  let state = {
    isOpen: false,
    isMinimized: false,
    isSending: false,
    aiAvailable: true,
    statusLabel: 'AI Online • Ready to help',
    sessionId: sessionStorage.getItem(STORAGE_SESSION_KEY) || '',
    messages: []
  };

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  function formatTime(isoOrDate) {
    try {
      const d = isoOrDate ? new Date(isoOrDate) : new Date();
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }

  function loadStoredMessages() {
    try {
      const raw = sessionStorage.getItem(STORAGE_MESSAGES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          state.messages = parsed;
          return;
        }
      }
    } catch (e) {}
    state.messages = [
      {
        role: 'assistant',
        content: WELCOME_MESSAGE,
        timestamp: new Date().toISOString()
      }
    ];
  }

  function saveStoredMessages() {
    try {
      sessionStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(state.messages.slice(-40)));
      if (state.sessionId) {
        sessionStorage.setItem(STORAGE_SESSION_KEY, state.sessionId);
      }
    } catch (e) {}
  }

  async function checkAIStatus() {
    try {
      const res = await fetch('/api/ai/status');
      const data = await res.json();
      state.aiAvailable = Boolean(data.enabled && data.available);
      state.statusLabel = data.statusLabel || (state.aiAvailable ? 'AI Online • Ready to help' : 'AI Service Unavailable');
      updateStatusBadge();
    } catch (e) {
      state.aiAvailable = false;
      state.statusLabel = 'AI Service Unreachable';
      updateStatusBadge();
    }
  }

  function updateStatusBadge() {
    const dot = document.getElementById('fw-ai-status-dot');
    const label = document.getElementById('fw-ai-status-text');
    if (dot && label) {
      if (state.aiAvailable) {
        dot.classList.remove('offline');
        label.textContent = state.statusLabel || 'AI Online • Ready to help';
      } else {
        dot.classList.add('offline');
        label.textContent = state.statusLabel || 'AI Service Unavailable';
      }
    }
  }

  function createWidgetDOM() {
    if (document.getElementById('fw-ai-launcher')) return;

    const launcher = document.createElement('button');
    launcher.id = 'fw-ai-launcher';
    launcher.type = 'button';
    launcher.className = 'ai-launcher-btn no-print';
    launcher.setAttribute('aria-label', 'Open AI Laundry Assistant');
    launcher.innerHTML = `
      <span class="ai-launcher-icon"><i class="bi bi-stars"></i></span>
      <span class="ai-launcher-label">AI Laundry Assistant</span>
    `;

    const win = document.createElement('section');
    win.id = 'fw-ai-window';
    win.className = 'ai-chat-window d-none no-print';
    win.setAttribute('aria-label', 'AI Laundry Assistant Chat');
    win.innerHTML = `
      <div class="ai-chat-header">
        <div class="d-flex align-items-center gap-2 overflow-hidden">
          <div class="ai-chat-avatar"><i class="bi bi-droplet-half"></i></div>
          <div class="text-truncate">
            <div class="fw-bold small lh-sm">FreshWave AI Assistant</div>
            <div class="opacity-75" style="font-size: 0.72rem;">
              <span id="fw-ai-status-dot" class="ai-status-dot"></span>
              <span id="fw-ai-status-text">AI Online • Ready to help</span>
            </div>
          </div>
        </div>
        <div class="ai-header-actions">
          <button type="button" id="fw-ai-clear-btn" class="ai-header-btn" title="Clear chat history" aria-label="Clear chat history">
            <i class="bi bi-trash3"></i>
          </button>
          <button type="button" id="fw-ai-min-btn" class="ai-header-btn" title="Minimize" aria-label="Minimize chat">
            <i class="bi bi-dash-lg"></i>
          </button>
          <button type="button" id="fw-ai-close-btn" class="ai-header-btn" title="Close" aria-label="Close chat">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      </div>

      <div id="fw-ai-body" class="ai-chat-body"></div>

      <div id="fw-ai-suggestions" class="ai-suggestions-bar"></div>

      <form id="fw-ai-form" class="ai-chat-input-bar">
        <textarea id="fw-ai-input" rows="1" placeholder="Ask about services, prices, booking, or tracking..." maxlength="1000"></textarea>
        <button type="submit" id="fw-ai-send-btn" class="ai-send-btn" aria-label="Send message">
          <i class="bi bi-send-fill"></i>
        </button>
      </form>
    `;

    document.body.appendChild(launcher);
    document.body.appendChild(win);

    // Populate suggested chips
    const suggContainer = document.getElementById('fw-ai-suggestions');
    SUGGESTED_QUESTIONS.forEach((q) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'ai-chip-btn';
      chip.textContent = q;
      chip.addEventListener('click', () => sendCustomerMessage(q));
      suggContainer.appendChild(chip);
    });

    // Event bindings
    launcher.addEventListener('click', toggleChatOpen);
    document.getElementById('fw-ai-close-btn').addEventListener('click', closeChat);
    document.getElementById('fw-ai-min-btn').addEventListener('click', toggleMinimize);
    document.getElementById('fw-ai-clear-btn').addEventListener('click', clearChatHistory);

    const inputEl = document.getElementById('fw-ai-input');
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleFormSubmit();
      }
    });

    document.getElementById('fw-ai-form').addEventListener('submit', (e) => {
      e.preventDefault();
      handleFormSubmit();
    });
  }

  function toggleChatOpen() {
    state.isOpen = !state.isOpen;
    state.isMinimized = false;
    const win = document.getElementById('fw-ai-window');
    if (win) {
      win.classList.toggle('d-none', !state.isOpen);
      win.classList.remove('minimized');
      if (state.isOpen) {
        scrollToBottom();
        setTimeout(() => document.getElementById('fw-ai-input')?.focus(), 100);
      }
    }
  }

  function closeChat() {
    state.isOpen = false;
    document.getElementById('fw-ai-window')?.classList.add('d-none');
  }

  function toggleMinimize() {
    state.isMinimized = !state.isMinimized;
    document.getElementById('fw-ai-window')?.classList.toggle('minimized', state.isMinimized);
  }

  async function clearChatHistory() {
    const oldSession = state.sessionId;
    state.sessionId = '';
    state.messages = [
      {
        role: 'assistant',
        content: WELCOME_MESSAGE,
        timestamp: new Date().toISOString()
      }
    ];
    sessionStorage.removeItem(STORAGE_SESSION_KEY);
    saveStoredMessages();
    renderMessages();

    if (oldSession) {
      fetch('/api/ai/chat/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: oldSession })
      }).catch(() => {});
    }
  }

  function renderMessages() {
    const body = document.getElementById('fw-ai-body');
    if (!body) return;

    body.innerHTML = '';

    state.messages.forEach((msg) => {
      const row = document.createElement('div');
      row.className = `ai-msg-row ${msg.role === 'user' ? 'user' : 'assistant'}`;

      const bubble = document.createElement('div');
      bubble.className = 'ai-msg-bubble';
      bubble.innerHTML = escapeHtml(msg.content);
      row.appendChild(bubble);

      // Booking Confirmation Card
      if (msg.createdOrder && msg.createdOrder.orderId) {
        const card = document.createElement('div');
        card.className = 'ai-msg-card';
        card.innerHTML = `
          <div class="fw-bold text-primary mb-1"><i class="bi bi-check-circle-fill me-1"></i>Booking Confirmed</div>
          <div><strong>Order ID:</strong> ${escapeHtml(msg.createdOrder.orderId)}</div>
          <div><strong>Pickup:</strong> ${escapeHtml(msg.createdOrder.pickupDate)} (${escapeHtml(msg.createdOrder.pickupTimeSlot)})</div>
          <div><strong>Total:</strong> ₹${escapeHtml(msg.createdOrder.totalAmount)}</div>
          <div class="mt-2 d-flex flex-wrap gap-1">
            <a href="${escapeHtml(msg.createdOrder.trackingUrl || '/tracking.html')}" class="btn btn-sm btn-primary-custom py-1 px-2" style="font-size:0.75rem;">Track Order</a>
            <a href="https://wa.me/918080082714" target="_blank" class="btn btn-sm btn-whatsapp py-1 px-2" style="font-size:0.75rem;"><i class="bi bi-whatsapp"></i> Support</a>
          </div>
        `;
        row.appendChild(card);
      }

      // Fallback Quick Actions Card when AI is unavailable
      if (msg.fallback) {
        const fbCard = document.createElement('div');
        fbCard.className = 'ai-msg-card warning';
        const diagHtml = msg.errorDetail
          ? `<div class="text-muted mb-2" style="font-size:0.75rem;"><i class="bi bi-info-circle me-1"></i>${escapeHtml(msg.errorDetail)}</div>`
          : '';
        fbCard.innerHTML = `
          ${diagHtml}
          <div class="fw-semibold text-dark mb-2">Quick Actions:</div>
          <div class="d-flex flex-wrap gap-1">
            <a href="/booking.html" class="btn btn-sm btn-primary-custom py-1 px-2" style="font-size:0.75rem;"><i class="bi bi-calendar2-check"></i> Book Form</a>
            <a href="/tracking.html" class="btn btn-sm btn-outline-primary py-1 px-2" style="font-size:0.75rem;"><i class="bi bi-geo-alt"></i> Track</a>
            <a href="https://wa.me/918080082714" target="_blank" class="btn btn-sm btn-whatsapp py-1 px-2" style="font-size:0.75rem;"><i class="bi bi-whatsapp"></i> WhatsApp</a>
          </div>
        `;
        row.appendChild(fbCard);
      }

      const time = document.createElement('div');
      time.className = 'ai-msg-time';
      time.textContent = formatTime(msg.timestamp);
      row.appendChild(time);

      body.appendChild(row);
    });

    if (state.isSending) {
      const typingRow = document.createElement('div');
      typingRow.className = 'ai-msg-row assistant';
      typingRow.innerHTML = `
        <div class="ai-typing-indicator" aria-label="Assistant is typing">
          <span class="ai-typing-dot"></span>
          <span class="ai-typing-dot"></span>
          <span class="ai-typing-dot"></span>
        </div>
      `;
      body.appendChild(typingRow);
    }

    scrollToBottom();
  }

  function scrollToBottom() {
    const body = document.getElementById('fw-ai-body');
    if (body) {
      body.scrollTop = body.scrollHeight;
    }
  }

  function handleFormSubmit() {
    const input = document.getElementById('fw-ai-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text || state.isSending) return;
    input.value = '';
    sendCustomerMessage(text);
  }

  async function sendCustomerMessage(text) {
    if (!text || state.isSending) return;

    state.messages.push({
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    });
    state.isSending = true;
    saveStoredMessages();
    renderMessages();

    const sendBtn = document.getElementById('fw-ai-send-btn');
    if (sendBtn) sendBtn.disabled = true;

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.sessionId || undefined,
          message: text
        })
      });

      const data = await res.json();

      if (data.sessionId) {
        state.sessionId = data.sessionId;
      }

      if (typeof data.aiAvailable === 'boolean') {
        state.aiAvailable = data.aiAvailable;
        if (data.statusLabel) state.statusLabel = data.statusLabel;
        updateStatusBadge();
      }

      const replyText = data.reply || data.message || "I'm temporarily unable to connect to the AI assistant. You can still book your laundry using our regular booking form.";
      state.messages.push({
        role: 'assistant',
        content: replyText,
        timestamp: new Date().toISOString(),
        fallback: Boolean(data.fallback || !res.ok),
        errorDetail: data.errorDetail || '',
        createdOrder: data.createdOrder || null
      });
    } catch (err) {
      state.aiAvailable = false;
      state.statusLabel = 'AI Service Unreachable';
      updateStatusBadge();
      state.messages.push({
        role: 'assistant',
        content: "I'm temporarily unable to connect to the AI assistant. You can still book your laundry using our regular booking form.",
        timestamp: new Date().toISOString(),
        fallback: true,
        errorDetail: 'Unable to reach backend server.'
      });
    } finally {
      state.isSending = false;
      if (sendBtn) sendBtn.disabled = false;
      saveStoredMessages();
      renderMessages();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadStoredMessages();
    createWidgetDOM();
    renderMessages();
    checkAIStatus();
  });
})();
