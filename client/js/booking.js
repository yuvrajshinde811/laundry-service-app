/**
 * Multi-Step Laundry Booking Wizard Logic
 */

// State Object
const bookingState = {
  currentStep: 1,
  customer: {
    name: '',
    phone: '',
    whatsappNumber: '',
    email: '',
    address: '',
    area: '',
    city: 'Mumbai',
    pincode: ''
  },
  items: {
    'Shirt': { qty: 0, category: 'Daily Wear', icon: 'bi-tag' },
    'T-Shirt': { qty: 0, category: 'Daily Wear', icon: 'bi-tag' },
    'Pants': { qty: 0, category: 'Formal Wear', icon: 'bi-tag' },
    'Jeans': { qty: 0, category: 'Daily Wear', icon: 'bi-tag' },
    'Saree': { qty: 0, category: 'Traditional & Delicate', icon: 'bi-tag' },
    'Bedsheet': { qty: 0, category: 'Household & Bedding', icon: 'bi-layers' },
    'Blanket': { qty: 0, category: 'Household & Bedding', icon: 'bi-box-seam' },
    'Suit (2 Pcs)': { qty: 0, category: 'Formal Wear', icon: 'bi-briefcase' },
    'Kurta': { qty: 0, category: 'Traditional & Delicate', icon: 'bi-tag' },
    'Other': { qty: 0, category: 'Other', icon: 'bi-asterisk' }
  },
  itemServices: {}, // per-item service mapping
  globalService: 'Washing + Ironing',
  pickupDate: '',
  pickupTimeSlot: '10:00 AM – 12:00 PM',
  deliveryPreference: 'Standard',
  additionalInstructions: '',
  couponCode: '',
  discountAmount: 0,
  pricingCatalog: {
    'Shirt': { basePrice: 35, washing: 25, washing_ironing: 35, dry_cleaning: 75, ironing: 15 },
    'T-Shirt': { basePrice: 30, washing: 20, washing_ironing: 30, dry_cleaning: 60, ironing: 15 },
    'Pants': { basePrice: 40, washing: 30, washing_ironing: 40, dry_cleaning: 85, ironing: 20 },
    'Jeans': { basePrice: 45, washing: 35, washing_ironing: 45, dry_cleaning: 95, ironing: 25 },
    'Saree': { basePrice: 90, washing: 60, washing_ironing: 90, dry_cleaning: 160, ironing: 40 },
    'Bedsheet': { basePrice: 90, washing: 60, washing_ironing: 90, dry_cleaning: 130, ironing: 40 },
    'Blanket': { basePrice: 180, washing: 140, washing_ironing: 180, dry_cleaning: 250, ironing: 50 },
    'Suit (2 Pcs)': { basePrice: 160, washing: 100, washing_ironing: 160, dry_cleaning: 280, ironing: 70 },
    'Kurta': { basePrice: 50, washing: 35, washing_ironing: 50, dry_cleaning: 110, ironing: 25 },
    'Other': { basePrice: 45, washing: 30, washing_ironing: 45, dry_cleaning: 85, ironing: 20 }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  initBookingWizard();
  setDefaultPickupDate();
  fetchCatalog();
});

// Initialize form listeners and controls
function initBookingWizard() {
  renderItemsList();
  updateCalculationUI();

  // Same as phone checkbox
  const samePhoneCheckbox = document.getElementById('same-as-phone');
  if (samePhoneCheckbox) {
    samePhoneCheckbox.addEventListener('change', (e) => {
      const phoneInput = document.getElementById('cust-phone');
      const waInput = document.getElementById('cust-whatsapp');
      if (e.target.checked && phoneInput && waInput) {
        waInput.value = phoneInput.value;
      }
    });
  }

  // Preselect service if passed in URL query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const svcParam = urlParams.get('service');
  if (svcParam) {
    bookingState.globalService = svcParam;
    const globalSvcSelect = document.getElementById('global-service-select');
    if (globalSvcSelect) globalSvcSelect.value = svcParam;
  }
}

// Fetch backend catalog if available
async function fetchCatalog() {
  try {
    const res = await fetch('/api/services');
    const data = await res.json();
    if (data.success && data.pricingCatalog) {
      bookingState.pricingCatalog = data.pricingCatalog;
      renderItemsList();
      updateCalculationUI();
    }
  } catch (err) {
    console.log('Using default pricing catalog');
  }
}

// Set default pickup date to today or tomorrow
function setDefaultPickupDate() {
  const pickupInput = document.getElementById('pickup-date');
  if (pickupInput) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    pickupInput.min = todayStr;
    pickupInput.value = todayStr;
    bookingState.pickupDate = todayStr;
  }
}

// Render dynamic laundry items list with +/- counters
function renderItemsList() {
  const container = document.getElementById('laundry-items-container');
  if (!container) return;

  container.innerHTML = '';

  Object.keys(bookingState.items).forEach((itemName) => {
    const itemData = bookingState.items[itemName];
    const catalog = bookingState.pricingCatalog[itemName] || { basePrice: 40 };

    const itemRow = document.createElement('div');
    itemRow.className = 'item-selection-card';
    itemRow.innerHTML = `
      <div class="d-flex align-items-center gap-3">
        <div class="p-2 bg-light rounded text-primary fs-5">
          <i class="bi ${itemData.icon}"></i>
        </div>
        <div>
          <h6 class="mb-0 fw-bold">${itemName}</h6>
          <span class="text-muted small">₹${catalog.basePrice || 35} / piece</span>
        </div>
      </div>
      <div class="quantity-stepper">
        <button type="button" class="stepper-btn" onclick="updateItemQuantity('${itemName}', -1)">-</button>
        <span class="stepper-value" id="qty-${itemName.replace(/\s+/g, '-')}">${itemData.qty}</span>
        <button type="button" class="stepper-btn" onclick="updateItemQuantity('${itemName}', 1)">+</button>
      </div>
    `;
    container.appendChild(itemRow);
  });
}

// Update quantity for an item
window.updateItemQuantity = function (itemName, delta) {
  if (bookingState.items[itemName]) {
    const newQty = Math.max(0, bookingState.items[itemName].qty + delta);
    bookingState.items[itemName].qty = newQty;
    
    const qtyElement = document.getElementById(`qty-${itemName.replace(/\s+/g, '-')}`);
    if (qtyElement) qtyElement.textContent = newQty;

    updateCalculationUI();
    renderServiceSelectionTable();
  }
};

// Render step 3 service customization table for selected items
function renderServiceSelectionTable() {
  const container = document.getElementById('service-item-customization-tbody');
  if (!container) return;

  container.innerHTML = '';
  const selectedItems = Object.entries(bookingState.items).filter(([_, data]) => data.qty > 0);

  if (selectedItems.length === 0) {
    container.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">No items selected. Please go back to Step 2.</td></tr>`;
    return;
  }

  selectedItems.forEach(([name, data]) => {
    const currentService = bookingState.itemServices[name] || bookingState.globalService;
    const unitRate = getItemPrice(name, currentService);
    const itemTotal = unitRate * data.qty;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="fw-bold">${name}</td>
      <td class="text-center">${data.qty}</td>
      <td>
        <select class="form-select form-select-sm" onchange="changeItemService('${name}', this.value)">
          <option value="Washing" ${currentService === 'Washing' ? 'selected' : ''}>Washing (₹${getItemPrice(name, 'Washing')})</option>
          <option value="Washing + Ironing" ${currentService === 'Washing + Ironing' ? 'selected' : ''}>Washing + Ironing (₹${getItemPrice(name, 'Washing + Ironing')})</option>
          <option value="Dry Cleaning" ${currentService === 'Dry Cleaning' ? 'selected' : ''}>Dry Cleaning (₹${getItemPrice(name, 'Dry Cleaning')})</option>
          <option value="Ironing" ${currentService === 'Ironing' ? 'selected' : ''}>Ironing Only (₹${getItemPrice(name, 'Ironing')})</option>
        </select>
      </td>
      <td class="text-end fw-bold text-primary">₹${itemTotal}</td>
    `;
    container.appendChild(tr);
  });
}

// Change service for a specific item
window.changeItemService = function (itemName, serviceName) {
  bookingState.itemServices[itemName] = serviceName;
  renderServiceSelectionTable();
  updateCalculationUI();
};

// Change global service for all items
window.applyGlobalService = function (serviceName) {
  bookingState.globalService = serviceName;
  Object.keys(bookingState.items).forEach((name) => {
    bookingState.itemServices[name] = serviceName;
  });
  renderServiceSelectionTable();
  updateCalculationUI();
};

// Calculate item price based on service
function getItemPrice(itemName, serviceName) {
  const cat = bookingState.pricingCatalog[itemName] || { basePrice: 40 };
  const s = (serviceName || 'Washing + Ironing').toLowerCase();

  if (s.includes('dry')) return cat.dry_cleaning || 80;
  if (s.includes('iron') && !s.includes('wash')) return cat.ironing || 20;
  if (s.includes('wash') && !s.includes('iron')) return cat.washing || 30;
  return cat.washing_ironing || cat.basePrice || 40;
}

// Calculate order financials
function calculateTotals() {
  let subtotal = 0;
  let totalPieces = 0;

  Object.entries(bookingState.items).forEach(([name, data]) => {
    if (data.qty > 0) {
      const svc = bookingState.itemServices[name] || bookingState.globalService;
      const rate = getItemPrice(name, svc);
      subtotal += rate * data.qty;
      totalPieces += data.qty;
    }
  });

  const deliveryCharge = (subtotal >= 500 || subtotal === 0) ? 0 : 50;
  const expressCharge = bookingState.deliveryPreference === 'Express' ? 100 : 0;
  const discount = bookingState.discountAmount || 0;
  const grandTotal = Math.max(0, subtotal + deliveryCharge + expressCharge - discount);

  return {
    totalPieces,
    subtotal,
    deliveryCharge,
    expressCharge,
    discount,
    grandTotal
  };
}

// Update all financial summary elements in UI
function updateCalculationUI() {
  const { totalPieces, subtotal, deliveryCharge, expressCharge, discount, grandTotal } = calculateTotals();

  // Summary widgets
  const els = {
    pieces: document.querySelectorAll('.summary-pieces-val'),
    subtotal: document.querySelectorAll('.summary-subtotal-val'),
    delivery: document.querySelectorAll('.summary-delivery-val'),
    express: document.querySelectorAll('.summary-express-val'),
    discount: document.querySelectorAll('.summary-discount-val'),
    grandTotal: document.querySelectorAll('.summary-grandtotal-val')
  };

  els.pieces.forEach((el) => (el.textContent = totalPieces));
  els.subtotal.forEach((el) => (el.textContent = `₹${subtotal}`));
  els.delivery.forEach((el) => (el.textContent = deliveryCharge === 0 ? 'FREE' : `₹${deliveryCharge}`));
  els.express.forEach((el) => (el.textContent = expressCharge > 0 ? `₹${expressCharge}` : '₹0'));
  els.discount.forEach((el) => (el.textContent = discount > 0 ? `-₹${discount}` : '₹0'));
  els.grandTotal.forEach((el) => (el.textContent = `₹${grandTotal}`));

  // Toggle delivery note
  const freeDeliveryNote = document.getElementById('free-delivery-qualify-note');
  if (freeDeliveryNote) {
    if (subtotal >= 500) {
      freeDeliveryNote.innerHTML = `<span class="text-success"><i class="bi bi-check-circle-fill me-1"></i>🎉 You have unlocked <strong>FREE Delivery</strong>!</span>`;
    } else if (subtotal > 0) {
      freeDeliveryNote.innerHTML = `<span class="text-muted small"><i class="bi bi-info-circle me-1"></i>Add <strong>₹${500 - subtotal}</strong> more for FREE delivery!</span>`;
    } else {
      freeDeliveryNote.innerHTML = '';
    }
  }
}

// Apply promo coupon code
window.applyCoupon = function () {
  const input = document.getElementById('coupon-input');
  const alertEl = document.getElementById('coupon-alert');
  if (!input || !alertEl) return;

  const code = input.value.trim().toUpperCase();
  const { subtotal } = calculateTotals();

  if (code === 'FRESH10') {
    bookingState.couponCode = code;
    bookingState.discountAmount = Math.round(subtotal * 0.1);
    alertEl.className = 'alert alert-success py-2 px-3 small mt-2';
    alertEl.innerHTML = `Coupon <strong>FRESH10</strong> applied! 10% discount saved.`;
    alertEl.classList.remove('d-none');
  } else if (code === 'WELCOME50') {
    bookingState.couponCode = code;
    bookingState.discountAmount = Math.min(50, subtotal);
    alertEl.className = 'alert alert-success py-2 px-3 small mt-2';
    alertEl.innerHTML = `Coupon <strong>WELCOME50</strong> applied! Flat ₹50 saved.`;
    alertEl.classList.remove('d-none');
  } else {
    bookingState.couponCode = '';
    bookingState.discountAmount = 0;
    alertEl.className = 'alert alert-danger py-2 px-3 small mt-2';
    alertEl.textContent = 'Invalid promo coupon code. Try FRESH10 or WELCOME50.';
    alertEl.classList.remove('d-none');
  }

  updateCalculationUI();
};

// Set delivery preference (Standard vs Express)
window.setDeliveryPreference = function (preference) {
  bookingState.deliveryPreference = preference;
  const stdCard = document.getElementById('delivery-opt-standard');
  const expCard = document.getElementById('delivery-opt-express');

  if (preference === 'Express') {
    if (expCard) expCard.classList.add('border-primary', 'bg-light');
    if (stdCard) stdCard.classList.remove('border-primary', 'bg-light');
  } else {
    if (stdCard) stdCard.classList.add('border-primary', 'bg-light');
    if (expCard) expCard.classList.remove('border-primary', 'bg-light');
  }

  updateCalculationUI();
};

// Multi-Step Navigation Handlers
window.goToStep = function (stepNumber) {
  // Validate before moving forward
  if (stepNumber > bookingState.currentStep) {
    if (!validateCurrentStep(bookingState.currentStep)) {
      return;
    }
  }

  // Update State
  bookingState.currentStep = stepNumber;

  // Update Step Panels
  for (let i = 1; i <= 5; i++) {
    const panel = document.getElementById(`step-panel-${i}`);
    const node = document.getElementById(`step-node-${i}`);
    
    if (panel) {
      if (i === stepNumber) {
        panel.classList.remove('d-none');
      } else {
        panel.classList.add('d-none');
      }
    }

    if (node) {
      node.classList.remove('active', 'completed');
      if (i === stepNumber) {
        node.classList.add('active');
      } else if (i < stepNumber) {
        node.classList.add('completed');
      }
    }
  }

  // Prepare specific step views
  if (stepNumber === 3) {
    renderServiceSelectionTable();
  } else if (stepNumber === 5) {
    renderReviewSummary();
  }

  window.scrollTo({ top: 120, behavior: 'smooth' });
};

// Validate individual step inputs
function validateCurrentStep(step) {
  hideStepError();

  if (step === 1) {
    const name = document.getElementById('cust-name')?.value.trim();
    const phone = document.getElementById('cust-phone')?.value.trim();
    const wa = document.getElementById('cust-whatsapp')?.value.trim();
    const address = document.getElementById('cust-address')?.value.trim();
    const city = document.getElementById('cust-city')?.value.trim();
    const pincode = document.getElementById('cust-pincode')?.value.trim();
    const email = document.getElementById('cust-email')?.value.trim();
    const area = document.getElementById('cust-area')?.value.trim();

    if (!name) {
      showStepError('Please enter your full name.');
      return false;
    }
    if (!phone || !/^[0-9+ -]{10,15}$/.test(phone)) {
      showStepError('Please enter a valid 10-digit mobile number.');
      return false;
    }
    if (!wa || !/^[0-9+ -]{10,15}$/.test(wa)) {
      showStepError('Please enter a valid WhatsApp number for order notifications.');
      return false;
    }
    if (!address) {
      showStepError('Please enter your complete pickup address.');
      return false;
    }
    if (!city) {
      showStepError('Please enter your city.');
      return false;
    }
    if (!pincode || !/^[0-9]{6}$/.test(pincode)) {
      showStepError('Please enter a valid 6-digit postal pincode.');
      return false;
    }

    // Save to state
    bookingState.customer = { name, phone, whatsappNumber: wa, email, address, area, city, pincode };
    return true;
  }

  if (step === 2) {
    const { totalPieces } = calculateTotals();
    if (totalPieces === 0) {
      showStepError('Please select at least 1 laundry item to proceed.');
      return false;
    }
    const instructions = document.getElementById('special-instructions')?.value.trim();
    bookingState.additionalInstructions = instructions || '';
    return true;
  }

  if (step === 4) {
    const pickupDate = document.getElementById('pickup-date')?.value;
    const timeSlot = document.getElementById('pickup-slot')?.value;

    if (!pickupDate) {
      showStepError('Please select a pickup date.');
      return false;
    }
    if (!timeSlot) {
      showStepError('Please select a pickup time slot.');
      return false;
    }

    bookingState.pickupDate = pickupDate;
    bookingState.pickupTimeSlot = timeSlot;
    return true;
  }

  return true;
}

function showStepError(msg) {
  const errBox = document.getElementById('step-error-alert');
  if (errBox) {
    errBox.textContent = msg;
    errBox.classList.remove('d-none');
  } else {
    alert(msg);
  }
}

function hideStepError() {
  const errBox = document.getElementById('step-error-alert');
  if (errBox) errBox.classList.add('d-none');
}

// Render Review Summary on Step 5
function renderReviewSummary() {
  const container = document.getElementById('review-summary-content');
  if (!container) return;

  const { totalPieces, subtotal, deliveryCharge, expressCharge, discount, grandTotal } = calculateTotals();
  const cust = bookingState.customer;

  const itemsHtml = Object.entries(bookingState.items)
    .filter(([_, d]) => d.qty > 0)
    .map(([name, d]) => {
      const svc = bookingState.itemServices[name] || bookingState.globalService;
      const rate = getItemPrice(name, svc);
      return `<li class="d-flex justify-content-between py-1 border-bottom border-light">
        <span><strong>${name}</strong> × ${d.qty} <span class="text-muted small">(${svc})</span></span>
        <span class="fw-bold">₹${rate * d.qty}</span>
      </li>`;
    })
    .join('');

  container.innerHTML = `
    <div class="row g-4">
      <div class="col-md-6">
        <div class="p-3 bg-light rounded h-100 border">
          <h6 class="fw-bold text-primary mb-3"><i class="bi bi-person-circle me-2"></i>Customer Information</h6>
          <p class="mb-1"><strong>Name:</strong> ${cust.name}</p>
          <p class="mb-1"><strong>Phone:</strong> ${cust.phone}</p>
          <p class="mb-1"><strong>WhatsApp:</strong> ${cust.whatsappNumber}</p>
          ${cust.email ? `<p class="mb-1"><strong>Email:</strong> ${cust.email}</p>` : ''}
          <p class="mb-0"><strong>Address:</strong> ${cust.address}, ${cust.area ? cust.area + ', ' : ''}${cust.city} - ${cust.pincode}</p>
        </div>
      </div>
      <div class="col-md-6">
        <div class="p-3 bg-light rounded h-100 border">
          <h6 class="fw-bold text-primary mb-3"><i class="bi bi-calendar-event me-2"></i>Pickup & Delivery Schedule</h6>
          <p class="mb-1"><strong>Pickup Date:</strong> ${bookingState.pickupDate}</p>
          <p class="mb-1"><strong>Pickup Slot:</strong> ${bookingState.pickupTimeSlot}</p>
          <p class="mb-1"><strong>Delivery Preference:</strong> <span class="badge ${bookingState.deliveryPreference === 'Express' ? 'bg-warning text-dark' : 'bg-info text-white'}">${bookingState.deliveryPreference} Delivery</span></p>
          <p class="mb-0"><strong>Special Note:</strong> ${bookingState.additionalInstructions || 'None provided'}</p>
        </div>
      </div>
      <div class="col-12">
        <div class="p-3 bg-light rounded border">
          <h6 class="fw-bold text-primary mb-3"><i class="bi bi-basket3 me-2"></i>Order Items (${totalPieces} items)</h6>
          <ul class="list-unstyled mb-3">
            ${itemsHtml}
          </ul>
          <div class="border-top pt-2">
            <div class="d-flex justify-content-between mb-1"><span>Subtotal:</span><span>₹${subtotal}</span></div>
            <div class="d-flex justify-content-between mb-1"><span>Pickup & Delivery:</span><span>${deliveryCharge === 0 ? 'FREE' : '₹' + deliveryCharge}</span></div>
            ${expressCharge > 0 ? `<div class="d-flex justify-content-between mb-1"><span>Express 24h Charge:</span><span>₹${expressCharge}</span></div>` : ''}
            ${discount > 0 ? `<div class="d-flex justify-content-between mb-1 text-success"><span>Discount:</span><span>-₹${discount}</span></div>` : ''}
            <div class="d-flex justify-content-between fs-5 fw-bold text-primary border-top pt-2 mt-2">
              <span>Grand Total:</span>
              <span>₹${grandTotal}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Submit Order to Backend API
window.confirmBookingOrder = async function () {
  const submitBtn = document.getElementById('btn-submit-booking');
  const btnSpinner = document.getElementById('btn-submit-spinner');
  const btnText = document.getElementById('btn-submit-text');

  if (submitBtn) submitBtn.disabled = true;
  if (btnSpinner) btnSpinner.classList.remove('d-none');
  if (btnText) btnText.textContent = 'Processing Booking...';

  hideStepError();

  const selectedItems = Object.entries(bookingState.items)
    .filter(([_, d]) => d.qty > 0)
    .map(([name, d]) => {
      const svc = bookingState.itemServices[name] || bookingState.globalService;
      const unitPrice = getItemPrice(name, svc);
      return {
        item: name,
        quantity: d.qty,
        service: svc,
        unitPrice,
        itemTotal: unitPrice * d.qty
      };
    });

  const payload = {
    name: bookingState.customer.name,
    phone: bookingState.customer.phone,
    whatsappNumber: bookingState.customer.whatsappNumber,
    email: bookingState.customer.email,
    address: bookingState.customer.address,
    area: bookingState.customer.area,
    city: bookingState.customer.city,
    pincode: bookingState.customer.pincode,
    items: selectedItems,
    pickupDate: bookingState.pickupDate,
    pickupTimeSlot: bookingState.pickupTimeSlot,
    deliveryPreference: bookingState.deliveryPreference,
    additionalInstructions: bookingState.additionalInstructions,
    couponCode: bookingState.couponCode
  };

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Booking submission failed.');
    }

    // Render Success Screen
    renderConfirmationScreen(data);
  } catch (err) {
    showStepError(err.message || 'Something went wrong while confirming your booking. Please try again.');
    if (submitBtn) submitBtn.disabled = false;
    if (btnSpinner) btnSpinner.classList.add('d-none');
    if (btnText) btnText.textContent = 'Confirm Laundry Booking';
  }
};

// Render Success Screen upon booking creation
function renderConfirmationScreen(data) {
  const wizardContainer = document.getElementById('booking-wizard-wrapper');
  const successContainer = document.getElementById('booking-success-wrapper');

  if (wizardContainer) wizardContainer.classList.add('d-none');
  if (successContainer) successContainer.classList.remove('d-none');

  const order = data.order;
  const orderId = data.orderId || order?.orderId;
  const chatUrl = data.whatsappStatus?.customerDirectChatUrl || `https://wa.me/918080082714?text=Hi,%20I%20just%20booked%20Order%20${orderId}`;

  // Populate Order ID & details
  document.getElementById('conf-order-id').textContent = orderId;
  document.getElementById('conf-customer-name').textContent = order?.customerSnapshot?.name || bookingState.customer.name;
  document.getElementById('conf-pickup-date').textContent = order?.pickupDate || bookingState.pickupDate;
  document.getElementById('conf-pickup-time').textContent = order?.pickupTimeSlot || bookingState.pickupTimeSlot;
  document.getElementById('conf-total-amount').textContent = `₹${order?.totalAmount || calculateTotals().grandTotal}`;
  document.getElementById('conf-status').textContent = order?.status || 'Booking Confirmed';

  // Setup dynamic links
  const trackBtn = document.getElementById('conf-track-btn');
  if (trackBtn) {
    trackBtn.href = `/tracking.html?orderId=${encodeURIComponent(orderId)}&phone=${encodeURIComponent(order?.customerSnapshot?.phone || bookingState.customer.phone)}`;
  }

  const waBtn = document.getElementById('conf-whatsapp-btn');
  if (waBtn) {
    waBtn.href = chatUrl;
  }

  window.scrollTo({ top: 50, behavior: 'smooth' });
}

// Copy Order ID utility
window.copyOrderId = function () {
  const orderId = document.getElementById('conf-order-id')?.textContent;
  if (orderId) {
    navigator.clipboard.writeText(orderId).then(() => {
      alert('Order ID copied to clipboard: ' + orderId);
    });
  }
};
