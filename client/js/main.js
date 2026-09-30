/**
 * Main Frontend Script for Laundry Service Landing Page
 */

document.addEventListener('DOMContentLoaded', () => {
  loadServices();
  setupEstimator();
});

// Fetch and display laundry services dynamically from backend
async function loadServices() {
  const container = document.getElementById('services-grid');
  if (!container) return;

  try {
    const res = await fetch('/api/services');
    const data = await res.json();

    if (data.success && data.services) {
      container.innerHTML = '';
      data.services.forEach((service) => {
        const col = document.createElement('div');
        col.className = 'col-lg-4 col-md-6';
        col.innerHTML = `
          <div class="service-card">
            <div class="d-flex justify-content-between align-items-start mb-3">
              <div class="service-icon-box">
                <i class="bi ${service.icon || 'bi-droplet'}"></i>
              </div>
              <span class="badge bg-light text-primary border px-3 py-2 rounded-pill font-weight-bold">
                ${service.badge || 'Popular'}
              </span>
            </div>
            <h4 class="h5 mb-2">${service.name}</h4>
            <p class="text-muted small mb-4">${service.description}</p>
            <div class="service-price-tag d-flex justify-content-between align-items-center">
              <div>
                <span class="text-muted small fw-normal d-block">Turnaround</span>
                <span class="text-dark small fw-bold"><i class="bi bi-clock me-1"></i>${service.estimatedHours || 24}h</span>
              </div>
              <a href="/booking.html?service=${encodeURIComponent(service.name)}" class="btn btn-sm btn-primary-custom">
                Book Now <i class="bi bi-arrow-right"></i>
              </a>
            </div>
          </div>
        `;
        container.appendChild(col);
      });
    }
  } catch (error) {
    console.warn('Could not fetch services from API, using static fallbacks.');
  }
}

// Quick price estimator in landing page
function setupEstimator() {
  const shirtQty = document.getElementById('est-shirts');
  const pantQty = document.getElementById('est-pants');
  const serviceSelect = document.getElementById('est-service');
  const estTotal = document.getElementById('est-total');

  if (!shirtQty || !pantQty || !serviceSelect || !estTotal) return;

  function recalculate() {
    const shirts = parseInt(shirtQty.value, 10) || 0;
    const pants = parseInt(pantQty.value, 10) || 0;
    const svc = serviceSelect.value;

    let shirtRate = 35;
    let pantRate = 40;

    if (svc === 'washing') {
      shirtRate = 25; pantRate = 30;
    } else if (svc === 'dry_cleaning') {
      shirtRate = 75; pantRate = 85;
    } else if (svc === 'ironing') {
      shirtRate = 15; pantRate = 20;
    }

    const total = (shirts * shirtRate) + (pants * pantRate) + 50;
    estTotal.textContent = `₹${total}`;
  }

  shirtQty.addEventListener('input', recalculate);
  pantQty.addEventListener('input', recalculate);
  serviceSelect.addEventListener('change', recalculate);
  recalculate();
}
