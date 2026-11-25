/**
 * Automated Tests for Ollama Primary AI Provider, Tool-Calling Loop,
 * Grounded DB Access, Multi-Provider Modularity & Offline Fallback.
 */

const assert = require('assert');
const axios = require('axios');

// Configure Ollama as primary provider for tests
process.env.AI_ENABLED = 'true';
process.env.AI_PROVIDER = 'ollama';
process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
process.env.OLLAMA_MODEL = 'llama3.2:3b';

let mockOllamaPostQueue = [];
let mockOllamaTagsResponse = {
  data: { models: [{ name: 'llama3.2:3b' }] }
};
let shouldTagsFail = false;

// Stub axios.get and axios.post for deterministic offline testing of Ollama HTTP protocol
const origAxiosGet = axios.get.bind(axios);
const origAxiosPost = axios.post.bind(axios);

axios.get = async (url, config) => {
  if (String(url).includes('/api/tags')) {
    if (shouldTagsFail) {
      const err = new Error('connect ECONNREFUSED 127.0.0.1:11434');
      err.code = 'ECONNREFUSED';
      throw err;
    }
    return mockOllamaTagsResponse;
  }
  return origAxiosGet(url, config);
};

axios.post = async (url, payload, config) => {
  if (String(url).includes('/api/chat')) {
    assert.strictEqual(payload.model, 'llama3.2:3b', 'Sends configured OLLAMA_MODEL');
    assert.strictEqual(payload.stream, false, 'Uses non-streaming /api/chat');
    if (mockOllamaPostQueue.length === 0) {
      throw new Error('Mock Ollama queue empty');
    }
    const handler = mockOllamaPostQueue.shift();
    return typeof handler === 'function' ? handler(payload) : handler;
  }
  return origAxiosPost(url, payload, config);
};

const { connectDB } = require('../server/config/database');
const aiService = require('../server/services/aiService');
const ollamaProvider = require('../server/services/providers/ollamaProvider');
const openaiProvider = require('../server/services/providers/openaiProvider');
const geminiProvider = require('../server/services/providers/geminiProvider');

async function runAIToolTests() {
  console.log('🦙 Starting Ollama & Modular AI Provider Tests...\n');
  let passed = 0;
  let failed = 0;

  function check(cond, label) {
    if (cond) {
      console.log(`  ✅ PASS: ${label}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${label}`);
      failed++;
    }
  }

  await connectDB();

  try {
    // 1. Health Check when Ollama IS running with llama3.2:3b
    shouldTagsFail = false;
    const healthyStatus = await aiService.getAIConfigStatus();
    check(healthyStatus.available === true && healthyStatus.provider === 'ollama' && healthyStatus.model === 'llama3.2:3b', 'Detects running Ollama server with llama3.2:3b');

    // 2. Customer asks about services & pricing via Ollama /api/chat tool calling
    mockOllamaPostQueue = [
      () => ({
        data: {
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [{
              function: { name: 'get_services_and_pricing', arguments: {} }
            }]
          }
        }
      }),
      (payload) => {
        const toolMsg = payload.messages.find((m) => m.role === 'tool');
        const toolData = JSON.parse(toolMsg.content);
        assert(toolData.itemPricing.Shirt.washing_ironing === 35);
        assert(toolData.businessInfo.whatsapp === '8080082714');
        return {
          data: {
            message: {
              role: 'assistant',
              content: 'We offer Washing, Washing + Ironing (Shirt ₹35/piece), Dry Cleaning, Ironing, Bedsheet Cleaning, and Blanket Cleaning.'
            }
          }
        };
      }
    ];

    const svcRes = await aiService.runCustomerAIChat({ message: 'What laundry services do you offer and what are your prices?' });
    check(svcRes.success && !svcRes.fallback && svcRes.provider === 'ollama' && svcRes.reply.includes('₹35'), 'Customer AI retrieves real services & pricing via Ollama /api/chat');

    // 3. Conversational Booking via Ollama
    const bookingSessId = svcRes.sessionId;
    mockOllamaPostQueue = [
      () => ({
        data: {
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [{
              function: {
                name: 'update_booking_draft_and_quote',
                arguments: {
                  name: 'Riya Sharma',
                  phone: '9820012345',
                  whatsappNumber: '9820012345',
                  address: '101 Sea View, Worli',
                  city: 'Mumbai',
                  pincode: '400018',
                  items: [{ item: 'Shirt', quantity: 4, service: 'Washing + Ironing' }],
                  pickupDate: '2026-11-26',
                  pickupTimeSlot: '11:00 AM – 1:00 PM',
                  deliveryPreference: 'Standard'
                }
              }
            }]
          }
        }
      }),
      (payload) => {
        const toolData = JSON.parse(payload.messages.find((m) => m.role === 'tool').content);
        assert(toolData.validation.isValid === true);
        assert(toolData.quote.totalAmount === 190);
        return {
          data: {
            message: {
              role: 'assistant',
              content: 'Summary: 4 Shirts (Washing + Ironing) = ₹140 + ₹50 delivery = ₹190. Would you like me to confirm this booking?'
            }
          }
        };
      }
    ];

    const draftRes = await aiService.runCustomerAIChat({
      sessionId: bookingSessId,
      message: 'Book 4 shirts washing and ironing for Riya Sharma, 9820012345, 101 Sea View Worli Mumbai 400018 on 2026-11-26 11 AM-1 PM'
    });
    check(!draftRes.createdOrder && draftRes.reply.includes('confirm'), 'Ollama conversational booking computes quote (₹190) and requests confirmation');

    mockOllamaPostQueue = [
      () => ({
        data: {
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [{
              function: {
                name: 'submit_laundry_booking',
                arguments: { confirmedByCustomer: true }
              }
            }]
          }
        }
      }),
      (payload) => {
        const toolData = JSON.parse(payload.messages.find((m) => m.role === 'tool').content);
        assert(toolData.success === true && toolData.orderId.startsWith('LAUNDRY-'));
        return {
          data: {
            message: {
              role: 'assistant',
              content: `Your booking is confirmed! Order ID: ${toolData.orderId}`
            }
          }
        };
      }
    ];

    const confirmRes = await aiService.runCustomerAIChat({
      sessionId: bookingSessId,
      message: 'Yes, confirm'
    });
    check(Boolean(confirmRes.createdOrder && confirmRes.createdOrder.orderId), `Ollama creates confirmed order (${confirmRes.createdOrder?.orderId}) via existing pipeline`);

    const createdOrderId = confirmRes.createdOrder.orderId;

    // 4. Order Tracking via Ollama
    mockOllamaPostQueue = [
      () => ({
        data: {
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [{
              function: {
                name: 'track_customer_order',
                arguments: { orderId: createdOrderId, phone: '9820012345' }
              }
            }]
          }
        }
      }),
      (payload) => {
        const toolData = JSON.parse(payload.messages.find((m) => m.role === 'tool').content);
        assert(toolData.found === true && toolData.status === 'Booking Confirmed');
        return {
          data: {
            message: {
              role: 'assistant',
              content: `Your order ${createdOrderId} is currently Booking Confirmed.`
            }
          }
        };
      }
    ];

    const trackRes = await aiService.runCustomerAIChat({
      sessionId: bookingSessId,
      message: `Where is my order ${createdOrderId}? My phone is 9820012345`
    });
    check(trackRes.trackedOrder && trackRes.trackedOrder.orderId === createdOrderId, 'Ollama tracks verified customer order');

    // 5. Admin AI Analytics & Action Confirmation via Ollama
    mockOllamaPostQueue = [
      () => ({
        data: {
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [{
              function: { name: 'get_business_analytics', arguments: {} }
            }]
          }
        }
      }),
      (payload) => {
        const analytics = JSON.parse(payload.messages.find((m) => m.role === 'tool').content);
        assert(analytics.overview.totalOrders >= 1 && analytics.overview.todayRevenue >= 190);
        return {
          data: {
            message: {
              role: 'assistant',
              content: `Today's orders: ${analytics.overview.todayOrders}, Today's revenue: ₹${analytics.overview.todayRevenue}.`
            }
          }
        };
      }
    ];

    const adminAuth = { id: 'adm-1', email: 'admin@laundry.com', name: 'Admin' };
    const admStatRes = await aiService.runAdminAIChat({
      admin: adminAuth,
      message: 'What is today revenue?'
    });
    check(!admStatRes.fallback && admStatRes.reply.includes('190'), 'Admin AI retrieves real DB analytics via Ollama');

    // 6. Ollama Not Running Fallback Test
    shouldTagsFail = true;
    const offlineStatus = await aiService.getAIConfigStatus();
    check(offlineStatus.available === false && offlineStatus.statusCode === 'OLLAMA_NOT_RUNNING', 'Health check detects OLLAMA_NOT_RUNNING cleanly');

    mockOllamaPostQueue = [
      () => {
        const err = new Error('connect ECONNREFUSED 127.0.0.1:11434');
        err.code = 'ECONNREFUSED';
        throw err;
      }
    ];
    const offlineChat = await aiService.runCustomerAIChat({
      sessionId: bookingSessId,
      message: 'Hello?'
    });
    check(offlineChat.success && offlineChat.fallback === true && offlineChat.errorCode === 'OLLAMA_NOT_RUNNING', 'Customer AI returns friendly fallback when Ollama is not running');

    // 7. Error Classification & Modular Provider Tests (Ollama, OpenAI, Gemini)
    const missingModelErr = Object.assign(new Error('model "llama3.2:3b" not found'), { response: { status: 404, data: { error: 'model "llama3.2:3b" not found' } } });
    check(ollamaProvider.classifyError(missingModelErr).errorCode === 'OLLAMA_MODEL_NOT_FOUND', 'Ollama classifies missing local model error');

    const timeoutErr = Object.assign(new Error('timeout of 45000ms exceeded'), { code: 'ECONNABORTED' });
    check(ollamaProvider.classifyError(timeoutErr).errorCode === 'BACKEND_TIMEOUT', 'Ollama classifies backend timeout error');

    const invalidKeyErr = Object.assign(new Error('Incorrect API key sk-secret12345678'), { status: 401 });
    const cOpenAI = openaiProvider.classifyError(invalidKeyErr);
    check(cOpenAI.errorCode === 'INVALID_API_KEY' && !cOpenAI.rawLog.includes('sk-secret12345678'), 'Optional OpenAI provider redacts secrets and classifies 401');

    const gemHealth = await geminiProvider.checkHealth();
    check(gemHealth.provider === 'gemini' && gemHealth.statusCode === 'MISSING_API_KEY', 'Modular Gemini adapter ready for future activation');

    console.log(`\n========================================`);
    console.log(`🦙 OLLAMA & AI TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);
  } catch (err) {
    console.error('AI Tool Test Error:', err);
    failed++;
  } finally {
    process.exit(failed > 0 ? 1 : 0);
  }
}

runAIToolTests();
