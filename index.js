const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
// Custom middleware to reject missing/invalid Content-Type for JSON endpoints
app.use((req, res, next) => {
    if ((req.method === 'POST' || req.method === 'PUT') && req.path.startsWith('/api/')) {
        const contentType = req.headers['content-type'] || '';
        if (!contentType.includes('application/json')) {
            return res.status(400).json({
                success: false,
                error: 'Missing or invalid Content-Type header. Please use application/json.'
            });
        }
    }
    next();
});
// JSON body parser with error handler
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// Error handler for JSON parse errors
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            success: false,
            error: 'Malformed JSON in request body.'
        });
    }
    next();
});
// Additional middleware for debugging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    console.log('Headers:', req.headers);
    next();
});

// Helper function to build valid links
function buildValidLink(rawLink, domain = 'https://scholar.google.com') {
    if (!rawLink || rawLink.includes('javascript:void(0)')) {
        return null;
    }
    if (rawLink.startsWith('http')) {
        return rawLink;
    }
    return domain + rawLink;
}

// Helper function to extract year from publication info
function extractYear(publicationInfo) {
    if (!publicationInfo) return null;
    const yearMatch = publicationInfo.match(/\b(19|20)\d{2}\b/);
    return yearMatch ? yearMatch[0] : null;
}

// Helper function to extract authors from publication info
function extractAuthors(publicationInfo) {
    if (!publicationInfo) return 'N/A';
    // Authors are typically before the first dash or comma followed by journal name
    const parts = publicationInfo.split(' - ');
    if (parts.length > 0) {
        return parts[0].trim();
    }
    return 'N/A';
}


// Main search function using Semantic Scholar API
async function searchSemanticScholar(keyword, numResults = 10) {
    try {
        const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(keyword)}&limit=${numResults}&fields=title,authors,year,abstract,url`;
        const response = await axios.get(url, { timeout: 10000 });
        if (!response.data || !response.data.data) {
            return [];
        }
        return response.data.data.map(paper => ({
            title: paper.title || 'No title',
            link: paper.url || 'Not available',
            abstract: paper.abstract || 'No abstract available',
            authors: (paper.authors && paper.authors.length > 0) ? paper.authors.map(a => a.name).join(', ') : 'N/A',
            publishYear: paper.year || 'N/A',
            publicationInfo: '',
            pdfLink: null
        }));
    } catch (error) {
        console.error('Error searching Semantic Scholar:', error.message);
        throw new Error(error.message || 'Failed to fetch results from Semantic Scholar');
    }
}

// API endpoint for searching papers
app.post('/api/search-papers', async (req, res) => {
    try {
        // Debug logging
        console.log('Content-Type:', req.get('Content-Type'));
        console.log('Raw body:', req.body);
        console.log('Body type:', typeof req.body);

        // Fallback: if req.body is undefined, set to empty object
        const body = req.body || {};
        const { keyword, limit = 10 } = body;

        // Validate input
        if (!keyword || typeof keyword !== 'string' || keyword.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Keyword is required and must be a non-empty string.'
            });
        }

        if (typeof limit !== 'number' || limit < 1 || limit > 20) {
            return res.status(400).json({
                success: false,
                error: 'Limit must be a number between 1 and 20.'
            });
        }

        console.log(`Searching for: "${keyword}" with limit: ${limit}`);

        // Perform search using Semantic Scholar
        const results = await searchSemanticScholar(keyword, limit);

        if (!results || results.length === 0) {
            return res.json({
                success: true,
                keyword: keyword,
                totalResults: 0,
                papers: [],
                message: 'No papers found. Try a different keyword.'
            });
        }

        // Send response
        res.json({
            success: true,
            keyword: keyword,
            totalResults: results.length,
            papers: results
        });

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search papers',
            message: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'API is running',
        timestamp: new Date().toISOString()
    });
});

// Test endpoint for debugging POST requests
app.post('/api/test', (req, res) => {
    console.log('Test endpoint - Headers:', req.headers);
    console.log('Test endpoint - Body:', req.body);
    console.log('Test endpoint - Body type:', typeof req.body);

    res.json({
        success: true,
        received: {
            headers: req.headers,
            body: req.body,
            bodyType: typeof req.body
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 Paper Search API is running!`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`📚 Endpoint: POST http://localhost:${PORT}/api/search-papers`);
    console.log(`❤️  Health: GET http://localhost:${PORT}/api/health\n`);
});
