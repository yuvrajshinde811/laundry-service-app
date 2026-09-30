require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const { Service, LaundryItem } = require('../models/Service');
const { generateOrderId } = require('../utils/generateOrderId');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/laundry_service';

async function seedDatabase() {
  try {
    console.log('🌱 Starting Database Seeding...');
    console.log(`Connecting to: ${MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@')}`);

    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });

    console.log('✅ Connected to MongoDB.');

    // 1. Seed Admin User
    const adminEmail = (process.env.ADMIN_DEFAULT_EMAIL || 'admin@laundry.com').toLowerCase();
    const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@123456';
    const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER || '8080082714';

    const existingAdmin = await Admin.findOne({ email: adminEmail });
    if (!existingAdmin) {
      const passwordHash = await Admin.hashPassword(adminPassword);
      await Admin.create({
        name: 'Laundry Administrator',
        email: adminEmail,
        passwordHash,
        role: 'superadmin',
        phone: adminPhone
      });
      console.log(`👤 Admin created successfully: ${adminEmail} (Password: ${adminPassword})`);
    } else {
      console.log(`👤 Admin already exists: ${adminEmail}`);
    }

    // 2. Seed Services
    const defaultServices = [
      {
        name: 'Washing',
        code: 'washing',
        description: 'Regular wash with premium eco-friendly detergents, fabric softeners and gentle tumble drying.',
        icon: 'bi-droplet-half',
        badge: 'Everyday Care',
        basePriceMultiplier: 0.8,
        estimatedHours: 24,
        displayOrder: 1
      },
      {
        name: 'Washing + Ironing',
        code: 'washing_ironing',
        description: 'Deep hygienic wash followed by crisp high-pressure steam pressing and wrinkle-free hangers.',
        icon: 'bi-stars',
        badge: 'Most Popular',
        basePriceMultiplier: 1.0,
        estimatedHours: 24,
        displayOrder: 2
      },
      {
        name: 'Dry Cleaning',
        code: 'dry_cleaning',
        description: 'Specialist solvent cleaning for suits, silk sarees, heavy embroidery and delicate fabrics.',
        icon: 'bi-shield-check',
        badge: 'Premium Care',
        basePriceMultiplier: 2.2,
        estimatedHours: 48,
        displayOrder: 3
      },
      {
        name: 'Ironing',
        code: 'ironing',
        description: 'Professional steam ironing for crisp collars, sharp creases, and ready-to-wear finish.',
        icon: 'bi-wind',
        badge: 'Quick Service',
        basePriceMultiplier: 0.5,
        estimatedHours: 12,
        displayOrder: 4
      },
      {
        name: 'Bedsheet Cleaning',
        code: 'bedsheet_cleaning',
        description: 'Sanitizing hot-wash and flat pressing for single/double bedsheets and pillow covers.',
        icon: 'bi-layers',
        badge: 'Home Care',
        basePriceMultiplier: 1.0,
        estimatedHours: 24,
        displayOrder: 5
      },
      {
        name: 'Blanket Cleaning',
        code: 'blanket_cleaning',
        description: 'Deep stain removal, anti-allergen treatment, and fluffing for heavy blankets, quilts & comforters.',
        icon: 'bi-box-seam',
        badge: 'Bulky Care',
        basePriceMultiplier: 1.8,
        estimatedHours: 48,
        displayOrder: 6
      }
    ];

    for (const svc of defaultServices) {
      await Service.findOneAndUpdate(
        { code: svc.code },
        svc,
        { upsert: true, new: true }
      );
    }
    console.log(`✨ ${defaultServices.length} Laundry Services seeded.`);

    // 3. Seed Laundry Items
    const defaultItems = [
      { name: 'Shirt', category: 'Daily Wear', basePrice: 35, servicePrices: { washing: 25, washing_ironing: 35, dry_cleaning: 75, ironing: 15 } },
      { name: 'T-Shirt', category: 'Daily Wear', basePrice: 30, servicePrices: { washing: 20, washing_ironing: 30, dry_cleaning: 60, ironing: 15 } },
      { name: 'Pants', category: 'Formal Wear', basePrice: 40, servicePrices: { washing: 30, washing_ironing: 40, dry_cleaning: 85, ironing: 20 } },
      { name: 'Jeans', category: 'Daily Wear', basePrice: 45, servicePrices: { washing: 35, washing_ironing: 45, dry_cleaning: 95, ironing: 25 } },
      { name: 'Saree', category: 'Traditional & Delicate', basePrice: 90, servicePrices: { washing: 60, washing_ironing: 90, dry_cleaning: 160, ironing: 40 } },
      { name: 'Bedsheet', category: 'Household & Bedding', basePrice: 90, servicePrices: { washing: 60, washing_ironing: 90, dry_cleaning: 130, ironing: 40 } },
      { name: 'Blanket', category: 'Household & Bedding', basePrice: 180, servicePrices: { washing: 140, washing_ironing: 180, dry_cleaning: 250, ironing: 50 } },
      { name: 'Suit (2 Pcs)', category: 'Formal Wear', basePrice: 160, servicePrices: { washing: 100, washing_ironing: 160, dry_cleaning: 280, ironing: 70 } },
      { name: 'Kurta', category: 'Traditional & Delicate', basePrice: 50, servicePrices: { washing: 35, washing_ironing: 50, dry_cleaning: 110, ironing: 25 } },
      { name: 'Other', category: 'Other', basePrice: 45, servicePrices: { washing: 30, washing_ironing: 45, dry_cleaning: 85, ironing: 20 } }
    ];

    for (const it of defaultItems) {
      await LaundryItem.findOneAndUpdate(
        { name: it.name },
        it,
        { upsert: true, new: true }
      );
    }
    console.log(`🏷️ ${defaultItems.length} Laundry item prices seeded.`);

    // 4. Seed sample customer & order if database is empty
    const orderCount = await Order.countDocuments({});
    if (orderCount === 0) {
      const sampleCustomer = await Customer.findOneAndUpdate(
        { phone: '9876543210' },
        {
          name: 'Yuvraj Shinde',
          phone: '9876543210',
          whatsappNumber: '9876543210',
          email: 'customer@example.com',
          address: 'Flat 402, Sunshine Heights, MG Road',
          area: 'Bandra West',
          city: 'Mumbai',
          pincode: '400050'
        },
        { upsert: true, new: true }
      );

      const sampleOrderId = generateOrderId(101);
      await Order.create({
        orderId: sampleOrderId,
        customer: sampleCustomer._id,
        customerSnapshot: {
          name: sampleCustomer.name,
          phone: sampleCustomer.phone,
          whatsappNumber: sampleCustomer.whatsappNumber,
          email: sampleCustomer.email,
          address: sampleCustomer.address,
          area: sampleCustomer.area,
          city: sampleCustomer.city,
          pincode: sampleCustomer.pincode
        },
        items: [
          { item: 'Shirt', quantity: 5, service: 'Washing + Ironing', unitPrice: 35, itemTotal: 175 },
          { item: 'Pants', quantity: 2, service: 'Washing + Ironing', unitPrice: 40, itemTotal: 80 },
          { item: 'Bedsheet', quantity: 1, service: 'Washing + Ironing', unitPrice: 90, itemTotal: 90 }
        ],
        pickupDate: new Date().toISOString().split('T')[0],
        pickupTimeSlot: '10:00 AM – 12:00 PM',
        deliveryDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
        deliveryTimeSlot: '10:00 AM – 12:00 PM',
        deliveryPreference: 'Standard',
        subtotal: 345,
        deliveryCharge: 50,
        expressCharge: 0,
        discount: 0,
        totalAmount: 395,
        additionalInstructions: 'Please handle white shirts separately and iron collars crisp.',
        status: 'Booking Confirmed',
        statusHistory: [
          {
            status: 'Booking Confirmed',
            timestamp: new Date(),
            note: 'Initial booking created'
          }
        ],
        whatsappNotification: {
          customerSent: true,
          customerSentAt: new Date(),
          adminSent: true,
          adminSentAt: new Date(),
          mode: 'mock-simulation',
          customerDirectChatUrl: 'https://wa.me/919876543210',
          adminDirectChatUrl: 'https://wa.me/918080082714'
        }
      });

      console.log(`📦 Sample order created: ${sampleOrderId}`);
    }

    console.log('\n🎉 Database Seeding Complete!');
    console.log(`Admin Login: ${adminEmail}`);
    console.log(`Admin Password: ${adminPassword}`);
    console.log(`Admin WhatsApp Alert Number: ${adminPhone}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding Error:', error.message);
    process.exit(1);
  }
}

seedDatabase();
