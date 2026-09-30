const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    code: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    description: {
      type: String,
      required: true
    },
    icon: {
      type: String,
      default: 'bi-droplet-half'
    },
    badge: {
      type: String,
      default: 'Popular'
    },
    basePriceMultiplier: {
      type: Number,
      default: 1.0
    },
    estimatedHours: {
      type: Number,
      default: 24
    },
    isActive: {
      type: Boolean,
      default: true
    },
    displayOrder: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

const laundryItemCatalogSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    category: {
      type: String,
      enum: ['Daily Wear', 'Formal Wear', 'Household & Bedding', 'Traditional & Delicate', 'Other'],
      default: 'Daily Wear'
    },
    icon: {
      type: String,
      default: 'bi-tag'
    },
    // Base unit price per piece for default service (Washing + Ironing)
    basePrice: {
      type: Number,
      required: true,
      min: 0
    },
    // Service-specific pricing overrides
    servicePrices: {
      washing: { type: Number, default: 0 },
      washing_ironing: { type: Number, default: 0 },
      dry_cleaning: { type: Number, default: 0 },
      ironing: { type: Number, default: 0 }
    },
    unit: {
      type: String,
      default: 'piece'
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

const Service = mongoose.model('Service', serviceSchema);
const LaundryItem = mongoose.model('LaundryItem', laundryItemCatalogSchema);

module.exports = {
  Service,
  LaundryItem
};
