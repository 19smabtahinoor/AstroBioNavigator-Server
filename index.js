const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

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

// Main search function
async function searchGoogleScholar(keyword, numResults = 10) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const url = `https://scholar.google.com/scholar?q=${encodedKeyword}&hl=en`;

        // Make request with proper headers to avoid blocking
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const results = [];

        // Parse each search result
        $('.gs_r.gs_or.gs_scl').each((index, element) => {
            if (index >= numResults) return false; // Limit results

            const $element = $(element);

            // Extract title and link
            const titleElement = $element.find('.gs_rt');
            const title = titleElement.text().trim();
            const link = buildValidLink(titleElement.find('a').attr('href'));

            // Extract snippet (abstract/description)
            const snippet = $element.find('.gs_rs').text().trim().replace(/\n/g, ' ');

            // Extract publication info (contains authors, year, journal)
            const publicationInfo = $element.find('.gs_a').text().trim();

            // Extract authors and year
            const authors = extractAuthors(publicationInfo);
            const year = extractYear(publicationInfo);

            // Extract PDF link if available
            const pdfLink = buildValidLink($element.find('.gs_or_ggsm a').attr('href'));

            // Only add if we have at least a title
            if (title) {
                results.push({
                    title: title,
                    link: link || 'Not available',
                    abstract: snippet || 'No abstract available',
                    authors: authors,
                    publishYear: year || 'N/A',
                    publicationInfo: publicationInfo,
                    pdfLink: pdfLink
                });
            }
        });

        return results;
    } catch (error) {
        console.error('Error searching Google Scholar:', error.message);
        throw new Error('Failed to fetch results from Google Scholar');
    }
}

// API endpoint for searching papers
app.post('/api/search-papers', async (req, res) => {
    try {
        const { keyword, limit = 10 } = req.body;

        // Validate input
        if (!keyword || keyword.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Keyword is required'
            });
        }

        if (limit < 1 || limit > 20) {
            return res.status(400).json({
                success: false,
                error: 'Limit must be between 1 and 20'
            });
        }

        console.log(`Searching for: "${keyword}" with limit: ${limit}`);

        // Perform search
        const results = await searchGoogleScholar(keyword, limit);

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

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 Paper Search API is running!`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`📚 Endpoint: POST http://localhost:${PORT}/api/search-papers`);
    console.log(`❤️  Health: GET http://localhost:${PORT}/api/health\n`);
});
