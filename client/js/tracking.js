/**
 * Real-Time Order Tracking Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('tracking-search-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleTrackingLookup();
    });
  }

  // Auto-search if parameters are present in URL
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('orderId');
  const phone = urlParams.get('phone');

  if (orderId && phone) {
    const orderInput = document.getElementById('track-order-id');
    const phoneInput = document.getElementById('track-phone');
    if (orderInput && phoneInput) {
      orderInput.value = orderId;
      phoneInput.value = phone;
      handleTrackingLookup();
    }
  }
});

async function handleTrackingLookup() {
  const orderId = document.getElementById('track-order-id')?.value.trim();
  const phone = document.getElementById('track-phone')?.value.trim();
  const errorBox = document.getElementById('tracking-error-alert');
  const resultsContainer = document.getElementById('tracking-results-container');
  const submitBtn = document.getElementById('btn-track-submit');

  if (!orderId || !phone) {
    if (errorBox) {
      errorBox.textContent = 'Please enter both your Order ID and registered Mobile Number.';
      errorBox.classList.remove('d-none');
    }
    return;
  }

  if (errorBox) errorBox.classList.add('d-none');
  if (resultsContainer) resultsContainer.classList.add('d-none');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Searching...`;
  }

  try {
    const res = await fetch('/api/orders/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ orderId, phone })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Could not retrieve tracking details.');
    }

    renderTrackingView(data);
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message || 'Order not found. Please verify your details and try again.';
      errorBox.classList.remove('d-none');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="bi bi-search me-1"></i> Track Order`;
    }
  }
}

function renderTrackingView(data) {
  const container = document.getElementById('tracking-results-container');
  if (!container) return;

  const order = data.order;
  const progress = data.trackingProgress;

  // Basic Details
  document.getElementById('track-res-order-id').textContent = order.orderId;
  document.getElementById('track-res-status-badge').textContent = order.status;
  document.getElementById('track-res-status-badge').className = `badge-status badge-${order.status.toLowerCase().replace(/\s+/g, '')}`;
  document.getElementById('track-res-customer').textContent = order.customerName;
  document.getElementById('track-res-pickup').textContent = `${order.pickupDate} (${order.pickupTimeSlot})`;
  document.getElementById('track-res-delivery').textContent = `${order.deliveryDate || 'Est. 24-48h'} (${order.deliveryPreference})`;
  document.getElementById('track-res-total').textContent = `₹${order.totalAmount}`;

  // Support WhatsApp Link
  const waSupportBtn = document.getElementById('track-support-whatsapp');
  if (waSupportBtn) {
    const msg = encodeURIComponent(`Hi, I need support with my Laundry Order #${order.orderId}`);
    waSupportBtn.href = `https://wa.me/918080082714?text=${msg}`;
  }

  // Render Timeline
  const timelineContainer = document.getElementById('track-timeline-list');
  if (timelineContainer) {
    timelineContainer.innerHTML = '';

    if (progress.isCancelled) {
      timelineContainer.innerHTML = `
        <div class="alert alert-danger d-flex align-items-center">
          <i class="bi bi-x-circle-fill fs-3 me-3"></i>
          <div>
            <h6 class="mb-1 fw-bold">Order Cancelled</h6>
            <p class="mb-0 small">This laundry booking has been cancelled. For refunds or assistance, please contact our support.</p>
          </div>
        </div>
      `;
    } else {
      progress.stages.forEach((stage, idx) => {
        const isCompleted = idx < progress.currentIndex;
        const isActive = idx === progress.currentIndex;
        const stateClass = isCompleted ? 'completed' : (isActive ? 'active' : '');

        const itemEl = document.createElement('div');
        itemEl.className = `timeline-step-item ${stateClass}`;
        itemEl.innerHTML = `
          <div class="timeline-icon">
            <i class="bi ${isCompleted ? 'bi-check-lg' : stage.icon}"></i>
          </div>
          <div class="timeline-content">
            <div class="timeline-title ${isActive ? 'text-primary' : ''}">${stage.label}</div>
            <div class="timeline-desc">
              ${isActive ? '<span class="badge bg-primary text-white">Current Stage</span>' : (isCompleted ? '<span class="text-success small">Completed</span>' : '<span class="text-muted small">Upcoming</span>')}
            </div>
          </div>
        `;
        timelineContainer.appendChild(itemEl);
      });
    }
  }

  // Render Items Summary Table
  const itemsContainer = document.getElementById('track-items-tbody');
  if (itemsContainer && order.items) {
    itemsContainer.innerHTML = '';
    order.items.forEach((item) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${item.item}</strong></td>
        <td>${item.service}</td>
        <td class="text-center">${item.quantity}</td>
        <td class="text-end fw-bold">₹${item.itemTotal}</td>
      `;
      itemsContainer.appendChild(row);
    });
  }

  container.classList.remove('d-none');
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
