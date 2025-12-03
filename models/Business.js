const mongoose = require('mongoose');

/**
 * Business Schema - stores businesses linked to queries
 */
const businessSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    index: true
  },
  rating: {
    type: Number,
    default: null
  },
  reviewCount: {
    type: Number,
    default: null
  },
  address: {
    type: String,
    default: null
  },
  phone: {
    type: String,
    default: null
  },
  website: {
    type: String,
    default: null
  },
  placeId: {
    type: String,
    default: null,
    index: true
  },
  placeUrl: {
    type: String,
    default: null
  },
  // Link to query
  query: {
    type: String,
    required: true,
    index: true // Index for filtering by query
  },
  querySlug: {
    type: String,
    required: true,
    index: true // Index for faster query filtering
  },
  // Future: Email extraction
  email: {
    type: String,
    default: null,
    index: true
  },
  emailExtractedAt: {
    type: Date,
    default: null
  },
  // Additional details from detail page
  hours: {
    type: String,
    default: null
  },
  category: {
    type: String,
    default: null
  },
  description: {
    type: String,
    default: null
  },
  scrapedAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'businesses' // Changed collection name
});

// Compound index for duplicate checking (placeId + querySlug) - same business can be in different queries
businessSchema.index({ placeId: 1, querySlug: 1 }, { unique: false });

// Index for query filtering
businessSchema.index({ querySlug: 1, scrapedAt: -1 });

// Index on placeId for faster lookups
businessSchema.index({ placeId: 1 });

const Business = mongoose.model('Business', businessSchema);

module.exports = Business;

