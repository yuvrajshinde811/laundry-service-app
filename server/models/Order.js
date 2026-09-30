const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  item: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  service: {
    type: String,
    required: true,
    default: 'Washing + Ironing'
  },
  unitPrice: {
    type: Number,
    required: true,
    default: 0
  },
  itemTotal: {
    type: Number,
    required: true,
    default: 0
  }
}, { _id: false });

const orderStatusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  note: {
    type: String,
    default: ''
  }
}, { _id: false });

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true
    },
    customerSnapshot: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      whatsappNumber: { type: String, required: true },
      email: { type: String, default: '' },
      address: { type: String, required: true },
      area: { type: String, default: '' },
      city: { type: String, default: 'Mumbai' },
      pincode: { type: String, required: true }
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: [
        (val) => Array.isArray(val) && val.length > 0,
        'Order must contain at least one laundry item'
      ]
    },
    pickupDate: {
      type: String,
      required: [true, 'Pickup date is required']
    },
    pickupTimeSlot: {
      type: String,
      required: [true, 'Pickup time slot is required']
    },
    deliveryDate: {
      type: String,
      default: ''
    },
    deliveryTimeSlot: {
      type: String,
      default: 'Same as pickup slot'
    },
    deliveryPreference: {
      type: String,
      enum: ['Standard', 'Express'],
      default: 'Standard'
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    deliveryCharge: {
      type: Number,
      required: true,
      default: 50
    },
    expressCharge: {
      type: Number,
      required: true,
      default: 0
    },
    discount: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    additionalInstructions: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: [
        'Pending',
        'Booking Confirmed',
        'Pickup Scheduled',
        'Picked Up',
        'Washing',
        'Ironing',
        'Ready for Delivery',
        'Out for Delivery',
        'Delivered',
        'Cancelled'
      ],
      default: 'Booking Confirmed'
    },
    statusHistory: [orderStatusHistorySchema],
    whatsappNotification: {
      customerSent: { type: Boolean, default: false },
      customerSentAt: { type: Date },
      adminSent: { type: Boolean, default: false },
      adminSentAt: { type: Date },
      mode: { type: String, default: 'mock-simulation' },
      error: { type: String, default: '' },
      customerDirectChatUrl: { type: String, default: '' },
      adminDirectChatUrl: { type: String, default: '' }
    }
  },
  {
    timestamps: true
  }
);

orderSchema.index({ 'customerSnapshot.phone': 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
