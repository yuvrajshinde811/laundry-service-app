const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    phone: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
      match: [/^[0-9+ -]{10,15}$/, 'Please provide a valid 10-digit mobile number']
    },
    whatsappNumber: {
      type: String,
      required: [true, 'WhatsApp number is required'],
      trim: true,
      match: [/^[0-9+ -]{10,15}$/, 'Please provide a valid 10-digit WhatsApp number']
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    address: {
      type: String,
      required: [true, 'Complete pickup address is required'],
      trim: true
    },
    area: {
      type: String,
      trim: true,
      default: ''
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      default: 'Mumbai'
    },
    pincode: {
      type: String,
      required: [true, 'Pincode is required'],
      trim: true,
      match: [/^[0-9]{6}$/, 'Please provide a valid 6-digit pincode']
    }
  },
  {
    timestamps: true
  }
);

// Helpful compound index for lookups
customerSchema.index({ phone: 1 });
customerSchema.index({ whatsappNumber: 1 });

module.exports = mongoose.model('Customer', customerSchema);
