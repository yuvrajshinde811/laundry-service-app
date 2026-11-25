/**
 * End-to-End Automated API Verification Suite
 */

const http = require('http');
const mongoose = require('mongoose');
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/laundry_service_test';
const { connectDB, isUsingMemoryStore } = require('../server/config/database');
const app = require('../server/server');

let server;
let port = 5055;
let baseUrl = `http://localhost:${port}`;
let adminToken = '';
let createdOrderId = '';

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(rawData);
            resolve({ status: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, data: rawData });
          }
        });
      }
    );

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🚀 Starting Full-Stack Laundry Application Automated Tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Connect to isolated test DB (or fallback memoryStore if MongoDB is off) & start test server
  await connectDB();
  server = app.listen(port);
  await new Promise((r) => setTimeout(r, 500));

  try {
    // 1. Health Check
    console.log('Test Suite 1: Server Health & Status');
    const health = await makeRequest('GET', '/api/health');
    assert(health.status === 200 && health.data.status === 'online', 'Health endpoint returns 200 online');

    // 2. Services & Catalog
    console.log('\nTest Suite 2: Laundry Services & Item Catalog');
    const services = await makeRequest('GET', '/api/services');
    assert(services.status === 200 && services.data.success, 'GET /api/services returns success');
    assert(Array.isArray(services.data.services) && services.data.services.length >= 3, 'Services catalog contains at least 3 service types');
    assert(Array.isArray(services.data.items) && services.data.items.length >= 5, 'Item catalog contains standard items (Shirt, Pants, etc.)');

    // 3. Validation Rules Test
    console.log('\nTest Suite 3: Validation Error Handling');
    const invalidOrder = await makeRequest('POST', '/api/orders', {
      name: 'Test',
      phone: '123' // Invalid short phone
    });
    assert(invalidOrder.status === 400 && !invalidOrder.data.success, 'Rejects invalid phone number with 400 Bad Request');

    const emptyItemsOrder = await makeRequest('POST', '/api/orders', {
      name: 'Test Customer',
      phone: '9876543210',
      whatsappNumber: '9876543210',
      address: '123 Street',
      city: 'Mumbai',
      pincode: '400001',
      items: [], // Empty items array
      pickupDate: '2026-08-22',
      pickupTimeSlot: '10:00 AM – 12:00 PM'
    });
    assert(emptyItemsOrder.status === 400, 'Rejects order with empty items list');

    // 4. Successful Booking Flow
    console.log('\nTest Suite 4: Customer Order Creation & Price Computation');
    const validBooking = await makeRequest('POST', '/api/orders', {
      name: 'Yuvraj Shinde',
      phone: '9876543210',
      whatsappNumber: '9876543210',
      email: 'yuvraj@example.com',
      address: 'Flat 402, Sunshine Heights',
      area: 'Bandra West',
      city: 'Mumbai',
      pincode: '400050',
      items: [
        { item: 'Shirt', quantity: 5, service: 'Washing + Ironing', unitPrice: 35, itemTotal: 175 },
        { item: 'Pants', quantity: 2, service: 'Washing + Ironing', unitPrice: 40, itemTotal: 80 },
        { item: 'Bedsheet', quantity: 1, service: 'Washing + Ironing', unitPrice: 90, itemTotal: 90 }
      ],
      pickupDate: '2026-08-22',
      pickupTimeSlot: '11:00 AM – 1:00 PM',
      deliveryPreference: 'Standard',
      additionalInstructions: 'Handle white shirts separately',
      couponCode: 'FRESH10'
    });

    assert(validBooking.status === 201 && validBooking.data.success, 'POST /api/orders creates booking with 201 Created');
    assert(validBooking.data.orderId.startsWith('LAUNDRY-'), `Generated unique Order ID: ${validBooking.data.orderId}`);
    assert(validBooking.data.order.status === 'Booking Confirmed', 'Initial order status is "Booking Confirmed"');
    assert(validBooking.data.order.totalAmount > 0, `Calculated Grand Total: ₹${validBooking.data.order.totalAmount}`);
    assert(validBooking.data.whatsappStatus !== undefined, 'WhatsApp dispatch status recorded');
    
    createdOrderId = validBooking.data.orderId;

    // 5. Order Tracking Test
    console.log('\nTest Suite 5: Customer Order Tracking');
    const tracking = await makeRequest('POST', '/api/orders/track', {
      orderId: createdOrderId,
      phone: '9876543210'
    });
    assert(tracking.status === 200 && tracking.data.success, 'POST /api/orders/track finds order by ID + Phone');
    assert(tracking.data.trackingProgress.stages.length === 8, 'Returns all 8 progression timeline stages');
    assert(tracking.data.order.customerName === 'Yuvraj Shinde', 'Customer snapshot retrieved accurately');

    // 6. Admin Authentication Test
    console.log('\nTest Suite 6: Admin Authentication & JWT');
    const adminLogin = await makeRequest('POST', '/api/auth/login', {
      email: 'admin@laundry.com',
      password: 'Admin@123456'
    });
    assert(adminLogin.status === 200 && adminLogin.data.token, 'POST /api/auth/login authenticates default admin');
    adminToken = adminLogin.data.token;

    // 7. Admin Dashboard KPI Stats
    console.log('\nTest Suite 7: Admin KPI Analytics & Order Management');
    const stats = await makeRequest('GET', '/api/admin/stats', null, {
      Authorization: `Bearer ${adminToken}`
    });
    assert(stats.status === 200 && stats.data.success, 'GET /api/admin/stats returns 200 with JWT');
    assert(stats.data.stats.totalOrders >= 1, `Total orders counted in dashboard: ${stats.data.stats.totalOrders}`);

    const ordersList = await makeRequest('GET', '/api/admin/orders', null, {
      Authorization: `Bearer ${adminToken}`
    });
    assert(ordersList.status === 200 && Array.isArray(ordersList.data.orders), 'GET /api/admin/orders lists customer bookings');

    // 8. Order Status Update
    console.log('\nTest Suite 8: Order Status Transitions');
    const updateStatus = await makeRequest('PATCH', `/api/admin/orders/${createdOrderId}/status`, {
      status: 'Picked Up',
      note: 'Driver picked up clothes from customer doorstep',
      sendCustomerWhatsApp: true
    }, {
      Authorization: `Bearer ${adminToken}`
    });
    assert(updateStatus.status === 200 && updateStatus.data.order.status === 'Picked Up', 'PATCH /api/admin/orders/:id/status updates status to "Picked Up"');

    // Re-verify tracking reflects new status
    const trackingUpdated = await makeRequest('POST', '/api/orders/track', {
      orderId: createdOrderId,
      phone: '9876543210'
    });
    assert(trackingUpdated.data.order.status === 'Picked Up', 'Customer tracking immediately reflects updated status "Picked Up"');

    // 9. AI Status & Customer Chatbot Validation/Fallback
    console.log('\nTest Suite 9: Customer AI Chatbot & Fallback');
    const aiStatus = await makeRequest('GET', '/api/ai/status');
    assert(aiStatus.status === 200 && aiStatus.data.success, 'GET /api/ai/status returns 200 without leaking secrets');
    assert(!JSON.stringify(aiStatus.data).includes('sk-'), 'AI status response contains no API keys');

    const emptyChat = await makeRequest('POST', '/api/ai/chat', { message: '   ' });
    assert(emptyChat.status === 400 && !emptyChat.data.success, 'Rejects empty AI chat message with 400');

    const chatResp = await makeRequest('POST', '/api/ai/chat', { message: 'What laundry services do you offer?' });
    assert(chatResp.status === 200 && chatResp.data.success && Boolean(chatResp.data.reply), 'POST /api/ai/chat returns valid response or safe fallback');
    assert(Boolean(chatResp.data.sessionId), 'Creates isolated session ID for customer conversation');

    const clearResp = await makeRequest('POST', '/api/ai/chat/clear', { sessionId: chatResp.data.sessionId });
    assert(clearResp.status === 200 && clearResp.data.success, 'POST /api/ai/chat/clear resets customer session');

    // 10. AI Conversational Booking Assistant
    console.log('\nTest Suite 10: AI Conversational Booking Assistant');
    const draftTurn1 = await makeRequest('POST', '/api/ai/booking-assistant', {
      updates: {
        name: 'Aarav Patel',
        items: [{ item: 'Shirt', quantity: 5, service: 'Washing' }]
      },
      confirm: false
    });
    assert(draftTurn1.status === 200 && draftTurn1.data.confirmed === false, 'Turn 1 saves partial booking draft without confirming');
    assert(draftTurn1.data.quote && draftTurn1.data.quote.subtotal === 125, `Calculates Shirt x 5 Washing subtotal accurately: ₹${draftTurn1.data.quote?.subtotal}`);
    const aiBookingSession = draftTurn1.data.sessionId;

    const draftTurn2 = await makeRequest('POST', '/api/ai/booking-assistant', {
      sessionId: aiBookingSession,
      updates: {
        defaultService: 'Washing + Ironing'
      },
      confirm: false
    });
    assert(draftTurn2.status === 200 && draftTurn2.data.quote.subtotal === 175, `Remembers items and updates to Washing + Ironing: ₹${draftTurn2.data.quote?.subtotal}`);

    const invalidConfirm = await makeRequest('POST', '/api/ai/booking-assistant', {
      sessionId: aiBookingSession,
      updates: { phone: '123' },
      confirm: true
    });
    assert(invalidConfirm.status === 400 && !invalidConfirm.data.confirmed, 'Rejects AI booking confirmation when required fields are invalid/missing');

    const validConfirm = await makeRequest('POST', '/api/ai/booking-assistant', {
      sessionId: aiBookingSession,
      updates: {
        phone: '9988776655',
        whatsappNumber: '9988776655',
        address: '22 Marine Drive',
        city: 'Mumbai',
        pincode: '400020',
        pickupDate: '2026-11-26',
        pickupTimeSlot: '2:00 PM – 4:00 PM',
        deliveryPreference: 'Express'
      },
      confirm: true
    });
    assert(validConfirm.status === 201 && validConfirm.data.confirmed === true, 'Completes AI booking through existing order pipeline with 201 Created');
    assert(validConfirm.data.orderId.startsWith('LAUNDRY-'), `AI booking generated Order ID: ${validConfirm.data.orderId}`);
    assert(validConfirm.data.order.expressCharge === 100, 'Applies ₹100 Express delivery charge accurately');

    // 11. AI Order Tracking & Customer Isolation
    console.log('\nTest Suite 11: AI Order Tracking & Isolation');
    const aiTrackOk = await makeRequest('POST', '/api/ai/track-order', {
      orderId: validConfirm.data.orderId,
      phone: '9988776655'
    });
    assert(aiTrackOk.status === 200 && aiTrackOk.data.order.status === 'Booking Confirmed', 'AI tracking retrieves verified customer order');

    const aiTrackDenied = await makeRequest('POST', '/api/ai/track-order', {
      orderId: validConfirm.data.orderId,
      phone: '9111111111'
    });
    assert(aiTrackDenied.status === 401 && !aiTrackDenied.data.success, 'Rejects AI tracking with mismatched phone number');

    // 12. Admin AI Authorization & Business Insights
    console.log('\nTest Suite 12: Admin AI Security & Analytics');
    const unauthSummary = await makeRequest('GET', '/api/admin/ai/business-summary');
    assert(unauthSummary.status === 401, 'Blocks unauthorized access to /api/admin/ai/business-summary');

    const unauthAdminChat = await makeRequest('POST', '/api/admin/ai/chat', { message: 'Today revenue?' });
    assert(unauthAdminChat.status === 401, 'Blocks unauthorized access to /api/admin/ai/chat');

    const adminSummary = await makeRequest('GET', '/api/admin/ai/business-summary', null, {
      Authorization: `Bearer ${adminToken}`
    });
    assert(adminSummary.status === 200 && adminSummary.data.success, 'GET /api/admin/ai/business-summary succeeds with admin JWT');
    assert(adminSummary.data.summary.overview.totalOrders >= 2, `Analytics reflects real total orders: ${adminSummary.data.summary.overview.totalOrders}`);
    assert(Array.isArray(adminSummary.data.summary.popularServices) && adminSummary.data.summary.popularServices.length > 0, 'Computes popular services from real orders');

    const revInsights = await makeRequest('GET', '/api/admin/ai/revenue-insights', null, {
      Authorization: `Bearer ${adminToken}`
    });
    assert(revInsights.status === 200 && revInsights.data.insights.totalRevenue > 0, `Revenue insights calculated: ₹${revInsights.data.insights?.totalRevenue}`);
    assert(Array.isArray(revInsights.data.insights.dailyTrend) && revInsights.data.insights.dailyTrend.length === 7, 'Provides 7-day daily revenue trend for dashboard charts');

    const adminChatResp = await makeRequest('POST', '/api/admin/ai/chat', {
      message: 'What is today revenue?'
    }, {
      Authorization: `Bearer ${adminToken}`
    });
    assert(adminChatResp.status === 200 && adminChatResp.data.success && Boolean(adminChatResp.data.reply), 'POST /api/admin/ai/chat responds cleanly with admin JWT');

    const emptyActionConfirm = await makeRequest('POST', '/api/admin/ai/confirm-action', {
      sessionId: adminChatResp.data.sessionId,
      confirm: true
    }, {
      Authorization: `Bearer ${adminToken}`
    });
    assert(emptyActionConfirm.status === 400, 'Rejects confirm-action when no pending modification exists');

    // 13. Repeat-Customer MongoDB Persistence & Unlimited Admin Orders Fetch (>25 orders, mixed statuses)
    console.log('\nTest Suite 13: Repeat Customers & All-Orders Admin Retrieval');
    const createdBatchIds = [];
    for (let i = 0; i < 28; i++) {
      // Reuse same phone numbers repeatedly to verify Customer.findOneAndUpdate never fails on immutable _id
      const repeatPhone = i % 2 === 0 ? '9876543210' : '9988776655';
      const resp = await makeRequest('POST', '/api/orders', {
        name: i % 2 === 0 ? 'Yuvraj Shinde' : 'Aarav Patel',
        phone: repeatPhone,
        whatsappNumber: repeatPhone,
        address: 'Batch Test Street ' + i,
        city: 'Mumbai',
        pincode: '400050',
        items: [{ item: 'Shirt', quantity: 2, service: 'Washing + Ironing' }],
        pickupDate: '2026-11-26',
        pickupTimeSlot: '11:00 AM – 1:00 PM',
        deliveryPreference: 'Standard'
      });
      if (resp.status === 201 && resp.data.orderId) {
        createdBatchIds.push(resp.data.orderId);
      }
    }
    assert(createdBatchIds.length === 28, `Created 28 repeat-customer bookings cleanly (${createdBatchIds.length}/28)`);

    // Update a couple of orders to different statuses (Delivered, Cancelled, Washing)
    await makeRequest('PATCH', `/api/admin/orders/${createdBatchIds[0]}/status`, { status: 'Delivered', sendCustomerWhatsApp: false }, { Authorization: `Bearer ${adminToken}` });
    await makeRequest('PATCH', `/api/admin/orders/${createdBatchIds[1]}/status`, { status: 'Cancelled', sendCustomerWhatsApp: false }, { Authorization: `Bearer ${adminToken}` });
    await makeRequest('PATCH', `/api/admin/orders/${createdBatchIds[2]}/status`, { status: 'Washing', sendCustomerWhatsApp: false }, { Authorization: `Bearer ${adminToken}` });

    // Fetch ALL orders via Admin API without limit truncation (should return all 30 orders: 2 prior + 28 batch)
    const allAdminOrders = await makeRequest('GET', '/api/admin/orders?status=All', null, {
      Authorization: `Bearer ${adminToken}`
    });
    assert(allAdminOrders.status === 200 && allAdminOrders.data.orders.length >= 30, `GET /api/admin/orders?status=All fetches ALL orders without 25-item cap (${allAdminOrders.data.orders?.length})`);

    const allLowercase = await makeRequest('GET', '/api/admin/orders?limit=all&status=all', null, {
      Authorization: `Bearer ${adminToken}`
    });
    assert(allLowercase.status === 200 && allLowercase.data.orders.length === allAdminOrders.data.orders.length, 'Case-insensitive status=all returns identical full order set');

    // Verify both Delivered and Cancelled orders appear in All Orders AND tracking works for all batch orders
    const returnedIds = new Set(allAdminOrders.data.orders.map((o) => o.orderId));
    const missingFromAdmin = createdBatchIds.filter((id) => !returnedIds.has(id));
    assert(missingFromAdmin.length === 0, 'Every created repeat-customer order across all statuses appears in Admin Orders');

    const trackDelivered = await makeRequest('POST', '/api/orders/track', {
      orderId: createdBatchIds[0],
      phone: '9876543210'
    });
    assert(trackDelivered.status === 200 && trackDelivered.data.order.status === 'Delivered', 'Tracking still works for repeat-customer Delivered order');

    console.log(`\n========================================`);
    console.log(`📊 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

  } catch (err) {
    console.error('Fatal Test Suite Error:', err);
    failed++;
  } finally {
    if (!isUsingMemoryStore() && mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase().catch(() => {});
      await mongoose.disconnect().catch(() => {});
    }
    if (server) server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
