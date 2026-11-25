const axios = require('axios');

/**
 * Official Ollama Local Chat API Provider
 * Docs: https://github.com/ollama/ollama/blob/main/docs/api.md
 */

function getBaseUrl() {
  return (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').trim().replace(/\/+$/, '');
}

function getModelName() {
  return (process.env.OLLAMA_MODEL || 'llama3.2:3b').trim();
}

function getTimeoutMs() {
  const parsed = parseInt(process.env.AI_TIMEOUT_MS, 10);
  return Number.isFinite(parsed) && parsed >= 3000 ? Math.min(parsed, 120000) : 45000;
}

function getMaxTokens() {
  const parsed = parseInt(process.env.AI_MAX_TOKENS, 10);
  return Number.isFinite(parsed) && parsed > 100 ? Math.min(parsed, 1500) : 600;
}

/**
 * Normalize internal conversation messages to Ollama /api/chat format
 */
function formatMessagesForOllama(messages) {
  return messages.map((m) => {
    const out = {
      role: m.role,
      content: typeof m.content === 'string' ? m.content : String(m.content || '')
    };
    if (m.tool_calls) {
      out.tool_calls = m.tool_calls;
    }
    if (m.role === 'tool' && m.tool_name) {
      out.tool_name = m.tool_name;
    }
    return out;
  });
}

/**
 * Check if local Ollama server is running and the configured model is installed
 */
async function checkHealth() {
  const baseUrl = getBaseUrl();
  const model = getModelName();

  try {
    const res = await axios.get(`${baseUrl}/api/tags`, { timeout: 1500 });
    const models = Array.isArray(res.data?.models) ? res.data.models : [];
    const baseModelTag = model.split(':')[0];
    const hasExactOrMatchingModel = models.some((m) => {
      const name = String(m.name || '');
      return name === model || name === `${model}:latest` || (model.indexOf(':') === -1 && name.startsWith(`${baseModelTag}:`));
    });

    if (!hasExactOrMatchingModel) {
      return {
        available: false,
        provider: 'ollama',
        model,
        statusCode: 'OLLAMA_MODEL_NOT_FOUND',
        statusLabel: `Ollama Model Missing (${model})`,
        diagnosticMessage: `Ollama is running at ${baseUrl}, but model "${model}" is not pulled yet. Run: ollama pull ${model}`
      };
    }

    return {
      available: true,
      provider: 'ollama',
      model,
      statusCode: 'READY',
      statusLabel: `Local AI Online (${model})`,
      diagnosticMessage: `Connected to local Ollama at ${baseUrl} using ${model}.`
    };
  } catch (err) {
    const classified = classifyError(err);
    return {
      available: false,
      provider: 'ollama',
      model,
      statusCode: classified.errorCode,
      statusLabel: classified.statusLabel,
      diagnosticMessage: classified.diagnosticMessage
    };
  }
}

/**
 * Send a chat completion request to the official Ollama /api/chat endpoint
 */
async function createChatCompletion({ messages, tools }) {
  const baseUrl = getBaseUrl();
  const model = getModelName();

  const payload = {
    model,
    messages: formatMessagesForOllama(messages),
    stream: false,
    options: {
      temperature: 0.2,
      num_predict: getMaxTokens()
    }
  };

  if (Array.isArray(tools) && tools.length > 0) {
    payload.tools = tools;
  }

  const response = await axios.post(`${baseUrl}/api/chat`, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: getTimeoutMs()
  });

  const data = response?.data;
  const msg = data?.message;

  if (!data || !msg) {
    const invalidErr = new Error('Invalid or empty response payload received from Ollama.');
    invalidErr.isInvalidResponse = true;
    throw invalidErr;
  }

  // Normalize tool_calls so aiService handles Ollama & OpenAI uniformly
  const normalizedToolCalls = Array.isArray(msg.tool_calls)
    ? msg.tool_calls.map((tc, idx) => ({
        id: tc.id || `ollama_call_${idx}_${Date.now()}`,
        type: 'function',
        function: {
          name: tc.function?.name,
          arguments: tc.function?.arguments || {}
        }
      }))
    : [];

  return {
    message: {
      role: msg.role || 'assistant',
      content: typeof msg.content === 'string' ? msg.content : '',
      tool_calls: normalizedToolCalls
    },
    raw: data
  };
}

/**
 * Classify Ollama errors cleanly without exposing internal stack traces
 */
function classifyError(err) {
  const status = err?.response?.status || err?.status || null;
  const apiErrorMsg = String(err?.response?.data?.error || err?.message || 'Unknown Ollama error');
  const lowerMsg = apiErrorMsg.toLowerCase();
  const code = String(err?.code || '').toUpperCase();
  const baseUrl = getBaseUrl();
  const model = getModelName();

  if (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    code === 'ECONNRESET' ||
    lowerMsg.includes('econnrefused') ||
    lowerMsg.includes('connect')
  ) {
    return {
      errorCode: 'OLLAMA_NOT_RUNNING',
      statusLabel: 'Local AI Offline (Ollama Not Running)',
      diagnosticMessage: `Local Ollama server is not reachable at ${baseUrl}. Start Ollama on your machine to enable free local AI.`,
      customerMessage: "I'm temporarily unable to connect to the local AI assistant right now. You can still book your laundry using our regular booking form, track an existing order, or contact our team on WhatsApp (+91 8080082714).",
      adminMessage: `Local Ollama server is not running at ${baseUrl}. Run "ollama serve" and ensure "${model}" is installed.`,
      rawLog: apiErrorMsg
    };
  }

  if (
    status === 404 ||
    lowerMsg.includes('model') && (lowerMsg.includes('not found') || lowerMsg.includes('pull'))
  ) {
    return {
      errorCode: 'OLLAMA_MODEL_NOT_FOUND',
      statusLabel: `Ollama Model Missing (${model})`,
      diagnosticMessage: `Ollama model "${model}" was not found locally. Run "ollama pull ${model}" in your terminal.`,
      customerMessage: "I'm temporarily unable to connect to the local AI assistant because the AI model is still being set up. You can still use our regular booking form or WhatsApp (+91 8080082714).",
      adminMessage: `Ollama model "${model}" is missing locally. Run: ollama pull ${model}`,
      rawLog: apiErrorMsg
    };
  }

  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || lowerMsg.includes('timeout')) {
    return {
      errorCode: 'BACKEND_TIMEOUT',
      statusLabel: 'AI Error: Request Timed Out',
      diagnosticMessage: 'The local Ollama model took too long to generate a response.',
      customerMessage: 'The AI assistant took too long to respond. Please try a shorter message or use our regular booking form.',
      adminMessage: `Ollama request timed out after ${getTimeoutMs()}ms while running "${model}".`,
      rawLog: apiErrorMsg
    };
  }

  if (err?.isInvalidResponse) {
    return {
      errorCode: 'INVALID_API_RESPONSE',
      statusLabel: 'AI Error: Invalid Response',
      diagnosticMessage: 'Received an empty or malformed response from Ollama.',
      customerMessage: 'I received an unexpected response from the AI service. Please try again or use our regular booking form.',
      adminMessage: 'Ollama returned an empty or malformed response object.',
      rawLog: apiErrorMsg
    };
  }

  return {
    errorCode: 'OLLAMA_PROVIDER_ERROR',
    statusLabel: 'Local AI Unavailable',
    diagnosticMessage: `Ollama error: ${apiErrorMsg}`,
    customerMessage: "I'm temporarily unable to connect to the AI assistant. You can still book your laundry using our regular booking form or contact us on WhatsApp (+91 8080082714).",
    adminMessage: `Ollama request failed: ${apiErrorMsg}`,
    rawLog: apiErrorMsg
  };
}

module.exports = {
  name: 'ollama',
  getBaseUrl,
  getModelName,
  checkHealth,
  createChatCompletion,
  classifyError
};
