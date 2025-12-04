const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Check if database is available
 */
function isDBAvailable() {
  const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URL;
  return !!mongoURI;
}

/**
 * Connect to MongoDB (optional - won't throw error if not available)
 */
async function connectDB() {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URL;
    
    if (!mongoURI) {
      console.log('⚠️  MongoDB URI not found in environment variables. Using CSV storage instead.');
      return false;
    }

    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ MongoDB connected successfully');
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.log('⚠️  Falling back to CSV storage.');
    return false;
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

module.exports = { connectDB, disconnectDB, isDBAvailable };

