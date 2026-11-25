const crypto = require('crypto');

/**
 * Session-scoped Conversation Memory Store
 * Ensures strict isolation between customer sessions and admin sessions,
 * bounded history window for cost control, and automatic TTL expiration.
 */

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const sessions = new Map();

function getMaxTurns() {
  const parsed = parseInt(process.env.AI_MAX_HISTORY_TURNS, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 20) : 10;
}

function generateSessionId() {
  return crypto.randomBytes(12).toString('hex');
}

function buildKey(scope, sessionId) {
  return `${scope}:${sessionId}`;
}

function getOrCreateSession(scope, sessionId) {
  const sid = sessionId && /^[a-zA-Z0-9_-]{4,80}$/.test(sessionId)
    ? sessionId
    : generateSessionId();

  const key = buildKey(scope, sid);
  const now = Date.now();
  let session = sessions.get(key);

  if (!session || now - session.lastActivity > SESSION_TTL_MS) {
    session = {
      sessionId: sid,
      scope,
      messages: [],
      bookingDraft: {
        items: [],
        deliveryPreference: 'Standard'
      },
      pendingAdminAction: null,
      createdAt: now,
      lastActivity: now
    };
    sessions.set(key, session);
  } else {
    session.lastActivity = now;
  }

  return session;
}

function appendMessage(scope, sessionId, role, content) {
  const session = getOrCreateSession(scope, sessionId);
  const cleanRole = role === 'assistant' ? 'assistant' : 'user';
  session.messages.push({
    role: cleanRole,
    content: String(content || '').slice(0, 2000),
    timestamp: new Date().toISOString()
  });

  // Enforce sliding window (2 messages per turn) to limit token cost
  const maxMessages = getMaxTurns() * 2;
  if (session.messages.length > maxMessages) {
    session.messages = session.messages.slice(-maxMessages);
  }

  session.lastActivity = Date.now();
  return session;
}

function updateBookingDraft(scope, sessionId, patch = {}) {
  const session = getOrCreateSession(scope, sessionId);
  session.bookingDraft = {
    ...session.bookingDraft,
    ...patch
  };
  session.lastActivity = Date.now();
  return session.bookingDraft;
}

function resetBookingDraft(scope, sessionId) {
  const session = getOrCreateSession(scope, sessionId);
  session.bookingDraft = { items: [], deliveryPreference: 'Standard' };
  session.lastActivity = Date.now();
  return session.bookingDraft;
}

function setPendingAdminAction(scope, sessionId, action) {
  const session = getOrCreateSession(scope, sessionId);
  session.pendingAdminAction = action ? { ...action, createdAt: Date.now() } : null;
  session.lastActivity = Date.now();
  return session.pendingAdminAction;
}

function clearSession(scope, sessionId) {
  if (!sessionId) return false;
  return sessions.delete(buildKey(scope, sessionId));
}

// Periodic cleanup of expired sessions (unref so it never blocks Node exit)
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, sess] of sessions.entries()) {
    if (now - sess.lastActivity > SESSION_TTL_MS) {
      sessions.delete(key);
    }
  }
}, 5 * 60 * 1000);

if (typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

module.exports = {
  generateSessionId,
  getOrCreateSession,
  appendMessage,
  updateBookingDraft,
  resetBookingDraft,
  setPendingAdminAction,
  clearSession
};
