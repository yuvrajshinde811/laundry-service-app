const axios = require('axios');

/**
 * Modular Google Gemini Provider Adapter
 * Ready for future/alternative activation via AI_PROVIDER=gemini and GEMINI_API_KEY.
 */

function getApiKey() {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key || key.startsWith('your_')) return '';
  return key;
}

function getModelName() {
  return (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
}

function getTimeoutMs() {
  const parsed = parseInt(process.env.AI_TIMEOUT_MS, 10);
  return Number.isFinite(parsed) && parsed >= 3000 ? Math.min(parsed, 120000) : 25000;
}

function getMaxTokens() {
  const parsed = parseInt(process.env.AI_MAX_TOKENS, 10);
  return Number.isFinite(parsed) && parsed > 100 ? Math.min(parsed, 1500) : 600;
}

async function checkHealth() {
  const model = getModelName();
  if (!getApiKey()) {
    return {
      available: false,
      provider: 'gemini',
      model,
      statusCode: 'MISSING_API_KEY',
      statusLabel: 'AI Setup Required (Missing Gemini Key)',
      diagnosticMessage: 'GEMINI_API_KEY is not configured. Set GEMINI_API_KEY or switch AI_PROVIDER=ollama.'
    };
  }
  return {
    available: true,
    provider: 'gemini',
    model,
    statusCode: 'READY',
    statusLabel: `Gemini Online (${model})`,
    diagnosticMessage: `Google Gemini provider configured (${model}).`
  };
}

async function createChatCompletion({ messages, tools }) {
  const key = getApiKey();
  if (!key) {
    const err = new Error('GEMINI_API_KEY is not configured.');
    err.status = 401;
    err.code = 'missing_api_key';
    throw err;
  }

  const model = getModelName();
  const systemMsg = messages.find((m) => m.role === 'system');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'function',
          parts: [{
            functionResponse: {
              name: m.tool_name || 'tool_result',
              response: { result: m.content }
            }
          }]
        };
      }
      if (m.tool_calls && m.tool_calls.length > 0) {
        return {
          role: 'model',
          parts: m.tool_calls.map((tc) => ({
            functionCall: {
              name: tc.function.name,
              args: typeof tc.function.arguments === 'string'
                ? JSON.parse(tc.function.arguments || '{}')
                : (tc.function.arguments || {})
            }
          }))
        };
      }
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content || '') }]
      };
    });

  const payload = {
    ...(systemMsg ? { systemInstruction: { parts: [{ text: systemMsg.content }] } } : {}),
    contents,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: getMaxTokens()
    }
  };

  if (Array.isArray(tools) && tools.length > 0) {
    payload.tools = [{
      functionDeclarations: tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters
      }))
    }];
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const response = await axios.post(url, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: getTimeoutMs()
  });

  const parts = response?.data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    const err = new Error('Empty or invalid response from Gemini API.');
    err.isInvalidResponse = true;
    throw err;
  }

  const textParts = parts.filter((p) => typeof p.text === 'string').map((p) => p.text).join('\n').trim();
  const fnCalls = parts
    .filter((p) => p.functionCall)
    .map((p, idx) => ({
      id: `gemini_call_${idx}_${Date.now()}`,
      type: 'function',
      function: {
        name: p.functionCall.name,
        arguments: p.functionCall.args || {}
      }
    }));

  return {
    message: {
      role: 'assistant',
      content: textParts,
      tool_calls: fnCalls
    },
    raw: response.data
  };
}

function classifyError(err) {
  const status = err?.response?.status || err?.status || null;
  const rawMessage = String(err?.response?.data?.error?.message || err?.message || 'Unknown Gemini error')
    .replace(/key=[a-zA-Z0-9_-]+/gi, 'key=***REDACTED***');

  if (status === 401 || status === 403 || err?.code === 'missing_api_key') {
    return {
      errorCode: err?.code === 'missing_api_key' ? 'MISSING_API_KEY' : 'INVALID_API_KEY',
      statusLabel: 'AI Error: Invalid Gemini Key',
      diagnosticMessage: 'Gemini API key is missing or invalid.',
      customerMessage: "I'm temporarily unable to connect to the AI assistant. Please use our regular booking form.",
      adminMessage: 'Gemini API key is missing or rejected.',
      rawLog: rawMessage
    };
  }

  if (status === 429) {
    return {
      errorCode: 'RATE_LIMIT_EXCEEDED',
      statusLabel: 'AI Error: Rate Limit Reached',
      diagnosticMessage: 'Gemini API quota/rate limit reached.',
      customerMessage: 'The AI assistant is busy right now. Please try again shortly or use our booking form.',
      adminMessage: 'Gemini API rate limit reached (429).',
      rawLog: rawMessage
    };
  }

  return {
    errorCode: 'GEMINI_PROVIDER_ERROR',
    statusLabel: 'AI Service Unavailable',
    diagnosticMessage: `Gemini error: ${rawMessage}`,
    customerMessage: "I'm temporarily unable to connect to the AI assistant. Please use our regular booking form.",
    adminMessage: `Gemini API error: ${rawMessage}`,
    rawLog: rawMessage
  };
}

module.exports = {
  name: 'gemini',
  getModelName,
  checkHealth,
  createChatCompletion,
  classifyError
};
