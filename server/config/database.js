const mongoose = require('mongoose');

let isConnected = false;
let isInMemoryFallback = false;

// In-Memory Storage for zero-setup execution anywhere
const memoryStore = {
  customers: [],
  orders: [],
  services: [],
  items: [],
  admins: []
};

/**
 * Connect to MongoDB or activate in-memory resilient fallback
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (uri) {
    try {
      mongoose.set('strictQuery', false);
      mongoose.set('bufferCommands', false); // Do not hang if connection drops

      console.log(`🔌 Attempting database connection to: ${uri.replace(/\/\/.*@/, '//<credentials>@')}`);

      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 2000,
        autoIndex: true
      });

      isConnected = true;
      console.log('✅ MongoDB connected successfully to database:', mongoose.connection.name || 'laundry_service');
      return mongoose.connection;
    } catch (error) {
      console.warn('⚠️ MongoDB connection not available (' + error.message + ')');
    }
  }

  // Activate seamless in-memory fallback
  isInMemoryFallback = true;
  console.log('💡 Resilient In-Memory Datastore activated. Application is ready to use without external database setup.');
  return null;
};

const getDBStatus = () => {
  return {
    isConnected: isConnected && mongoose.connection.readyState === 1,
    isInMemoryFallback,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host || 'in-memory-datastore',
    name: mongoose.connection.name || 'laundry_service_memory'
  };
};

module.exports = {
  connectDB,
  getDBStatus,
  memoryStore,
  isUsingMemoryStore: () => isInMemoryFallback || mongoose.connection.readyState !== 1
};
