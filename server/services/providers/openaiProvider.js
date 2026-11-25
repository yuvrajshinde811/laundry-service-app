const axios = require('axios');

/**
 * Optional OpenAI REST Provider (No mandatory OpenAI SDK dependency)
 * Only active when AI_PROVIDER=openai and OPENAI_API_KEY is configured.
 */

function getApiKey() {
  const key = (process.env.OPENAI_API_KEY || '').trim();
  if (!key || key.startsWith('your_')) return '';
  return key;
}

function getModelName() {
  return (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();
}

function getTimeoutMs() {
  const parsed = parseInt(process.env.AI_TIMEOUT_MS, 10);
  return Number.isFinite(parsed) && parsed >= 3000 ? Math.min(parsed, 120000) : 20000;
}

function getMaxTokens() {
  const parsed = parseInt(process.env.AI_MAX_TOKENS, 10);
  return Number.isFinite(parsed) && parsed > 100 ? Math.min(parsed, 1500) : 600;
}

function sanitizeSecretText(text) {
  return String(text || '')
    .replace(/sk-[a-zA-Z0-9_-]{8,}/g, 'sk-***REDACTED***')
    .replace(/Bearer\s+[a-zA-Z0-9._-]{10,}/gi, 'Bearer ***REDACTED***');
}

async function checkHealth() {
  const model = getModelName();
  if (!getApiKey()) {
    return {
      available: false,
      provider: 'openai',
      model,
      statusCode: 'MISSING_API_KEY',
      statusLabel: 'AI Setup Required (Missing OpenAI Key)',
      diagnosticMessage: 'OPENAI_API_KEY is not configured. Switch AI_PROVIDER=ollama for free local AI or add an OpenAI key.'
    };
  }
  return {
    available: true,
    provider: 'openai',
    model,
    statusCode: 'READY',
    statusLabel: `AI Online (${model})`,
    diagnosticMessage: `OpenAI provider configured (${model}).`
  };
}

async function createChatCompletion({ messages, tools }) {
  const key = getApiKey();
  if (!key) {
    const err = new Error('OPENAI_API_KEY is not configured.');
    err.status = 401;
    err.code = 'missing_api_key';
    throw err;
  }

  const model = getModelName();
  const isReasoningModel = /^(o1|o3|o4|gpt-5)/i.test(model);
  const formattedMessages = messages.map((m) => {
    const msg = { role: m.role, content: m.content };
    if (m.tool_calls && m.tool_calls.length > 0) {
      msg.tool_calls = m.tool_calls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.function.name,
          arguments: typeof tc.function.arguments === 'string'
            ? tc.function.arguments
            : JSON.stringify(tc.function.arguments || {})
        }
      }));
    }
    if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
    return msg;
  });

  const payload = {
    model,
    messages: formattedMessages,
    ...(Array.isArray(tools) && tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
    ...(isReasoningModel
      ? { max_completion_tokens: getMaxTokens() }
      : { temperature: 0.2, max_tokens: getMaxTokens() })
  };

  const response = await axios.post('https://api.openai.com/v1/chat/completions', payload, {
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    timeout: getTimeoutMs()
  });

  const choice = response?.data?.choices?.[0];
  const msg = choice?.message;
  if (!msg) {
    const invalidErr = new Error('Empty or invalid response received from OpenAI.');
    invalidErr.isInvalidResponse = true;
    throw invalidErr;
  }

  return {
    message: {
      role: msg.role || 'assistant',
      content: typeof msg.content === 'string' ? msg.content : '',
      tool_calls: Array.isArray(msg.tool_calls) ? msg.tool_calls : []
    },
    raw: response.data
  };
}

function classifyError(err) {
  const status = err?.response?.status || err?.status || null;
  const apiCode = String(err?.response?.data?.error?.code || err?.code || '').toLowerCase();
  const rawMessage = sanitizeSecretText(err?.response?.data?.error?.message || err?.message || 'Unknown OpenAI error');
  const lowerMsg = rawMessage.toLowerCase();

  if (status === 401 || apiCode === 'invalid_api_key' || apiCode === 'missing_api_key') {
    return {
      errorCode: apiCode === 'missing_api_key' ? 'MISSING_API_KEY' : 'INVALID_API_KEY',
      statusLabel: 'AI Error: Invalid API Key',
      diagnosticMessage: 'OpenAI API key is missing or rejected (401 Unauthorized).',
      customerMessage: "I'm temporarily unable to connect to the AI assistant. You can still book your laundry using our regular booking form or WhatsApp (+91 8080082714).",
      adminMessage: 'OpenAI API key is missing or rejected (401). Check OPENAI_API_KEY or switch to AI_PROVIDER=ollama.',
      rawLog: rawMessage
    };
  }

  if (apiCode === 'insufficient_quota' || lowerMsg.includes('quota') || lowerMsg.includes('billing')) {
    return {
      errorCode: 'INSUFFICIENT_QUOTA',
      statusLabel: 'AI Error: Insufficient Credits',
      diagnosticMessage: 'OpenAI account has insufficient API credits or billing is inactive.',
      customerMessage: "I'm temporarily unable to connect to the AI assistant right now. You can still book using our regular booking form or WhatsApp (+91 8080082714).",
      adminMessage: 'OpenAI insufficient quota/credits. Switch AI_PROVIDER=ollama for free local AI.',
      rawLog: rawMessage
    };
  }

  if (status === 429 || apiCode === 'rate_limit_exceeded') {
    return {
      errorCode: 'RATE_LIMIT_EXCEEDED',
      statusLabel: 'AI Error: Rate Limit Reached',
      diagnosticMessage: 'OpenAI API rate limit reached.',
      customerMessage: 'The AI assistant is busy right now. Please try again shortly or use our booking form.',
      adminMessage: 'OpenAI rate limit reached (429).',
      rawLog: rawMessage
    };
  }

  if (status === 404 || apiCode === 'model_not_found' || (status === 400 && lowerMsg.includes('model'))) {
    return {
      errorCode: 'UNSUPPORTED_MODEL',
      statusLabel: 'AI Error: Unsupported Model',
      diagnosticMessage: `Model "${getModelName()}" is unsupported or unavailable.`,
      customerMessage: "I'm temporarily unable to connect to the AI assistant. Please use our regular booking form.",
      adminMessage: `Configured OpenAI model "${getModelName()}" was rejected.`,
      rawLog: rawMessage
    };
  }

  if (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT' || lowerMsg.includes('timeout')) {
    return {
      errorCode: 'BACKEND_TIMEOUT',
      statusLabel: 'AI Error: Request Timed Out',
      diagnosticMessage: 'OpenAI API request timed out.',
      customerMessage: 'The AI assistant took too long to respond. Please try again or use our booking form.',
      adminMessage: 'OpenAI API request timed out.',
      rawLog: rawMessage
    };
  }

  if (['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'EAI_AGAIN'].includes(err?.code) || lowerMsg.includes('network')) {
    return {
      errorCode: 'NETWORK_ERROR',
      statusLabel: 'AI Error: Network Unreachable',
      diagnosticMessage: 'Could not reach OpenAI over the network.',
      customerMessage: "I'm temporarily unable to reach the AI service. Please use our regular booking form.",
      adminMessage: 'Backend could not reach api.openai.com.',
      rawLog: rawMessage
    };
  }

  if (err?.isInvalidResponse) {
    return {
      errorCode: 'INVALID_API_RESPONSE',
      statusLabel: 'AI Error: Invalid Response',
      diagnosticMessage: 'Empty or invalid response from OpenAI.',
      customerMessage: 'Unexpected AI response. Please try again or use our booking form.',
      adminMessage: 'OpenAI returned an empty or invalid response.',
      rawLog: rawMessage
    };
  }

  return {
    errorCode: 'AI_PROVIDER_ERROR',
    statusLabel: 'AI Service Unavailable',
    diagnosticMessage: `OpenAI error: ${rawMessage}`,
    customerMessage: "I'm temporarily unable to connect to the AI assistant. You can still book using our regular booking form.",
    adminMessage: `OpenAI error: ${rawMessage}`,
    rawLog: rawMessage
  };
}

module.exports = {
  name: 'openai',
  getModelName,
  checkHealth,
  createChatCompletion,
  classifyError
};
