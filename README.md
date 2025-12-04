# 🗺️ Google Maps Scraper

A powerful, open-source Node.js application for scraping business data from Google Maps. Extract business information including names, addresses, phone numbers, websites, ratings, reviews, and more. Works with MongoDB or CSV storage - no database required!

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18-blue.svg)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)

## ✨ Features

- 🔍 **Comprehensive Data Extraction**: Scrape business names, addresses, phone numbers, websites, ratings, reviews, hours, categories, and descriptions
- 💾 **Flexible Storage**: Works with MongoDB or CSV files - no database configuration required
- 🚀 **RESTful API**: Easy-to-use endpoints for scraping, querying, and managing data
- 📊 **Statistics Dashboard**: Track total businesses, ratings, and queries
- 🔎 **Search & Filter**: Search businesses by name, address, or query
- 📧 **Email Extraction**: Extract email addresses from business websites
- 🎯 **Duplicate Prevention**: Automatically detects and skips duplicate entries
- 🌐 **Web Interface**: Built-in web UI for easy interaction
- ⚡ **Real-time Results**: Get JSON responses immediately when scraping starts
- 🛡️ **Anti-Detection**: Built-in fingerprinting avoidance and user-agent rotation

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- (Optional) MongoDB - for persistent database storage

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/google-map-scrapper.git
   cd google-map-scrapper
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment (Optional)**
   
   Create a `.env` file in the root directory:
   ```env
   # MongoDB Configuration (Optional - will use CSV if not provided)
   MONGODB_URI=mongodb://localhost:27017/google-maps-scraper
   # OR
   MONGO_URL=mongodb://localhost:27017/google-maps-scraper
   
   # Server Port (Optional - defaults to 3000)
   PORT=3000
   ```

   **Note**: If you don't configure MongoDB, the application will automatically use CSV file storage in the `csv_data/` directory.

4. **Start the server**
   ```bash
   npm start
   ```
   
   For development with auto-reload:
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Web UI: http://localhost:3000
   - API: http://localhost:3000/api

## 📖 Usage

### Web Interface

Open your browser and navigate to `http://localhost:3000` to access the built-in web interface.

### API Endpoints

#### 1. Scrape Google Maps

Scrape businesses from Google Maps based on a search query.

```bash
GET /api/scrape?query=dentist+in+lahore
```

**Example:**
```bash
curl "http://localhost:3000/api/scrape?query=dentist+in+lahore"
```

**Response:**
```json
{
  "success": true,
  "query": "dentist in lahore",
  "resultsCount": 20,
  "results": [
    {
      "name": "Dental Clinic",
      "rating": 4.5,
      "reviewCount": 120,
      "address": "123 Main St, Lahore",
      "phone": "+92 300 1234567",
      "website": "https://example.com",
      "placeId": "ChIJ...",
      "placeUrl": "https://www.google.com/maps/place/...",
      "hours": "Mon-Fri: 9AM-6PM",
      "category": "Dentist",
      "description": "Professional dental services"
    }
  ],
  "storage": "MongoDB",
  "database": {
    "saved": 18,
    "duplicates": 2,
    "errors": 0,
    "query": "dentist in lahore",
    "totalInQuery": 18
  }
}
```

#### 2. Get All Businesses

Retrieve all saved businesses with pagination and search.

```bash
GET /api/businesses?page=1&limit=20&search=dentist&query=dentist_in_lahore
```

**Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `search` (optional): Search term for name or address
- `query` (optional): Filter by query slug

**Example:**
```bash
curl "http://localhost:3000/api/businesses?page=1&limit=10&search=dentist"
```

#### 3. Get All Queries

Retrieve all search queries that have been scraped.

```bash
GET /api/queries
```

**Example:**
```bash
curl "http://localhost:3000/api/queries"
```

**Response:**
```json
{
  "success": true,
  "queries": [
    {
      "query": "dentist in lahore",
      "querySlug": "dentist_in_lahore",
      "totalBusinesses": 18,
      "lastScrapedAt": "2024-01-15T10:30:00.000Z",
      "scrapedCount": 1,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "storage": "MongoDB"
}
```

#### 4. Get Statistics

Get overall statistics about scraped businesses.

```bash
GET /api/stats
```

**Example:**
```bash
curl "http://localhost:3000/api/stats"
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalBusinesses": 150,
    "withRating": 120,
    "averageRating": "4.35",
    "totalQueries": 5
  },
  "storage": "MongoDB"
}
```

#### 5. Extract Email from Website

Extract email address from a business website.

```bash
POST /api/extract-email
Content-Type: application/json

{
  "website": "https://example.com"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/extract-email \
  -H "Content-Type: application/json" \
  -d '{"website": "https://example.com"}'
```

**Response:**
```json
{
  "success": true,
  "website": "https://example.com",
  "email": "contact@example.com",
  "message": "Email extracted successfully"
}
```

#### 6. Update Business Email

Update email for a business in the database.

```bash
POST /api/update-email
Content-Type: application/json

{
  "businessId": "507f1f77bcf86cd799439011",
  "website": "https://example.com"
}
```

## 💾 Storage Options

### MongoDB Storage

To use MongoDB, add your connection string to `.env`:

```env
MONGODB_URI=mongodb://localhost:27017/google-maps-scraper
```

**Advantages:**
- Fast queries and indexing
- Better for large datasets
- Advanced querying capabilities
- Data persistence

### CSV Storage (Default)

If MongoDB is not configured, the application automatically uses CSV storage.

**CSV Files Location:** `csv_data/`

- `businesses_<query_slug>.csv` - One file per query
- `queries.csv` - All query records

**Advantages:**
- No database setup required
- Easy to export and share
- Human-readable format
- Perfect for small to medium datasets

**Note:** CSV files are automatically created in the `csv_data/` directory when you start scraping.

## 🏗️ Project Structure

```
google-map-scrapper/
├── db.js                 # Database connection (MongoDB)
├── server.js             # Express server and API routes
├── scraper.js            # Google Maps scraping logic
├── models/
│   ├── Business.js       # Business MongoDB schema
│   └── Query.js          # Query MongoDB schema
├── utils/
│   ├── saveToDB.js       # Database save operations
│   ├── saveToCSV.js      # CSV save operations
│   ├── detailExtractor.js # Extract detailed business info
│   └── emailExtractor.js  # Extract emails from websites
├── public/
│   ├── index.html        # Web interface
│   ├── app.js            # Frontend JavaScript
│   └── styles.css        # Frontend styles
├── csv_data/             # CSV storage directory (auto-created)
├── package.json
└── README.md
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# MongoDB (Optional)
MONGODB_URI=mongodb://localhost:27017/google-maps-scraper
# OR
MONGO_URL=mongodb://localhost:27017/google-maps-scraper

# Server Port (Optional)
PORT=3000
```

### MongoDB Setup

1. **Install MongoDB** (if not already installed)
   - macOS: `brew install mongodb-community`
   - Ubuntu: `sudo apt-get install mongodb`
   - Windows: Download from [mongodb.com](https://www.mongodb.com/try/download/community)

2. **Start MongoDB**
   ```bash
   mongod
   ```

3. **Add connection string to `.env`**
   ```env
   MONGODB_URI=mongodb://localhost:27017/google-maps-scraper
   ```

## 📝 Example Queries

Here are some example queries you can use:

```bash
# Restaurants in New York
GET /api/scrape?query=restaurants+in+new+york

# Dentists in Lahore
GET /api/scrape?query=dentist+in+lahore

# Hotels in Paris
GET /api/scrape?query=hotels+in+paris

# Coffee shops near me
GET /api/scrape?query=coffee+shops

# Plumbers in London
GET /api/scrape?query=plumber+in+london
```

## 🛠️ Development

### Running in Development Mode

```bash
npm run dev
```

This uses `nodemon` to automatically restart the server on file changes.

### Code Structure

- **Scraping Logic**: `scraper.js` - Handles Google Maps scraping with Puppeteer
- **API Routes**: `server.js` - Express routes and middleware
- **Data Models**: `models/` - MongoDB schemas
- **Utilities**: `utils/` - Helper functions for saving and extracting data

## ⚠️ Important Notes

### Rate Limiting

Google Maps may rate limit or block requests if you scrape too aggressively. The scraper includes:
- Random delays between requests
- User-agent rotation
- Browser fingerprinting avoidance

**Recommendation**: Add delays between large scraping operations to avoid being blocked.

### Legal Considerations

- Respect Google's Terms of Service
- Use scraped data responsibly
- Consider rate limiting for production use
- This tool is for educational and research purposes

### Data Accuracy

- Business information may change over time
- Some businesses may not have complete information
- Ratings and reviews are subject to change

## 🐛 Troubleshooting

### MongoDB Connection Issues

If you see MongoDB connection errors:
1. Ensure MongoDB is running: `mongod`
2. Check your connection string in `.env`
3. The app will automatically fall back to CSV storage

### Scraping Not Working

1. Check your internet connection
2. Google Maps structure may have changed - check browser console
3. You may be rate-limited - wait and try again
4. Check Puppeteer installation: `npm install puppeteer`

### CSV Files Not Created

1. Ensure the `csv_data/` directory has write permissions
2. Check disk space
3. Verify the application has write access

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Contribution Guidelines

- Follow existing code style
- Add comments for complex logic
- Update README if adding new features
- Test your changes thoroughly
- Ensure backward compatibility

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Puppeteer](https://pptr.dev/) - Browser automation
- [Express.js](https://expressjs.com/) - Web framework
- [Mongoose](https://mongoosejs.com/) - MongoDB ODM

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/yourusername/google-map-scrapper/issues) page
2. Create a new issue with detailed information
3. Include error messages and steps to reproduce

## 🗺️ Roadmap

- [ ] Add rate limiting middleware
- [ ] Implement caching for frequently accessed data
- [ ] Add export functionality (Excel, JSON)
- [ ] Support for multiple search locations
- [ ] Add unit tests
- [ ] Docker containerization
- [ ] GraphQL API option
- [ ] Real-time scraping progress updates

## ⭐ Star History

If you find this project useful, please consider giving it a star! ⭐

---

**Disclaimer**: This tool is for educational and research purposes. Please respect Google's Terms of Service and use responsibly.
