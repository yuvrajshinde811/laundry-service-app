/**
 * FreshWave Laundry - Admin AI Assistant & Business Insights Script
 */

(function () {
  const ADMIN_WELCOME_MESSAGE = `Hello Admin! 👋

I'm your Laundry Business AI Assistant. I can help you understand your orders, monitor business performance, analyze revenue, identify pending work, and answer operational questions.`;

  const ADMIN_SUGGESTED_QUESTIONS = [
    'How many orders did we receive today?',
    'How many orders are pending?',
    "What is today's revenue?",
    'What is our monthly revenue?',
    'Which laundry services are most popular?',
    'Which orders are delayed?',
    'Give me a business performance summary',
    'Compare this month with last month',
    'Identify operational problems'
  ];

  const ADMIN_AI_SESSION_KEY = 'freshwave_admin_ai_session';

  let adminAIState = {
    sessionId: sessionStorage.getItem(ADMIN_AI_SESSION_KEY) || '',
    isSending: false,
    aiAvailable: true,
    messages: [
      {
        role: 'assistant',
        content: ADMIN_WELCOME_MESSAGE,
        timestamp: new Date().toISOString()
      }
    ],
    revenueChart: null,
    servicesChart: null
  };

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  function formatTime(iso) {
    try {
      return new Date(iso || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }

  function getAuthToken() {
    return localStorage.getItem('adminToken');
  }

  function initAdminAI() {
    const token = getAuthToken();
    if (!token) return;

    const suggWrap = document.getElementById('admin-ai-suggestions');
    if (suggWrap) {
      suggWrap.innerHTML = '';
      ADMIN_SUGGESTED_QUESTIONS.forEach((q) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'ai-chip-btn';
        chip.textContent = q;
        chip.addEventListener('click', () => sendAdminQuery(q));
        suggWrap.appendChild(chip);
      });
    }

    const inputEl = document.getElementById('admin-ai-input');
    if (inputEl) {
      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleAdminFormSubmit();
        }
      });
    }

    const formEl = document.getElementById('admin-ai-form');
    if (formEl) {
      formEl.addEventListener('submit', (e) => {
        e.preventDefault();
        handleAdminFormSubmit();
      });
    }

    const clearBtn = document.getElementById('admin-ai-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', clearAdminChat);
    }

    renderAdminMessages();
    loadAdminInsights();
  }

  function handleAdminFormSubmit() {
    const inputEl = document.getElementById('admin-ai-input');
    if (!inputEl) return;
    const text = inputEl.value.trim();
    if (!text || adminAIState.isSending) return;
    inputEl.value = '';
    sendAdminQuery(text);
  }

  async function clearAdminChat() {
    const oldSession = adminAIState.sessionId;
    adminAIState.sessionId = '';
    adminAIState.messages = [
      {
        role: 'assistant',
        content: ADMIN_WELCOME_MESSAGE,
        timestamp: new Date().toISOString()
      }
    ];
    sessionStorage.removeItem(ADMIN_AI_SESSION_KEY);
    renderAdminMessages();

    if (oldSession) {
      fetch('/api/admin/ai/chat/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ sessionId: oldSession })
      }).catch(() => {});
    }
  }

  function renderAdminMessages() {
    const body = document.getElementById('admin-ai-body');
    if (!body) return;

    body.innerHTML = '';

    adminAIState.messages.forEach((msg, index) => {
      const row = document.createElement('div');
      row.className = `ai-msg-row ${msg.role === 'user' ? 'user' : 'assistant'}`;

      const bubble = document.createElement('div');
      bubble.className = 'ai-msg-bubble';
      bubble.innerHTML = escapeHtml(msg.content);
      row.appendChild(bubble);

      // Pending Action Confirmation Card (only if not yet resolved)
      if (msg.pendingAction && !msg.actionResolved) {
        const pa = msg.pendingAction;
        const card = document.createElement('div');
        card.className = 'ai-msg-card warning';
        card.innerHTML = `
          <div class="fw-bold text-dark mb-1"><i class="bi bi-shield-exclamation me-1 text-warning"></i>Confirmation Required</div>
          <div><strong>Order:</strong> ${escapeHtml(pa.orderId)} (${escapeHtml(pa.customerName || 'Customer')})</div>
          <div><strong>Change:</strong> ${escapeHtml(pa.currentStatus)} → <strong>${escapeHtml(pa.newStatus)}</strong></div>
          ${pa.note ? `<div><strong>Note:</strong> ${escapeHtml(pa.note)}</div>` : ''}
          <div class="mt-2 d-flex gap-2">
            <button type="button" class="btn btn-sm btn-primary-custom py-1 px-2" style="font-size:0.75rem;" onclick="window.resolveAdminAIAction(true, ${index})">
              <i class="bi bi-check-lg"></i> Confirm Action
            </button>
            <button type="button" class="btn btn-sm btn-outline-secondary py-1 px-2" style="font-size:0.75rem;" onclick="window.resolveAdminAIAction(false, ${index})">
              Cancel
            </button>
          </div>
        `;
        row.appendChild(card);
      }

      const time = document.createElement('div');
      time.className = 'ai-msg-time';
      time.textContent = formatTime(msg.timestamp);
      row.appendChild(time);

      body.appendChild(row);
    });

    if (adminAIState.isSending) {
      const typingRow = document.createElement('div');
      typingRow.className = 'ai-msg-row assistant';
      typingRow.innerHTML = `
        <div class="ai-typing-indicator" aria-label="AI Assistant is analyzing">
          <span class="ai-typing-dot"></span>
          <span class="ai-typing-dot"></span>
          <span class="ai-typing-dot"></span>
        </div>
      `;
      body.appendChild(typingRow);
    }

    body.scrollTop = body.scrollHeight;
  }

  async function sendAdminQuery(text) {
    if (!text || adminAIState.isSending) return;

    adminAIState.messages.push({
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    });
    adminAIState.isSending = true;
    renderAdminMessages();

    const sendBtn = document.getElementById('admin-ai-send-btn');
    if (sendBtn) sendBtn.disabled = true;

    try {
      const res = await fetch('/api/admin/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          sessionId: adminAIState.sessionId || undefined,
          message: text
        })
      });

      if (res.status === 401) {
        if (typeof window.handleAdminLogout === 'function') window.handleAdminLogout();
        return;
      }

      const data = await res.json();

      if (data.sessionId) {
        adminAIState.sessionId = data.sessionId;
        sessionStorage.setItem(ADMIN_AI_SESSION_KEY, data.sessionId);
      }

      if (typeof data.aiAvailable === 'boolean') {
        adminAIState.aiAvailable = data.aiAvailable;
        updateAdminAIStatusBadge(data.statusLabel);
      }

      adminAIState.messages.push({
        role: 'assistant',
        content: data.reply || data.message || 'Unable to process request.',
        timestamp: new Date().toISOString(),
        pendingAction: data.pendingAction || null,
        actionResolved: false
      });

      if (data.executedAction && data.executedAction.executed) {
        if (typeof window.loadDashboardData === 'function') {
          window.loadDashboardData();
        }
      }
    } catch (err) {
      adminAIState.messages.push({
        role: 'assistant',
        content: 'Could not reach the Admin AI service. Live dashboard metrics and table controls remain available.',
        timestamp: new Date().toISOString()
      });
    } finally {
      adminAIState.isSending = false;
      if (sendBtn) sendBtn.disabled = false;
      renderAdminMessages();
    }
  }

  window.resolveAdminAIAction = async function (confirm, msgIndex) {
    const targetMsg = adminAIState.messages[msgIndex];
    if (targetMsg) targetMsg.actionResolved = true;

    try {
      const res = await fetch('/api/admin/ai/confirm-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          sessionId: adminAIState.sessionId,
          confirm: Boolean(confirm)
        })
      });

      const data = await res.json();
      adminAIState.messages.push({
        role: 'assistant',
        content: data.message || (confirm ? 'Action executed.' : 'Action cancelled.'),
        timestamp: new Date().toISOString()
      });

      if (data.executed && typeof window.loadDashboardData === 'function') {
        await window.loadDashboardData();
      }
    } catch (err) {
      adminAIState.messages.push({
        role: 'assistant',
        content: 'Failed to execute action due to a network error.',
        timestamp: new Date().toISOString()
      });
    }

    renderAdminMessages();
  };

  function updateAdminAIStatusBadge(statusLabel) {
    const dot = document.getElementById('admin-ai-status-dot');
    const txt = document.getElementById('admin-ai-status-text');
    if (dot && txt) {
      if (adminAIState.aiAvailable) {
        dot.classList.remove('offline');
        txt.textContent = statusLabel || 'AI Online • Connected to Live DB';
      } else {
        dot.classList.add('offline');
        txt.textContent = statusLabel || 'AI Unavailable';
      }
    }
  }

  /**
   * Load Real-Time Business Analytics & Render Charts
   */
  window.loadAdminInsights = async function () {
    const token = getAuthToken();
    if (!token) return;

    try {
      const res = await fetch('/api/admin/ai/business-summary', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 401) return;

      const data = await res.json();
      if (!data.success || !data.summary) return;

      if (typeof data.aiAvailable === 'boolean') {
        adminAIState.aiAvailable = data.aiAvailable;
        updateAdminAIStatusBadge(data.aiStatusLabel);
      }

      const s = data.summary;
      const ov = s.overview || {};

      // Populate mini insight tiles
      const monthEl = document.getElementById('insight-month-revenue');
      if (monthEl) monthEl.textContent = `₹${ov.thisMonthRevenue || 0}`;

      const momEl = document.getElementById('insight-mom-badge');
      if (momEl) {
        if (ov.monthOverMonthGrowthPercent === null || ov.monthOverMonthGrowthPercent === undefined) {
          momEl.textContent = `Last month: ₹${ov.lastMonthRevenue || 0}`;
        } else {
          const sign = ov.monthOverMonthGrowthPercent >= 0 ? '+' : '';
          momEl.innerHTML = `<span class="${ov.monthOverMonthGrowthPercent >= 0 ? 'text-success' : 'text-danger'} fw-semibold">${sign}${ov.monthOverMonthGrowthPercent}% vs last mo</span>`;
        }
      }

      const totalRevEl = document.getElementById('stat-total-revenue');
      if (totalRevEl) totalRevEl.textContent = `₹${ov.totalRevenue || 0}`;

      const avgEl = document.getElementById('insight-avg-order');
      if (avgEl) avgEl.textContent = `Avg: ₹${ov.averageOrderValue || 0}`;

      const compEl = document.getElementById('insight-completion-rate');
      if (compEl) compEl.textContent = `${ov.completionRate || 0}%`;

      const topSvc = s.popularServices && s.popularServices[0] ? s.popularServices[0].service : 'N/A';
      const topSvcEl = document.getElementById('insight-top-service');
      if (topSvcEl) topSvcEl.textContent = `Top: ${topSvc}`;

      const delayedEl = document.getElementById('insight-delayed-count');
      if (delayedEl) delayedEl.textContent = (s.delayedOrders || []).length;

      // Render Operational Bottlenecks & Top Customers
      const bnEl = document.getElementById('insight-bottlenecks-list');
      if (bnEl) {
        const itemsHtml = [];
        if (s.bottlenecks && s.bottlenecks.length > 0) {
          s.bottlenecks.forEach((b) => {
            itemsHtml.push(`<div class="text-dark mb-1"><i class="bi bi-dot text-warning"></i> ${escapeHtml(b)}</div>`);
          });
        } else {
          itemsHtml.push(`<div class="text-success mb-1"><i class="bi bi-check-circle me-1"></i> No operational delays detected right now.</div>`);
        }

        if (s.topCustomers && s.topCustomers.length > 0) {
          const topCustStr = s.topCustomers
            .slice(0, 3)
            .map((c) => `${escapeHtml(c.name)} (${c.orderCount} orders, ₹${c.totalSpent})`)
            .join(' • ');
          itemsHtml.push(`<div class="mt-2 pt-2 border-top text-muted"><strong>Top Customers:</strong> ${topCustStr}</div>`);
        }

        bnEl.innerHTML = itemsHtml.join('');
      }

      renderCharts(s.dailyTrend || [], s.popularServices || []);
    } catch (err) {
      console.warn('Failed to load admin insights:', err.message);
    }
  };

  function renderCharts(dailyTrend, popularServices) {
    if (typeof window.Chart === 'undefined') return;

    // 1. 7-Day Revenue Trend Chart
    const trendCanvas = document.getElementById('revenueTrendChart');
    if (trendCanvas) {
      if (adminAIState.revenueChart) adminAIState.revenueChart.destroy();
      adminAIState.revenueChart = new window.Chart(trendCanvas, {
        type: 'bar',
        data: {
          labels: dailyTrend.map((d) => d.date.slice(5)),
          datasets: [
            {
              label: 'Revenue (₹)',
              data: dailyTrend.map((d) => d.revenue),
              backgroundColor: 'rgba(2, 132, 199, 0.75)',
              borderColor: '#0284c7',
              borderWidth: 1,
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
    }

    // 2. Popular Services Chart
    const svcCanvas = document.getElementById('servicesChart');
    if (svcCanvas) {
      if (adminAIState.servicesChart) adminAIState.servicesChart.destroy();
      const labels = popularServices.length > 0 ? popularServices.map((s) => s.service) : ['No Orders Yet'];
      const values = popularServices.length > 0 ? popularServices.map((s) => s.itemCount) : [1];
      const colors = ['#0284c7', '#06b6d4', '#10b981', '#f59e0b', '#6366f1', '#64748b'];

      adminAIState.servicesChart = new window.Chart(svcCanvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [
            {
              data: values,
              backgroundColor: popularServices.length > 0 ? colors.slice(0, labels.length) : ['#e2e8f0']
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { boxWidth: 10, font: { size: 11 } }
            }
          }
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', initAdminAI);
})();
