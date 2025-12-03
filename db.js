const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URL;
    
    if (!mongoURI) {
      throw new Error('MongoDB URI not found in environment variables. Please add MONGODB_URI or MONGO_URL to your .env file');
    }

    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    throw error;
  }
}

/**
 * Disconnect from MongoDB
 */
async function disconnectDB() {
  try {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  } catch (error) {
    console.error('Error disconnecting from MongoDB:', error.message);
  }
}

module.exports = { connectDB, disconnectDB };

