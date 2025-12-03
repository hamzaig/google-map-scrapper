// API Base URL
const API_BASE = '';

// State
let currentPage = 1;
let currentSearch = '';
let isLoading = false;

// DOM Elements
const searchQueryInput = document.getElementById('searchQuery');
const scrapeBtn = document.getElementById('scrapeBtn');
const filterInput = document.getElementById('filterInput');
const loadingIndicator = document.getElementById('loadingIndicator');
const businessesContainer = document.getElementById('businessesContainer');
const emptyState = document.getElementById('emptyState');
const resultsTitle = document.getElementById('resultsTitle');
const resultsCount = document.getElementById('resultsCount');
const dbStats = document.getElementById('dbStats');
const pagination = document.getElementById('pagination');
const statsContainer = document.getElementById('statsContainer');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadBusinesses();
    
    // Event Listeners
    scrapeBtn.addEventListener('click', handleScrape);
    searchQueryInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleScrape();
    });
    
    filterInput.addEventListener('input', (e) => {
        currentSearch = e.target.value;
        currentPage = 1;
        loadBusinesses();
    });
});

// Load Statistics
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('totalBusinesses').textContent = data.stats.totalBusinesses || 0;
            document.getElementById('avgRating').textContent = data.stats.averageRating || '0.00';
            document.getElementById('withRating').textContent = data.stats.withRating || 0;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        // Set default values if stats fail to load
        document.getElementById('totalBusinesses').textContent = '0';
        document.getElementById('avgRating').textContent = '0.00';
        document.getElementById('withRating').textContent = '0';
    }
}

// Handle Scrape
async function handleScrape() {
    const query = searchQueryInput.value.trim();
    
    if (!query) {
        alert('Please enter a search query');
        return;
    }
    
    if (isLoading) return;
    
    isLoading = true;
    if (scrapeBtn) scrapeBtn.disabled = true;
    if (loadingIndicator) loadingIndicator.classList.remove('hidden');
    if (dbStats) dbStats.classList.add('hidden');
    
    try {
        const response = await fetch(`${API_BASE}/api/scrape?query=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.success) {
            // Show database stats
            if (data.database && dbStats) {
                dbStats.innerHTML = `
                    <div class="db-stat-item">
                        <span class="db-stat-label">Saved:</span>
                        <span class="db-stat-value">${data.database.saved}</span>
                    </div>
                    <div class="db-stat-item">
                        <span class="db-stat-label">Duplicates:</span>
                        <span class="db-stat-value">${data.database.duplicates}</span>
                    </div>
                    <div class="db-stat-item">
                        <span class="db-stat-label">Errors:</span>
                        <span class="db-stat-value">${data.database.errors}</span>
                    </div>
                `;
                dbStats.classList.remove('hidden');
            }
            
            // Reload businesses and stats
            await loadBusinesses();
            await loadStats();
            
            // Show success message
            showNotification(`Successfully scraped ${data.resultsCount} businesses!`, 'success');
        } else {
            throw new Error(data.error || 'Scraping failed');
        }
    } catch (error) {
        console.error('Scraping error:', error);
        showNotification(`Error: ${error.message}`, 'error');
    } finally {
        isLoading = false;
        if (scrapeBtn) scrapeBtn.disabled = false;
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
    }
}

// Load Businesses
async function loadBusinesses(page = 1) {
    try {
        const searchParam = currentSearch ? `&search=${encodeURIComponent(currentSearch)}` : '';
        const url = `${API_BASE}/api/businesses?page=${page}&limit=20${searchParam}`;
        console.log('Fetching businesses from:', url); // Debug log
        
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('HTTP error response:', response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Businesses API response:', data); // Debug log
        
        if (data.success !== false && data.businesses) {
            console.log('Displaying businesses:', data.businesses.length, 'businesses'); // Debug log
            displayBusinesses(data.businesses);
            displayPagination(data.pagination);
            updateResultsCount(data.pagination);
            
            const tableWrapper = document.querySelector('.table-wrapper');
            if (!data.businesses || data.businesses.length === 0) {
                console.log('No businesses in response, showing empty state');
                if (emptyState) emptyState.classList.remove('hidden');
                if (tableWrapper) tableWrapper.classList.add('hidden');
            } else {
                console.log('Showing table with', data.businesses.length, 'businesses');
                if (emptyState) emptyState.classList.add('hidden');
                if (tableWrapper) tableWrapper.classList.remove('hidden');
            }
        } else {
            console.error('API returned error:', data.error || data.message);
            throw new Error(data.error || data.message || 'Failed to load businesses');
        }
    } catch (error) {
        console.error('Error loading businesses:', error);
        // Don't show alert on initial load, just show empty state
        if (page === 1 && !currentSearch) {
            if (emptyState) {
                emptyState.classList.remove('hidden');
                emptyState.innerHTML = `
                    <i class="fas fa-inbox"></i>
                    <p>No businesses found. Start scraping to see results!</p>
                    <p style="font-size: 0.9rem; margin-top: 10px; color: #999;">Error: ${error.message}</p>
                    <p style="font-size: 0.9rem; margin-top: 5px; color: #999;">Check browser console for details.</p>
                `;
            }
            const tableWrapper = document.querySelector('.table-wrapper');
            if (tableWrapper) tableWrapper.classList.add('hidden');
        } else {
            showNotification('Error loading businesses: ' + error.message, 'error');
        }
    }
}

// Display Businesses
function displayBusinesses(businesses) {
    console.log('displayBusinesses called with:', businesses?.length || 0, 'businesses'); // Debug log
    
    if (!businessesContainer) {
        console.error('businessesContainer element not found');
        return;
    }
    
    if (!businesses || businesses.length === 0) {
        console.log('No businesses to display');
        businessesContainer.innerHTML = `
            <tr>
                <td colspan="8" class="no-data">No businesses found</td>
            </tr>
        `;
        return;
    }
    
    console.log('Rendering', businesses.length, 'business rows'); // Debug log
    
    businessesContainer.innerHTML = businesses.map((business, index) => {
        const rowNumber = (currentPage - 1) * 20 + index + 1;
        return `
            <tr>
                <td class="row-number">${rowNumber}</td>
                <td class="business-name-cell">
                    <strong>${escapeHtml(business.name || 'N/A')}</strong>
                </td>
                <td class="rating-cell">
                    ${business.rating ? `
                        <div class="rating-display">
                            <span class="rating-stars">${getStarRating(business.rating)}</span>
                            <span class="rating-value">${business.rating}</span>
                        </div>
                    ` : '<span class="no-data">-</span>'}
                </td>
                <td class="review-cell">
                    ${business.reviewCount ? `<span>${business.reviewCount}</span>` : '<span class="no-data">-</span>'}
                </td>
                <td class="address-cell">
                    ${business.address ? `<span title="${escapeHtml(business.address)}">${truncateText(business.address, 50)}</span>` : '<span class="no-data">-</span>'}
                </td>
                <td class="phone-cell">
                    ${business.phone ? `<a href="tel:${business.phone}" class="phone-link">${business.phone}</a>` : '<span class="no-data">-</span>'}
                </td>
                <td class="website-cell">
                    ${business.website ? `<a href="${business.website}" target="_blank" rel="noopener noreferrer" class="website-link" title="${escapeHtml(business.website)}">${truncateText(business.website, 30)}</a>` : '<span class="no-data">-</span>'}
                </td>
                <td class="actions-cell">
                    ${business.placeUrl ? `
                        <a href="${business.placeUrl}" target="_blank" rel="noopener noreferrer" class="action-btn" title="View on Google Maps">
                            <i class="fas fa-external-link-alt"></i>
                        </a>
                    ` : '<span class="no-data">-</span>'}
                </td>
            </tr>
        `;
    }).join('');
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Helper function to truncate text
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return escapeHtml(text);
    return escapeHtml(text.substring(0, maxLength)) + '...';
}

// Get Star Rating HTML
function getStarRating(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let stars = '';
    for (let i = 0; i < fullStars; i++) {
        stars += '<i class="fas fa-star"></i>';
    }
    if (hasHalfStar) {
        stars += '<i class="fas fa-star-half-alt"></i>';
    }
    for (let i = 0; i < emptyStars; i++) {
        stars += '<i class="far fa-star"></i>';
    }
    
    return stars;
}

// Display Pagination
function displayPagination(paginationData) {
    if (!paginationData || !pagination) return;
    
    if (paginationData.pages <= 1) {
        pagination.classList.add('hidden');
        return;
    }
    
    pagination.classList.remove('hidden');
    
    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `
        <button onclick="changePage(${paginationData.page - 1})" ${paginationData.page === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i> Previous
        </button>
    `;
    
    // Page numbers
    const maxPages = 5;
    let startPage = Math.max(1, paginationData.page - Math.floor(maxPages / 2));
    let endPage = Math.min(paginationData.pages, startPage + maxPages - 1);
    
    if (endPage - startPage < maxPages - 1) {
        startPage = Math.max(1, endPage - maxPages + 1);
    }
    
    if (startPage > 1) {
        paginationHTML += `<button onclick="changePage(1)">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<button disabled>...</button>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button onclick="changePage(${i})" class="${i === paginationData.page ? 'active' : ''}">
                ${i}
            </button>
        `;
    }
    
    if (endPage < paginationData.pages) {
        if (endPage < paginationData.pages - 1) {
            paginationHTML += `<button disabled>...</button>`;
        }
        paginationHTML += `<button onclick="changePage(${paginationData.pages})">${paginationData.pages}</button>`;
    }
    
    // Next button
    paginationHTML += `
        <button onclick="changePage(${paginationData.page + 1})" ${paginationData.page === paginationData.pages ? 'disabled' : ''}>
            Next <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    if (pagination) {
        pagination.innerHTML = paginationHTML;
    }
}

// Change Page
function changePage(page) {
    currentPage = page;
    loadBusinesses(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Update Results Count
function updateResultsCount(paginationData) {
    if (!paginationData || !resultsCount) return;
    const start = (paginationData.page - 1) * paginationData.limit + 1;
    const end = Math.min(paginationData.page * paginationData.limit, paginationData.total);
    resultsCount.textContent = `${start}-${end} of ${paginationData.total}`;
}

// Show Notification
function showNotification(message, type = 'info') {
    // Simple alert for now, can be enhanced with a toast library
    if (type === 'error') {
        alert('❌ ' + message);
    } else {
        alert('✅ ' + message);
    }
}

