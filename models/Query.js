const mongoose = require('mongoose');

/**
 * Query Schema to track each search query
 */
const querySchema = new mongoose.Schema({
  query: {
    type: String,
    required: true,
    index: true,
    unique: true // Each query should be unique
  },
  querySlug: {
    type: String,
    required: true,
    index: true,
    unique: true
  },
  totalBusinesses: {
    type: Number,
    default: 0
  },
  lastScrapedAt: {
    type: Date,
    default: Date.now
  },
  scrapedCount: {
    type: Number,
    default: 1 // How many times this query was scraped
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'queries'
});

// Index for faster lookups
querySchema.index({ querySlug: 1 });

const Query = mongoose.model('Query', querySchema);

module.exports = Query;

