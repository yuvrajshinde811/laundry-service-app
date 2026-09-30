/**
 * End-to-End Automated API Verification Suite
 */

const http = require('http');
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

  // Start test server
  server = app.listen(port);
  await new Promise((r) => setTimeout(r, 1000));

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

    console.log(`\n========================================`);
    console.log(`📊 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

  } catch (err) {
    console.error('Fatal Test Suite Error:', err);
    failed++;
  } finally {
    if (server) server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
