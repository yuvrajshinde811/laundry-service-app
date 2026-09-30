/**
 * Utility to generate unique, business-friendly Order IDs
 * Format: LAUNDRY-YYYYMMDD-XXXXX
 * Example: LAUNDRY-20260821-00125
 */

function generateOrderId(customSequence = null) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePart = `${year}${month}${day}`;

  let sequencePart;
  if (customSequence !== null && !isNaN(customSequence)) {
    sequencePart = String(customSequence).padStart(5, '0');
  } else {
    // Generate a secure 5-digit number between 10000 and 99999
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    sequencePart = String(randomNum);
  }

  return `LAUNDRY-${datePart}-${sequencePart}`;
}

module.exports = {
  generateOrderId
};
