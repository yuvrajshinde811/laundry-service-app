/**
 * Admin Portal Dashboard Logic
 */

let currentAdminToken = null;
let currentSelectedOrderId = null;
let cachedOrders = [];

document.addEventListener('DOMContentLoaded', () => {
  checkAdminAuth();
  setupEventListeners();
  loadDashboardData();
});

// Verify JWT token in localStorage
function checkAdminAuth() {
  const token = localStorage.getItem('adminToken');
  const adminName = localStorage.getItem('adminName');

  if (!token) {
    window.location.href = '/admin/login.html';
    return;
  }

  currentAdminToken = token;
  const nameEl = document.getElementById('admin-profile-name');
  if (nameEl && adminName) {
    nameEl.textContent = adminName;
  }
}

// Setup table controls & search listeners
function setupEventListeners() {
  const searchInput = document.getElementById('admin-order-search');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadOrders(e.target.value.trim());
      }, 350);
    });
  }

  const dateFilter = document.getElementById('admin-date-filter');
  if (dateFilter) {
    dateFilter.addEventListener('change', () => {
      loadOrders();
    });
  }
}

// Fetch dashboard KPIs and initial orders
async function loadDashboardData() {
  await Promise.all([loadStats(), loadOrders()]);
}

// Fetch Admin KPI metrics
async function loadStats() {
  try {
    const res = await fetch('/api/admin/stats', {
      headers: {
        Authorization: `Bearer ${currentAdminToken}`
      }
    });

    if (res.status === 401) {
      handleAdminLogout();
      return;
    }

    const data = await res.json();
    if (data.success && data.stats) {
      const s = data.stats;
      document.getElementById('stat-today-orders').textContent = s.todayOrders || 0;
      document.getElementById('stat-pending-orders').textContent = s.pendingOrders || 0;
      document.getElementById('stat-processing-orders').textContent = s.processingOrders || 0;
      document.getElementById('stat-ready-orders').textContent = s.readyOrders || 0;
      document.getElementById('stat-completed-orders').textContent = s.completedOrders || 0;
      document.getElementById('stat-today-revenue').textContent = `₹${s.todayRevenue || 0}`;
      document.getElementById('stat-total-revenue').textContent = `₹${s.totalRevenue || 0}`;
    }
  } catch (err) {
    console.error('Failed to load admin stats:', err);
  }
}

// Fetch & render orders table with filters
async function loadOrders(searchQuery = '') {
  const tbody = document.getElementById('admin-orders-tbody');
  if (!tbody) return;

  const activeTab = document.querySelector('.admin-status-tab.active')?.dataset.status || 'All';
  const dateFilter = document.getElementById('admin-date-filter')?.value || '';

  let url = `/api/admin/orders?limit=50&status=${encodeURIComponent(activeTab)}`;
  if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
  if (dateFilter) url += `&date=${encodeURIComponent(dateFilter)}`;

  try {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Loading orders...</td></tr>`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${currentAdminToken}`
      }
    });

    if (res.status === 401) {
      handleAdminLogout();
      return;
    }

    const data = await res.json();

    if (!data.success || !data.orders || data.orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No orders found matching criteria.</td></tr>`;
      return;
    }

    cachedOrders = data.orders;
    tbody.innerHTML = '';

    data.orders.forEach((order) => {
      const row = document.createElement('tr');
      const itemsCount = order.items.reduce((acc, it) => acc + it.quantity, 0);
      const custPhone = order.customerSnapshot?.phone || 'N/A';
      const custWa = order.customerSnapshot?.whatsappNumber || custPhone;
      
      const cleanWa = custWa.replace(/\D/g, '');
      const waLink = `https://wa.me/${cleanWa.length === 10 ? '91' + cleanWa : cleanWa}?text=${encodeURIComponent(`Hello ${order.customerSnapshot?.name}, this is regarding your Laundry Order #${order.orderId}.`)}`;

      const statusBadgeClass = `badge-status badge-${order.status.toLowerCase().replace(/\s+/g, '')}`;

      row.innerHTML = `
        <td class="fw-bold text-primary">${order.orderId}</td>
        <td>
          <div class="fw-bold">${order.customerSnapshot?.name || 'Customer'}</div>
          <div class="small text-muted">${order.customerSnapshot?.city || 'Mumbai'}</div>
        </td>
        <td>
          <a href="tel:${custPhone}" class="text-dark d-block small">${custPhone}</a>
          <a href="${waLink}" target="_blank" class="btn btn-sm btn-whatsapp mt-1 py-0 px-2" style="font-size: 0.75rem;">
            <i class="bi bi-whatsapp"></i> Chat
          </a>
        </td>
        <td>
          <span class="badge bg-light text-dark border">${itemsCount} pcs</span>
          <div class="small text-muted text-truncate" style="max-width: 140px;">
            ${order.items.map(i => `${i.item} × ${i.quantity}`).join(', ')}
          </div>
        </td>
        <td>
          <div class="small fw-bold">${order.pickupDate}</div>
          <div class="small text-muted">${order.pickupTimeSlot}</div>
        </td>
        <td>
          <span class="badge ${order.deliveryPreference === 'Express' ? 'bg-warning text-dark' : 'bg-secondary text-white'}">
            ${order.deliveryPreference}
          </span>
        </td>
        <td class="fw-bold text-dark">₹${order.totalAmount}</td>
        <td>
          <span class="${statusBadgeClass}">${order.status}</span>
        </td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" onclick="viewOrderModal('${order._id}')" title="View Full Details">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-outline-success" onclick="openStatusModal('${order._id}', '${order.status}')" title="Update Status">
              <i class="bi bi-pencil-square"></i>
            </button>
            <a href="/admin/order.html?id=${order._id}" target="_blank" class="btn btn-outline-secondary" title="Print Invoice">
              <i class="bi bi-printer"></i>
            </a>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Orders query failed:', err);
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">Failed to load orders.</td></tr>`;
  }
}

// Filter orders by status tabs
window.filterStatus = function (statusName, element) {
  document.querySelectorAll('.admin-status-tab').forEach((tab) => tab.classList.remove('active'));
  element.classList.add('active');
  loadOrders();
};

// View full order details modal
window.viewOrderModal = async function (id) {
  currentSelectedOrderId = id;
  const modalEl = document.getElementById('orderDetailsModal');
  if (!modalEl) return;

  try {
    const res = await fetch(`/api/admin/orders/${id}`, {
      headers: { Authorization: `Bearer ${currentAdminToken}` }
    });
    const data = await res.json();
    if (!data.success) return;

    const order = data.order;
    const cust = order.customerSnapshot;

    document.getElementById('modal-order-id').textContent = order.orderId;
    document.getElementById('modal-customer-name').textContent = cust.name;
    document.getElementById('modal-customer-phone').textContent = cust.phone;
    document.getElementById('modal-customer-whatsapp').textContent = cust.whatsappNumber;
    document.getElementById('modal-customer-email').textContent = cust.email || 'N/A';
    document.getElementById('modal-customer-address').textContent = `${cust.address}, ${cust.area || ''}, ${cust.city} - ${cust.pincode}`;

    document.getElementById('modal-pickup-slot').textContent = `${order.pickupDate} (${order.pickupTimeSlot})`;
    document.getElementById('modal-delivery-slot').textContent = `${order.deliveryDate || 'Standard'} (${order.deliveryPreference})`;
    document.getElementById('modal-instructions').textContent = order.additionalInstructions || 'None provided';
    document.getElementById('modal-status-badge').textContent = order.status;
    document.getElementById('modal-status-badge').className = `badge-status badge-${order.status.toLowerCase().replace(/\s+/g, '')}`;

    // Direct WhatsApp Link
    const waBtn = document.getElementById('modal-wa-customer-btn');
    if (waBtn && data.directCustomerWhatsAppUrl) {
      waBtn.href = data.directCustomerWhatsAppUrl;
    }

    // Items list
    const itemsTbody = document.getElementById('modal-items-tbody');
    itemsTbody.innerHTML = '';
    order.items.forEach((item) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${item.item}</strong></td>
        <td>${item.service}</td>
        <td class="text-center">${item.quantity}</td>
        <td class="text-end">₹${item.unitPrice}</td>
        <td class="text-end fw-bold">₹${item.itemTotal}</td>
      `;
      itemsTbody.appendChild(tr);
    });

    document.getElementById('modal-subtotal').textContent = `₹${order.subtotal}`;
    document.getElementById('modal-delivery-charge').textContent = order.deliveryCharge === 0 ? 'FREE' : `₹${order.deliveryCharge}`;
    document.getElementById('modal-express-charge').textContent = `₹${order.expressCharge || 0}`;
    document.getElementById('modal-discount').textContent = `-₹${order.discount || 0}`;
    document.getElementById('modal-grand-total').textContent = `₹${order.totalAmount}`;

    // Show modal using Bootstrap modal API
    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();
  } catch (err) {
    alert('Failed to load order details.');
  }
};

// Open Status Update Modal
window.openStatusModal = function (id, currentStatus) {
  currentSelectedOrderId = id;
  const selectEl = document.getElementById('status-update-select');
  if (selectEl) selectEl.value = currentStatus;

  const modalEl = document.getElementById('statusUpdateModal');
  if (modalEl) {
    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();
  }
};

// Save updated status to server
window.submitStatusUpdate = async function () {
  if (!currentSelectedOrderId) return;

  const newStatus = document.getElementById('status-update-select')?.value;
  const note = document.getElementById('status-update-note')?.value.trim();
  const sendWa = document.getElementById('status-update-send-wa')?.checked ?? true;

  try {
    const res = await fetch(`/api/admin/orders/${currentSelectedOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentAdminToken}`
      },
      body: JSON.stringify({
        status: newStatus,
        note,
        sendCustomerWhatsApp: sendWa
      })
    });

    const data = await res.json();
    if (!data.success) {
      alert(data.message || 'Failed to update order status.');
      return;
    }

    // Close modal
    const modalEl = document.getElementById('statusUpdateModal');
    if (modalEl) {
      const bsModal = bootstrap.Modal.getInstance(modalEl);
      if (bsModal) bsModal.hide();
    }

    // Reload orders and stats
    await loadDashboardData();
    alert(`Order status updated to "${newStatus}"!`);
  } catch (err) {
    alert('Network error while updating status.');
  }
};

// Admin Logout
window.handleAdminLogout = function () {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminName');
  localStorage.removeItem('adminEmail');
  window.location.href = '/admin/login.html';
};
