
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const puppeteer = require('puppeteer');
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


// Trending topics list
const trendingTopics = [
    {
        topic: 'Microgravity Effects on Biology',
        queries: [
            'cell biology microgravity',
            'tissue organ response space',
            'fluid dynamics microgravity'
        ]
    },
    {
        topic: 'Origin of Life & Prebiotic Chemistry',
        queries: [
            'abiogenesis',
            'organic molecules space',
            'planetary conditions for life'
        ]
    },
    {
        topic: 'Microbial Life in Space',
        queries: [
            'extremophiles space',
            'microbiome spacecraft',
            'planetary protection contamination'
        ]
    },
    {
        topic: 'Human Physiology in Space',
        queries: [
            'musculoskeletal degradation space',
            'cardiovascular changes space',
            'immune system space',
            'neurovestibular effects space'
        ]
    },
    {
        topic: 'Space Agriculture & Synthetic Biology',
        queries: [
            'plant growth space',
            'bioregenerative life support',
            'engineered microbes life support'
        ]
    },
    {
        topic: 'Neuroscience & Behavior in Space',
        queries: [
            'cognitive function space',
            'sleep circadian rhythms space',
            'stress response astronauts'
        ]
    },
    {
        topic: 'Planetary Environments & Habitability',
        queries: [
            'mars europa analog',
            'atmospheric composition planets',
            'radiation environments planets'
        ]
    },
    {
        topic: 'Space Radiation Biology',
        queries: [
            'DNA damage repair space',
            'shielding techniques space',
            'radiation effects reproduction'
        ]
    },
    {
        topic: 'Omics in Space (Genomics, Proteomics, etc.)',
        queries: [
            'transcriptomic response spaceflight',
            'epigenetics microgravity',
            'microbial gene expression ISS'
        ]
    },
    {
        topic: 'Experimental Platforms',
        queries: [
            'ISS-based experiments',
            'ground-based analogs space',
            'CubeSats biosatellites'
        ]
    },
    {
        topic: 'Bioinformatics & Modeling in Space Biology',
        queries: [
            'predictive models physiological change space',
            'simulation life-detection missions',
            'AI omics data space'
        ]
    },
    {
        topic: 'Earth Analogs for Astrobiology',
        queries: [
            'hydrothermal vents astrobiology',
            'Atacama desert astrobiology',
            'Antarctic dry valleys astrobiology'
        ]
    },
    {
        topic: 'Spaceflight Hazards & Mitigation',
        queries: [
            'fire safety toxicity space',
            'contamination control space',
            'biosecurity space labs'
        ]
    },
    {
        topic: 'Life Detection & Biosignatures',
        queries: [
            'remote sensing biosignatures',
            'non-Earth-centric biology',
            'spectral analysis exoplanets'
        ]
    },
    {
        topic: 'In-situ Resource Utilization (ISRU) Biology',
        queries: [
            'bioleaching asteroids',
            'biomining space',
            'bioconcrete space construction'
        ]
    }
];

// Helper: fetch trending papers for a query (most cited, recent)
async function fetchTrendingPapers(query, limit = 9, yearFrom = 2000) {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=title,authors,year,abstract,url,citationCount`;
    try {
        const response = await axios.get(url, { timeout: 10000 });
        if (!response.data || !response.data.data) return [];
        // Filter by year and sort by citationCount desc
        return response.data.data
            .filter(p => p.year && p.year >= yearFrom)
            .sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0))
            .slice(0, limit)
            .map(paper => ({
                title: paper.title || 'No title',
                link: paper.url || 'Not available',
                abstract: paper.abstract || 'No abstract available',
                authors: (paper.authors && paper.authors.length > 0) ? paper.authors.map(a => a.name).join(', ') : 'N/A',
                publishYear: paper.year || 'N/A',
                citationCount: paper.citationCount || 0,
                pdfLink: null
            }));
    } catch (error) {
        console.error('Trending fetch error:', error.message);
        return [];
    }
}


// Trending papers endpoint (POST): accepts keywords array from frontend
app.post('/api/trending-papers', async (req, res) => {
    try {
        const { keywords, limit = 3, yearFrom = 2020 } = req.body || {};
        if (!Array.isArray(keywords) || keywords.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Request body must include a non-empty "keywords" array.'
            });
        }
        const parsedLimit = parseInt(limit) || 3;
        const parsedYearFrom = parseInt(yearFrom) || 2020;
        // Fetch trending papers for each keyword in parallel
        const results = await Promise.all(keywords.map(async (keyword) => {
            try {
                const papers = await fetchTrendingPapers(keyword, parsedLimit, parsedYearFrom);
                return { keyword, papers };
            } catch (err) {
                return { keyword, papers: [], error: err.message };
            }
        }));
        res.json({
            success: true,
            yearFrom: parsedYearFrom,
            limit: parsedLimit,
            results
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch trending papers',
            message: error.message
        });
    }
});


// New endpoint: trending papers by keywords (array)
app.post('/api/trending-papers-by-keywords', async (req, res) => {
    try {
        const { keywords, limit = 3, yearFrom = 2020 } = req.body || {};
        if (!Array.isArray(keywords) || keywords.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Request body must include a non-empty "keywords" array.'
            });
        }
        const parsedLimit = parseInt(limit) || 3;
        const parsedYearFrom = parseInt(yearFrom) || 2020;
        // Fetch trending papers for each keyword in parallel
        const results = await Promise.all(keywords.map(async (keyword) => {
            try {
                const papers = await fetchTrendingPapers(keyword, parsedLimit, parsedYearFrom);
                return { keyword, papers };
            } catch (err) {
                return { keyword, papers: [], error: err.message };
            }
        }));
        res.json({
            success: true,
            yearFrom: parsedYearFrom,
            limit: parsedLimit,
            results
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch trending papers by keywords',
            message: error.message
        });
    }
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

// Helper: fetch and extract text from a URL (PDF or HTML)
async function fetchArticleText(url) {
    // Use a browser-like request to reduce being blocked or served minimal content
    const response = await axios.get(url, {
        responseType: 'text',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 15000,
        maxRedirects: 5
    });
    const contentType = response.headers['content-type'] || '';
    if (!contentType.includes('html')) {
        throw new Error('Only web articles (HTML) are supported for summarization.');
    }

    const html = response.data;
    // Try Readability first (best-effort for main article extraction)
    try {
        const dom = new JSDOM(html, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        if (article && article.textContent && article.textContent.trim().length >= 200) {
            // Prefer the Readability output
            const text = (article.title ? article.title + '\n\n' : '') + article.textContent;
            return text.replace(/\s+/g, ' ').trim();
        }
    } catch (e) {
        // swallow and fallback to cheerio
        console.warn('Readability extraction failed:', e.message);
    }

    // If Readability failed or content too small, try a headless browser to render JS-heavy pages
    try {
        const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
        const renderedHtml = await page.content();
        await browser.close();

        // Try Readability on rendered HTML
        try {
            const dom2 = new JSDOM(renderedHtml, { url });
            const reader2 = new Readability(dom2.window.document);
            const article2 = reader2.parse();
            if (article2 && article2.textContent && article2.textContent.trim().length >= 100) {
                const text2 = (article2.title ? article2.title + '\n\n' : '') + article2.textContent;
                return text2.replace(/\s+/g, ' ').trim();
            }
        } catch (e2) {
            console.warn('Readability on rendered HTML failed:', e2.message);
        }
        // Fallback to cheerio on rendered HTML
        const $render = cheerio.load(renderedHtml);
        let textRender = $render('article').text() || $render('main').text() || $render('#content').text();
        if (!textRender || textRender.trim().length < 100) {
            textRender = $render('body').find('*').not('script, style, noscript').map(function () { return $render(this).text(); }).get().join(' ');
        }
        textRender = textRender.replace(/\s+/g, ' ').trim();
        if (textRender && textRender.length >= 100) return textRender;
    } catch (puppErr) {
        console.warn('Puppeteer extraction failed or is unavailable:', puppErr.message);
    }

    // Fallback: cheerio selectors
    const $ = cheerio.load(html);
    let text =
        $('article').text() ||
        $('main').text() ||
        $('#content').text() ||
        $('.main-content').text() ||
        $('.post-content').text() ||
        $('.entry-content').text();
    if (!text || text.trim().length < 100) {
        text = $('body').find('*').not('script, style, noscript').map(function () {
            return $(this).text();
        }).get().join(' ');
    }
    text = text.replace(/\s+/g, ' ').trim();
    if (!text || text.length < 100) {
        throw new Error('Could not extract sufficient text from the article.');
    }
    return text;
}

// Helper: summarize text using OpenRouter LLM
async function summarizeWithOpenRouter(text) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('Missing OpenRouter API key');
    // Truncate text if too long for LLM
    const maxTokens = 8000; // adjust as needed for model
    // Ask for JSON output with interactive structure
    const prompt = `Summarize the following web article in an interactive, engaging way for a general science audience. Highlight key findings, methods, and implications. Respond in the following JSON format:\n\n{\n  \"summary\": \"A concise summary in plain English...\",\n  \"interactive\": {\n    \"questions\": [\"...\"],\n    \"key_points\": [\"...\"],\n    \"call_to_action\": \"...\"\n  }\n}\n\nArticle:\n${text.slice(0, 20000)}`;
    const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'openai/gpt-3.5-turbo',
        messages: [
            { role: 'system', content: 'You are a helpful scientific research summarizer.' },
            { role: 'user', content: prompt }
        ],
        max_tokens: maxTokens
    }, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    });
    const content = res.data.choices && res.data.choices[0] && res.data.choices[0].message && res.data.choices[0].message.content;
    if (!content) throw new Error('No summary returned from OpenRouter');
    // Try to parse as JSON
    let parsed = null;
    try {
        parsed = JSON.parse(content);
    } catch (e) {
        // fallback: try to extract JSON from markdown/code block
        const match = content.match(/\{[\s\S]*\}/);
        if (match) {
            try { parsed = JSON.parse(match[0]); } catch (e2) { parsed = null; }
        }
    }
    if (parsed && typeof parsed === 'object' && parsed.summary) {
        return parsed;
    } else {
        // fallback: return as plain summary
        return { summary: content, interactive: null };
    }
}

// POST /api/summarize-article: summarize a research article from a URL
app.post('/api/summarize-article', async (req, res) => {
    try {
        const { url } = req.body || {};
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ success: false, error: 'Missing or invalid "url" in request body.' });
        }
        // Fetch and extract article text
        const text = await fetchArticleText(url);
        if (!text || text.length < 100) {
            return res.status(400).json({ success: false, error: 'Could not extract sufficient text from the article.' });
        }
        // Summarize with OpenRouter
        const result = await summarizeWithOpenRouter(text);
        res.json({ success: true, url, ...result });
    } catch (error) {
        console.error('Summarization error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to summarize article', message: error.message });
    }
});

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
        const { keyword, limit = 30 } = body;

        // Validate input
        if (!keyword || typeof keyword !== 'string' || keyword.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Keyword is required and must be a non-empty string.'
            });
        }

        if (typeof limit !== 'number' || limit < 1) {
            return res.status(400).json({
                success: false,
                error: 'Limit must be a number greater than 0.'
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
