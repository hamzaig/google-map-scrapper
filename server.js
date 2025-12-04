require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { scrapeGoogleMaps } = require('./scraper');
const { connectDB, disconnectDB, isDBAvailable } = require('./db');
const { saveBusinessesToDB, saveSingleBusinessToDB } = require('./utils/saveToDB');
const { extractEmailFromWebsite } = require('./utils/emailExtractor');
const Business = require('./models/Business');
const Query = require('./models/Query');
const mongoose = require('mongoose');
const { 
  readBusinessesFromCSV, 
  readAllBusinessesFromCSV,
  readQueriesFromCSV,
  getStatsFromCSV,
  createQuerySlug: createCSVQuerySlug,
  updateQueryRecordCSV
} = require('./utils/saveToCSV');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files from public directory

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// API endpoint to get all queries
app.get('/api/queries', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      // Use CSV fallback
      const queries = readQueriesFromCSV();
      return res.json({ 
        success: true, 
        queries: queries || [],
        storage: 'CSV'
      });
    }
    
    const queries = await Query.find()
      .sort({ lastScrapedAt: -1 })
      .lean();
    
    res.json({
      success: true,
      queries: queries || [],
      storage: 'MongoDB'
    });
  } catch (error) {
    console.error('Error fetching queries:', error);
    // Fallback to CSV on error
    try {
      const queries = readQueriesFromCSV();
      res.json({ 
        success: true, 
        queries: queries || [],
        storage: 'CSV'
      });
    } catch (csvError) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch queries',
        message: error.message 
      });
    }
  }
});

// API endpoint to get all saved businesses
app.get('/api/businesses', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', query: queryFilter = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      // Use CSV fallback
      let businesses = [];
      
      if (queryFilter) {
        const querySlug = createCSVQuerySlug(queryFilter);
        businesses = readBusinessesFromCSV(querySlug);
      } else {
        businesses = readAllBusinessesFromCSV();
      }
      
      // Apply search filter if provided
      if (search) {
        const searchLower = search.toLowerCase();
        businesses = businesses.filter(b => 
          (b.name && b.name.toLowerCase().includes(searchLower)) ||
          (b.address && b.address.toLowerCase().includes(searchLower))
        );
      }
      
      // Sort by scrapedAt descending
      businesses.sort((a, b) => {
        const dateA = a.scrapedAt ? new Date(a.scrapedAt) : new Date(0);
        const dateB = b.scrapedAt ? new Date(b.scrapedAt) : new Date(0);
        return dateB - dateA;
      });
      
      const total = businesses.length;
      const paginatedBusinesses = businesses.slice(skip, skip + parseInt(limit));
      
      console.log(`API /businesses (CSV): Found ${paginatedBusinesses.length} businesses out of ${total} total (page ${page}, limit ${limit}, queryFilter: ${queryFilter || 'all'})`);
      
      return res.json({
        success: true,
        businesses: paginatedBusinesses || [],
        storage: 'CSV',
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total || 0,
          pages: Math.ceil((total || 0) / parseInt(limit))
        }
      });
    }
    
    // Build search query
    let mongoQuery = {};
    
    // Filter by query if provided
    if (queryFilter) {
      const querySlug = queryFilter.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      mongoQuery.querySlug = querySlug;
    }
    
    // Add text search if provided
    if (search) {
      mongoQuery.$and = mongoQuery.$and || [];
      mongoQuery.$and.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { address: { $regex: search, $options: 'i' } }
        ]
      });
    }
    
    const businesses = await Business.find(mongoQuery)
      .sort({ scrapedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await Business.countDocuments(mongoQuery);
    
    console.log(`API /businesses: Found ${businesses.length} businesses out of ${total} total (page ${page}, limit ${limit}, queryFilter: ${queryFilter || 'all'})`);
    
    res.json({
      success: true,
      businesses: businesses || [],
      storage: 'MongoDB',
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total || 0,
        pages: Math.ceil((total || 0) / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching businesses:', error);
    // Fallback to CSV on error
    try {
      let businesses = readAllBusinessesFromCSV();
      const { page = 1, limit = 20, search = '', query: queryFilter = '' } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      if (queryFilter) {
        const querySlug = createCSVQuerySlug(queryFilter);
        businesses = readBusinessesFromCSV(querySlug);
      }
      
      if (search) {
        const searchLower = search.toLowerCase();
        businesses = businesses.filter(b => 
          (b.name && b.name.toLowerCase().includes(searchLower)) ||
          (b.address && b.address.toLowerCase().includes(searchLower))
        );
      }
      
      businesses.sort((a, b) => {
        const dateA = a.scrapedAt ? new Date(a.scrapedAt) : new Date(0);
        const dateB = b.scrapedAt ? new Date(b.scrapedAt) : new Date(0);
        return dateB - dateA;
      });
      
      const total = businesses.length;
      const paginatedBusinesses = businesses.slice(skip, skip + parseInt(limit));
      
      res.json({
        success: true,
        businesses: paginatedBusinesses || [],
        storage: 'CSV',
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total || 0,
          pages: Math.ceil((total || 0) / parseInt(limit))
        }
      });
    } catch (csvError) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch businesses',
        message: error.message,
        businesses: [],
        pagination: {
          page: parseInt(req.query.page) || 1,
          limit: parseInt(req.query.limit) || 20,
          total: 0,
          pages: 0
        }
      });
    }
  }
});

// API endpoint to get statistics
app.get('/api/stats', async (req, res) => {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      // Use CSV fallback
      const stats = getStatsFromCSV();
      return res.json({
        success: true,
        stats: stats,
        storage: 'CSV'
      });
    }
    
    const total = await Business.countDocuments().catch(() => 0);
    const withRating = await Business.countDocuments({ rating: { $ne: null } }).catch(() => 0);
    const totalQueries = await Query.countDocuments().catch(() => 0);
    const avgRating = await Business.aggregate([
      { $match: { rating: { $ne: null } } },
      { $group: { _id: null, avgRating: { $avg: '$rating' } } }
    ]).catch(() => []);
    
    res.json({
      success: true,
      stats: {
        totalBusinesses: total || 0,
        withRating: withRating || 0,
        averageRating: avgRating[0]?.avgRating?.toFixed(2) || '0.00',
        totalQueries: totalQueries || 0
      },
      storage: 'MongoDB'
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    // Fallback to CSV on error
    try {
      const stats = getStatsFromCSV();
      res.json({
        success: true,
        stats: stats,
        storage: 'CSV'
      });
    } catch (csvError) {
      res.json({
        success: true,
        stats: {
          totalBusinesses: 0,
          withRating: 0,
          averageRating: '0.00',
          totalQueries: 0
        }
      });
    }
  }
});

// Email extraction endpoint
app.post('/api/extract-email', async (req, res) => {
  try {
    const { website } = req.body;

    if (!website) {
      return res.status(400).json({ 
        success: false,
        error: 'Website URL is required',
        example: { website: 'https://example.com' }
      });
    }

    // Validate URL
    if (!website.startsWith('http')) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid URL. Must start with http:// or https://'
      });
    }

    // Skip Google Maps URLs
    if (website.includes('google.com/maps') || website.includes('maps.google.com')) {
      return res.status(400).json({ 
        success: false,
        error: 'Google Maps URLs are not supported. Please provide actual business website URL.'
      });
    }

    console.log(`📧 Extracting email from: ${website}`);
    
    const email = await extractEmailFromWebsite(website, 10000);
    
    if (email) {
      res.json({
        success: true,
        website: website,
        email: email,
        message: 'Email extracted successfully'
      });
    } else {
      res.json({
        success: true,
        website: website,
        email: null,
        message: 'No email found on the website'
      });
    }

  } catch (error) {
    console.error('Error extracting email:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to extract email',
      message: error.message 
    });
  }
});

// Update business email endpoint (optional - to update email in database/CSV)
app.post('/api/update-email', async (req, res) => {
  try {
    const { businessId, website } = req.body;

    if (!businessId && !website) {
      return res.status(400).json({ 
        success: false,
        error: 'Either businessId or website is required'
      });
    }

    // Extract email
    let email = null;
    if (website) {
      if (!website.includes('google.com/maps') && !website.includes('maps.google.com')) {
        email = await extractEmailFromWebsite(website, 10000);
      }
    }

    // Update business in database if businessId provided and DB is connected
    if (businessId && email && mongoose.connection.readyState === 1) {
      try {
        const business = await Business.findById(businessId);
        if (business) {
          business.email = email;
          business.emailExtractedAt = new Date();
          await business.save();
          
          return res.json({
            success: true,
            businessId: businessId,
            email: email,
            message: 'Email updated in database',
            storage: 'MongoDB'
          });
        }
      } catch (dbError) {
        console.error('Error updating email in DB:', dbError.message);
      }
    }

    // Note: CSV update by businessId is not implemented as CSV doesn't have IDs
    // But we can still return the extracted email
    res.json({
      success: true,
      email: email,
      message: email ? 'Email extracted successfully' : 'No email found',
      storage: mongoose.connection.readyState === 1 ? 'MongoDB' : 'CSV',
      note: mongoose.connection.readyState !== 1 ? 'CSV storage does not support email updates by ID. Use the extracted email value.' : null
    });

  } catch (error) {
    console.error('Error updating email:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update email',
      message: error.message 
    });
  }
});

// Scraping endpoint
app.get('/api/scrape', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ 
        error: 'Query parameter is required',
        example: '/api/scrape?query=dentist+in+lahore'
      });
    }

    console.log(`Scraping Google Maps for query: ${query}`);
    
    // Initialize query record
    const createQuerySlug = (q) => q.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const querySlug = createQuerySlug(query);
    
    // Create or update query record (works for both DB and CSV)
    if (mongoose.connection.readyState === 1) {
      let queryRecord = await Query.findOne({ querySlug });
      if (!queryRecord) {
        queryRecord = new Query({
          query: query,
          querySlug: querySlug,
          totalBusinesses: 0,
          lastScrapedAt: new Date(),
          scrapedCount: 1
        });
        await queryRecord.save();
      } else {
        queryRecord.scrapedCount += 1;
        queryRecord.lastScrapedAt = new Date();
        await queryRecord.save();
      }
    } else {
      // Update CSV query record
      updateQueryRecordCSV(query, querySlug);
    }
    
    // Track statistics
    let savedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    
    // Callback to save each business immediately after extraction
    const onBusinessExtracted = async (business, query) => {
      try {
        const result = await saveSingleBusinessToDB(business, query, querySlug);
        if (result.saved) {
          savedCount++;
        } else if (result.duplicate) {
          duplicateCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
        console.error(`Error saving ${business.name}:`, error.message);
      }
    };
    
    // Scrape with callback - each business will be saved immediately after extraction
    const results = await scrapeGoogleMaps(query, onBusinessExtracted);
    
    // Update query record with final count
    let totalForQuery = 0;
    if (mongoose.connection.readyState === 1) {
      totalForQuery = await Business.countDocuments({ querySlug });
      const queryRecord = await Query.findOne({ querySlug });
      if (queryRecord) {
        queryRecord.totalBusinesses = totalForQuery;
        await queryRecord.save();
      }
    } else {
      // Count from CSV
      const csvBusinesses = readBusinessesFromCSV(querySlug);
      totalForQuery = csvBusinesses.length;
      updateQueryRecordCSV(query, querySlug);
    }
    
    const saveStats = {
      saved: savedCount,
      duplicates: duplicateCount,
      errors: errorCount,
      query: query,
      querySlug: querySlug,
      totalInQuery: totalForQuery
    };
    
    console.log(`\n📊 Final Stats: ${saveStats.saved} saved, ${saveStats.duplicates} duplicates, ${saveStats.errors} errors`);
    console.log(`📊 Total businesses for this query: ${saveStats.totalInQuery}`);
    
    // Return JSON response immediately when query starts
    res.json({
      success: true,
      query: query,
      resultsCount: results.length,
      results: results,
      storage: mongoose.connection.readyState === 1 ? 'MongoDB' : 'CSV',
      database: saveStats ? {
        saved: saveStats.saved,
        duplicates: saveStats.duplicates,
        errors: saveStats.errors,
        query: saveStats.query,
        totalInQuery: saveStats.totalInQuery
      } : null
    });

  } catch (error) {
    console.error('Error scraping Google Maps:', error);
    res.status(500).json({ 
      error: 'Failed to scrape Google Maps',
      message: error.message 
    });
  }
});

// Connect to MongoDB before starting server (optional - will use CSV if not available)
connectDB()
  .then((dbConnected) => {
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log(`Test endpoint: http://localhost:${PORT}/api/scrape?query=dentist+in+lahore`);
      if (!dbConnected) {
        console.log('📄 Using CSV storage (MongoDB not configured)');
      } else {
        console.log('💾 Using MongoDB storage');
      }
    });
  })
  .catch((error) => {
    // Even if DB connection fails, start server with CSV fallback
    console.error('Database connection failed, using CSV storage:', error.message);
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log(`Test endpoint: http://localhost:${PORT}/api/scrape?query=dentist+in+lahore`);
      console.log('📄 Using CSV storage (MongoDB connection failed)');
    });
  });

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await disconnectDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  await disconnectDB();
  process.exit(0);
});
