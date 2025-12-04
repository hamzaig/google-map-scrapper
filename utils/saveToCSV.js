const fs = require('fs');
const path = require('path');

// Directory to store CSV files
const CSV_DIR = path.join(__dirname, '..', 'csv_data');

// Ensure CSV directory exists
if (!fs.existsSync(CSV_DIR)) {
  fs.mkdirSync(CSV_DIR, { recursive: true });
}

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
 * Get CSV file path for businesses
 */
function getBusinessesCSVPath(querySlug) {
  return path.join(CSV_DIR, `businesses_${querySlug}.csv`);
}

/**
 * Get CSV file path for queries
 */
function getQueriesCSVPath() {
  return path.join(CSV_DIR, 'queries.csv');
}

/**
 * Read all businesses from CSV file
 */
function readBusinessesFromCSV(querySlug) {
  const csvPath = getBusinessesCSVPath(querySlug);
  
  if (!fs.existsSync(csvPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.trim().split('\n');
    
    if (lines.length <= 1) {
      return []; // Only header or empty
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const businesses = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const business = {};
        headers.forEach((header, index) => {
          let value = values[index];
          // Parse numeric fields
          if (header === 'rating' || header === 'reviewCount') {
            value = value === '' || value === 'null' ? null : parseFloat(value);
          } else if (header === 'scrapedAt') {
            value = value === '' || value === 'null' ? null : new Date(value);
          } else {
            value = value === '' || value === 'null' ? null : value;
          }
          business[header] = value;
        });
        businesses.push(business);
      }
    }

    return businesses;
  } catch (error) {
    console.error(`Error reading CSV file ${csvPath}:`, error.message);
    return [];
  }
}

/**
 * Read all businesses from all CSV files
 */
function readAllBusinessesFromCSV() {
  const businesses = [];
  
  try {
    const files = fs.readdirSync(CSV_DIR);
    const businessFiles = files.filter(f => f.startsWith('businesses_') && f.endsWith('.csv'));
    
    for (const file of businessFiles) {
      const querySlug = file.replace('businesses_', '').replace('.csv', '');
      const queryBusinesses = readBusinessesFromCSV(querySlug);
      businesses.push(...queryBusinesses);
    }
  } catch (error) {
    console.error('Error reading all businesses from CSV:', error.message);
  }
  
  return businesses;
}

/**
 * Parse CSV line handling quoted values
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  
  return values;
}

/**
 * Escape CSV value
 */
function escapeCSVValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/**
 * Save a single business to CSV
 */
function saveSingleBusinessToCSV(business, query, querySlug) {
  const csvPath = getBusinessesCSVPath(querySlug);
  const headers = [
    'name', 'rating', 'reviewCount', 'address', 'phone', 'website',
    'placeId', 'placeUrl', 'query', 'querySlug', 'email', 'emailExtractedAt',
    'hours', 'category', 'description', 'scrapedAt'
  ];

  // Read existing businesses to check for duplicates
  const existingBusinesses = readBusinessesFromCSV(querySlug);
  
  // Check for duplicates: same placeId + querySlug combination
  let existingBusiness = null;
  
  if (business.placeId) {
    existingBusiness = existingBusinesses.find(b => 
      b.placeId === business.placeId && b.querySlug === querySlug
    );
  }
  
  // If not found by placeId+querySlug, check by name + querySlug
  if (!existingBusiness) {
    existingBusiness = existingBusinesses.find(b => 
      b.name === business.name && 
      b.querySlug === querySlug &&
      (b.placeId === business.placeId || (!b.placeId && !business.placeId))
    );
  }

  if (existingBusiness) {
    console.log(`⏭️  Duplicate: ${business.name} (skipped)`);
    return { saved: false, duplicate: true };
  }

  // Prepare business data
  const businessData = {
    name: business.name || '',
    rating: business.rating || '',
    reviewCount: business.reviewCount || '',
    address: business.address || '',
    phone: business.phone || '',
    website: business.website || '',
    placeId: business.placeId || '',
    placeUrl: business.placeUrl || '',
    query: query || '',
    querySlug: querySlug || '',
    email: business.email || '',
    emailExtractedAt: business.emailExtractedAt ? business.emailExtractedAt.toISOString() : '',
    hours: business.hours || '',
    category: business.category || '',
    description: business.description || '',
    scrapedAt: business.scrapedAt ? business.scrapedAt.toISOString() : new Date().toISOString()
  };

  // Check if file exists, if not create with headers
  const fileExists = fs.existsSync(csvPath);
  
  try {
    let csvContent = '';
    
    if (!fileExists) {
      // Create file with headers
      csvContent = headers.join(',') + '\n';
    }
    
    // Append business row
    const row = headers.map(header => escapeCSVValue(businessData[header])).join(',');
    csvContent += row + '\n';
    
    fs.appendFileSync(csvPath, csvContent);
    console.log(`💾 Saved to CSV: ${business.name}`);
    
    return { saved: true, duplicate: false };
  } catch (error) {
    console.error(`❌ Error saving business ${business.name} to CSV:`, error.message);
    return { saved: false, duplicate: false, error: error.message };
  }
}

/**
 * Save businesses to CSV
 */
function saveBusinessesToCSV(businesses, query) {
  if (!query) {
    throw new Error('Query is required to save businesses');
  }

  const querySlug = createQuerySlug(query);
  
  // Create or update query record
  updateQueryRecordCSV(query, querySlug);
  
  let savedCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;

  for (const business of businesses) {
    const result = saveSingleBusinessToCSV(business, query, querySlug);
    
    if (result.saved) {
      savedCount++;
    } else if (result.duplicate) {
      duplicateCount++;
    } else {
      errorCount++;
    }
  }

  // Count total businesses for this query
  const allBusinesses = readBusinessesFromCSV(querySlug);
  const totalForQuery = allBusinesses.length;

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

/**
 * Read queries from CSV
 */
function readQueriesFromCSV() {
  const csvPath = getQueriesCSVPath();
  
  if (!fs.existsSync(csvPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.trim().split('\n');
    
    if (lines.length <= 1) {
      return [];
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const queries = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const query = {};
        headers.forEach((header, index) => {
          let value = values[index];
          if (header === 'totalBusinesses' || header === 'scrapedCount') {
            value = value === '' || value === 'null' ? 0 : parseInt(value);
          } else if (header === 'lastScrapedAt' || header === 'createdAt') {
            value = value === '' || value === 'null' ? null : new Date(value);
          } else {
            value = value === '' || value === 'null' ? null : value;
          }
          query[header] = value;
        });
        queries.push(query);
      }
    }

    return queries;
  } catch (error) {
    console.error(`Error reading queries CSV file:`, error.message);
    return [];
  }
}

/**
 * Update query record in CSV
 */
function updateQueryRecordCSV(query, querySlug) {
  const csvPath = getQueriesCSVPath();
  const headers = ['query', 'querySlug', 'totalBusinesses', 'lastScrapedAt', 'scrapedCount', 'createdAt'];
  
  let queries = readQueriesFromCSV();
  
  // Find existing query
  let queryRecord = queries.find(q => q.querySlug === querySlug);
  
  if (!queryRecord) {
    // Create new query record
    queryRecord = {
      query: query,
      querySlug: querySlug,
      totalBusinesses: 0,
      lastScrapedAt: new Date(),
      scrapedCount: 1,
      createdAt: new Date()
    };
    queries.push(queryRecord);
    console.log(`✅ Created new query record in CSV: ${query}`);
  } else {
    // Update existing query record
    queryRecord.scrapedCount += 1;
    queryRecord.lastScrapedAt = new Date();
    console.log(`✅ Updated query record in CSV: ${query} (scraped ${queryRecord.scrapedCount} times)`);
  }
  
  // Update total businesses count
  const allBusinesses = readBusinessesFromCSV(querySlug);
  queryRecord.totalBusinesses = allBusinesses.length;
  
  // Write all queries back to CSV
  try {
    let csvContent = headers.join(',') + '\n';
    
    for (const q of queries) {
      const row = headers.map(header => {
        let value = q[header];
        if (value instanceof Date) {
          value = value.toISOString();
        }
        return escapeCSVValue(value);
      }).join(',');
      csvContent += row + '\n';
    }
    
    fs.writeFileSync(csvPath, csvContent);
  } catch (error) {
    console.error(`Error writing queries CSV file:`, error.message);
  }
}

/**
 * Get statistics from CSV
 */
function getStatsFromCSV() {
  const allBusinesses = readAllBusinessesFromCSV();
  const queries = readQueriesFromCSV();
  
  const totalBusinesses = allBusinesses.length;
  const withRating = allBusinesses.filter(b => b.rating !== null && b.rating !== '').length;
  
  let totalRating = 0;
  let ratingCount = 0;
  allBusinesses.forEach(b => {
    if (b.rating !== null && b.rating !== '') {
      totalRating += parseFloat(b.rating);
      ratingCount++;
    }
  });
  
  const averageRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(2) : '0.00';
  const totalQueries = queries.length;
  
  return {
    totalBusinesses,
    withRating,
    averageRating,
    totalQueries
  };
}

module.exports = {
  saveSingleBusinessToCSV,
  saveBusinessesToCSV,
  readBusinessesFromCSV,
  readAllBusinessesFromCSV,
  readQueriesFromCSV,
  updateQueryRecordCSV,
  getStatsFromCSV,
  createQuerySlug
};

