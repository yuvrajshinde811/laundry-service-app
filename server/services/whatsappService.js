const axios = require('axios');

/**
 * WhatsApp Notification Service
 * Supports:
 * 1. Meta WhatsApp Business Cloud API (when tokens are set in .env)
 * 2. Fallback mock / development logger mode
 * 3. Pre-filled wa.me direct click-to-chat links
 */

// Helper to normalize Indian/international phone numbers for WhatsApp API & wa.me
function formatWhatsAppNumber(phone) {
  if (!phone) return '';
  // Remove all non-numeric characters
  let cleaned = String(phone).replace(/\D/g, '');
  
  // If 10 digits (Standard Indian mobile), prepend 91
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  // If 11 digits starting with 0, replace 0 with 91
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = '91' + cleaned.substring(1);
  }
  
  return cleaned;
}

// Generate customer confirmation message text
function buildCustomerMessage(order) {
  const customerName = order.customerSnapshot?.name || 'Customer';
  const orderId = order.orderId;
  const pickupDate = order.pickupDate;
  const pickupTime = order.pickupTimeSlot;
  const totalAmount = order.totalAmount;
  const status = order.status || 'Booking Confirmed';

  // Format items list
  const itemsText = order.items
    .map((it) => `• ${it.item} × ${it.quantity} (${it.service})`)
    .join('\n');

  return `Hello ${customerName} 👋

Your laundry booking has been successfully confirmed.

*Order ID:* ${orderId}

📅 *Pickup Date:* ${pickupDate}
⏰ *Pickup Time:* ${pickupTime}

🧺 *Laundry Items:*
${itemsText}

💰 *Total Amount:* ₹${totalAmount}
📦 *Delivery Preference:* ${order.deliveryPreference || 'Standard'}
⚡ *Status:* ${status}

Thank you for choosing our laundry service! We will contact you shortly regarding pickup and delivery.

Track your order anytime at:
${process.env.APP_BASE_URL || 'http://localhost:5000'}/tracking.html?orderId=${orderId}&phone=${order.customerSnapshot?.phone}`;
}

// Generate admin notification message text
function buildAdminMessage(order) {
  const adminNumber = process.env.ADMIN_WHATSAPP_NUMBER || '8080082714';
  const customer = order.customerSnapshot || {};
  const itemsText = order.items
    .map((it) => `• ${it.item} × ${it.quantity} (${it.service} @ ₹${it.itemTotal})`)
    .join('\n');

  const instructions = order.additionalInstructions
    ? order.additionalInstructions
    : 'None';

  return `🔔 *NEW LAUNDRY BOOKING*

*Order ID:* ${order.orderId}

👤 *Customer:* ${customer.name}
📞 *Phone:* ${customer.phone}
💬 *WhatsApp:* ${customer.whatsappNumber}
📍 *Address:* ${customer.address}, ${customer.area || ''}, ${customer.city} - ${customer.pincode}

📅 *Pickup:* ${order.pickupDate} (${order.pickupTimeSlot})
🚚 *Delivery:* ${order.deliveryPreference || 'Standard'} (Est. ${order.deliveryDate || 'Within 24-48h'})

🧺 *Items:*
${itemsText}

💵 *Subtotal:* ₹${order.subtotal}
🚚 *Delivery Charge:* ₹${order.deliveryCharge}
⚡ *Express Charge:* ₹${order.expressCharge || 0}
🏷️ *Discount:* ₹${order.discount || 0}
💰 *Total Amount:* ₹${order.totalAmount}

📝 *Customer Instructions:*
${instructions}

📊 *Status:* ${order.status || 'Booking Confirmed'}

Open Admin Dashboard:
${process.env.APP_BASE_URL || 'http://localhost:5000'}/admin/dashboard.html`;
}

// Send WhatsApp message via Meta Cloud API or log in mock mode
async function sendWhatsAppMessage(recipientPhone, messageText) {
  const formattedPhone = formatWhatsAppNumber(recipientPhone);
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  const directChatUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(messageText)}`;

  // If Cloud API credentials are provided, attempt real Cloud API call
  if (token && phoneNumberId && token !== 'your_token' && token !== 'your_meta_whatsapp_cloud_api_token_here') {
    try {
      console.log(`📱 Sending WhatsApp Cloud API message to +${formattedPhone}...`);
      const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'text',
        text: {
          preview_url: false,
          body: messageText
        }
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 8000
      });

      console.log(`✅ WhatsApp message sent successfully to +${formattedPhone}. ID:`, response.data?.messages?.[0]?.id);
      return {
        success: true,
        mode: 'cloud-api',
        messageId: response.data?.messages?.[0]?.id,
        recipient: formattedPhone,
        directChatUrl
      };
    } catch (apiError) {
      console.warn(`⚠️ Meta WhatsApp Cloud API failed for +${formattedPhone}:`, apiError.response?.data || apiError.message);
      return {
        success: false,
        mode: 'cloud-api-failed-fallback',
        error: apiError.response?.data?.error?.message || apiError.message,
        recipient: formattedPhone,
        directChatUrl
      };
    }
  }

  // Development / Mock mode
  console.log('\n================== 📱 WHATSAPP NOTIFICATION SIMULATOR ==================');
  console.log(`To: +${formattedPhone}`);
  console.log(`Mode: Mock / Development (Direct WhatsApp link available)`);
  console.log(`Click-to-chat URL: ${directChatUrl}`);
  console.log('--- MESSAGE CONTENT ---');
  console.log(messageText);
  console.log('========================================================================\n');

  return {
    success: true,
    mode: 'mock-simulation',
    recipient: formattedPhone,
    directChatUrl,
    simulatedAt: new Date()
  };
}

/**
 * Trigger both Customer and Admin notifications safely without failing the order
 */
async function notifyOrderCreated(order) {
  const results = {
    customerNotification: null,
    adminNotification: null
  };

  const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER || '8080082714';
  const customerPhone = order.customerSnapshot?.whatsappNumber || order.customerSnapshot?.phone;

  // 1. Customer Notification
  try {
    const customerMsg = buildCustomerMessage(order);
    results.customerNotification = await sendWhatsAppMessage(customerPhone, customerMsg);
  } catch (err) {
    console.error('Customer WhatsApp notification error:', err.message);
    results.customerNotification = { success: false, error: err.message };
  }

  // 2. Admin Notification
  try {
    const adminMsg = buildAdminMessage(order);
    results.adminNotification = await sendWhatsAppMessage(adminPhone, adminMsg);
  } catch (err) {
    console.error('Admin WhatsApp notification error:', err.message);
    results.adminNotification = { success: false, error: err.message };
  }

  return results;
}

/**
 * Send status update notification to customer
 */
async function notifyStatusUpdate(order, newStatus, customNote = '') {
  const customerPhone = order.customerSnapshot?.whatsappNumber || order.customerSnapshot?.phone;
  const customerName = order.customerSnapshot?.name || 'Customer';

  const statusMsg = `Hello ${customerName} 👋

Your laundry order *${order.orderId}* status has been updated!

⚡ *New Status:* ${newStatus}
${customNote ? `📝 *Note:* ${customNote}\n` : ''}
Track live progress:
${process.env.APP_BASE_URL || 'http://localhost:5000'}/tracking.html?orderId=${order.orderId}&phone=${order.customerSnapshot?.phone}

Thank you for choosing our laundry service!`;

  return sendWhatsAppMessage(customerPhone, statusMsg);
}

module.exports = {
  formatWhatsAppNumber,
  buildCustomerMessage,
  buildAdminMessage,
  sendWhatsAppMessage,
  notifyOrderCreated,
  notifyStatusUpdate
};
