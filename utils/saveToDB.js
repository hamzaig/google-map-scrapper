const Business = require('../models/Business');
const Query = require('../models/Query');

/**
 * Create a slug from query string
 */
function createQuerySlug(query) {
  return query
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Save a single business to MongoDB with duplicate checking
 * @param {Object} business - Business object
 * @param {String} query - The search query
 * @param {String} querySlug - The query slug
 * @returns {Object} Result with saved/duplicate status
 */
async function saveSingleBusinessToDB(business, query, querySlug) {
  try {
    // Check for duplicates: same placeId + querySlug combination
    let existingBusiness = null;
    
    if (business.placeId) {
      // Check if this business already exists for this specific query
      existingBusiness = await Business.findOne({ 
        placeId: business.placeId,
        querySlug: querySlug
      });
    }
    
    // If not found by placeId+querySlug, check by name + querySlug
    if (!existingBusiness) {
      existingBusiness = await Business.findOne({ 
        name: business.name,
        querySlug: querySlug,
        placeId: business.placeId || null
      });
    }

    if (existingBusiness) {
      // Simple message for duplicate, no detailed logs
      console.log(`⏭️  Duplicate: ${business.name} (skipped)`);
      return { saved: false, duplicate: true };
    }

    // Create new business document
    const newBusiness = new Business({
      name: business.name,
      rating: business.rating,
      reviewCount: business.reviewCount,
      address: business.address,
      phone: business.phone,
      website: business.website,
      placeId: business.placeId,
      placeUrl: business.placeUrl,
      query: query,
      querySlug: querySlug,
      email: null, // Email will be extracted separately via API
      emailExtractedAt: null,
      hours: business.hours || null,
      category: business.category || null,
      description: business.description || null,
      scrapedAt: new Date()
    });

    await newBusiness.save();
    console.log(`💾 Saved to DB: ${business.name}`);
    return { saved: true, duplicate: false };

  } catch (error) {
    console.error(`❌ Error saving business ${business.name}:`, error.message);
    
    // If it's a duplicate key error, count it as duplicate
    if (error.code === 11000) {
      console.log(`⏭️  Duplicate: ${business.name} (skipped)`);
      return { saved: false, duplicate: true };
    }
    
    return { saved: false, duplicate: false, error: error.message };
  }
}

/**
 * Save businesses to MongoDB with duplicate checking per query
 * @param {Array} businesses - Array of business objects
 * @param {String} query - The search query
 * @returns {Object} Statistics about saved businesses
 */
async function saveBusinessesToDB(businesses, query) {
  if (!query) {
    throw new Error('Query is required to save businesses');
  }

  const querySlug = createQuerySlug(query);
  
  // Create or update query record
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
    console.log(`✅ Created new query record: ${query}`);
  } else {
    queryRecord.scrapedCount += 1;
    queryRecord.lastScrapedAt = new Date();
    await queryRecord.save();
    console.log(`✅ Updated query record: ${query} (scraped ${queryRecord.scrapedCount} times)`);
  }
  
  let savedCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;

  for (const business of businesses) {
    const result = await saveSingleBusinessToDB(business, query, querySlug);
    
    if (result.saved) {
      savedCount++;
    } else if (result.duplicate) {
      duplicateCount++;
    } else {
      errorCount++;
    }
  }

  // Update query record with total businesses count
  const totalForQuery = await Business.countDocuments({ querySlug });
  queryRecord.totalBusinesses = totalForQuery;
  await queryRecord.save();

  return {
    total: businesses.length,
    saved: savedCount,
    duplicates: duplicateCount,
    errors: errorCount,
    query: query,
    querySlug: querySlug,
    totalInQuery: totalForQuery
  };
}

module.exports = { saveBusinessesToDB, saveSingleBusinessToDB };
