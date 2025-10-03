
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
const { getSupabaseClient } = require('./supabaseClient');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
// Body parsers: JSON, urlencoded (form) and plain text
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: ['text/*'], limit: '10mb' }));
// Error handler for JSON parse errors (must come after parsers)
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            success: false,
            error: 'Malformed JSON in request body.'
        });
    }
    next();
});

// Custom middleware to reject missing/invalid Content-Type for JSON endpoints
// Tolerant: allow application/json, application/x-www-form-urlencoded, text/*, or a parsed body containing a 'url' field.
app.use((req, res, next) => {
    if ((req.method === 'POST' || req.method === 'PUT') && req.path.startsWith('/api/')) {
        const contentType = (req.headers['content-type'] || '').toLowerCase();
        const okTypes = ['application/json', 'application/x-www-form-urlencoded'];
        const hasAcceptableType = okTypes.some(t => contentType.includes(t)) || contentType.startsWith('text/');
        // If content-type is missing/unknown but body contains a url, allow it (helps some clients)
        if (!hasAcceptableType && !(req.body && (typeof req.body === 'object' && req.body.url) || (typeof req.body === 'string' && req.body.trim().startsWith('http')))) {
            return res.status(400).json({
                success: false,
                error: 'Missing or invalid Content-Type header. Please use application/json or application/x-www-form-urlencoded, or send the URL as the raw text body.'
            });
        }
    }
    next();
});
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
    await waitForRateLimit();

    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=title,authors,year,abstract,url,citationCount`;
    try {
        const response = await axios.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'AstroBioNavigator/1.0'
            }
        });
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
        if (error.response?.status === 429) {
            throw new Error('Rate limit exceeded for trending papers');
        }
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
    const maxTokens = 2000; // Increased for longer summaries
    // Ask for comprehensive detailed summary
    const prompt = `Please provide a comprehensive and detailed summary of the following scientific article. Your summary should be thorough and substantial, including:

1. **Main Purpose/Objective**: What the article aims to achieve or investigate
2. **Key Findings & Results**: All important discoveries, data, and outcomes
3. **Methodology & Approach**: How the research was conducted (if applicable)
4. **Significant Details**: Important statistics, evidence, examples, and supporting information
5. **Implications & Significance**: What these findings mean for the field
6. **Conclusions & Future Directions**: Final takeaways and recommended next steps

Make this a detailed, informative summary that captures the full scope and depth of the article. Aim for at least 3-4 substantial paragraphs that give readers a complete understanding of the content.

Article to summarize:
${text.slice(0, 25000)}`;

    const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'openai/gpt-3.5-turbo',
        messages: [
            { role: 'system', content: 'You are an expert scientific research summarizer who creates comprehensive, detailed summaries for academic and research purposes.' },
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

    // Return the comprehensive summary as plain text
    return content.trim();
}

// Helper function to validate and normalize summary results
// Lightweight fast extraction (no Puppeteer) to return a quick preview summary.
async function fetchArticleTextFast(url) {
    // Similar to fetchArticleText but skip Puppeteer and any heavy rendering.
    const response = await axios.get(url, {
        responseType: 'text',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 10000,
        maxRedirects: 3
    });
    const contentType = response.headers['content-type'] || '';
    if (!contentType.includes('html')) {
        throw new Error('Only web articles (HTML) are supported for summarization.');
    }
    const html = response.data;
    try {
        const dom = new JSDOM(html, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        if (article && article.textContent && article.textContent.trim().length >= 120) {
            const text = (article.title ? article.title + '\n\n' : '') + article.textContent;
            return text.replace(/\s+/g, ' ').trim();
        }
    } catch (e) {
        // ignore and fallback to cheerio
    }
    const $ = cheerio.load(html);
    let text = $('article').text() || $('main').text() || $('#content').text() || $('.post-content').text() || $('.entry-content').text();
    if (!text || text.trim().length < 100) {
        text = $('body').find('*').not('script, style, noscript').map(function () { return $(this).text(); }).get().join(' ');
    }
    text = text.replace(/\s+/g, ' ').trim();
    if (!text || text.length < 120) throw new Error('Could not extract sufficient text from the article (fast path).');
    return text;
}

// Simple extractive summarizer: return first N sentences (fast)
function extractiveSummary(text, maxSentences = 3) {
    if (!text) return '';
    // split into sentences naively
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const picked = sentences.slice(0, maxSentences).map(s => s.trim());
    return picked.join(' ');
}

// In-memory job store for background summarization
const summarizationJobs = new Map();

function createJob(payload) {
    const id = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const job = {
        id,
        status: 'pending', // pending | processing | done | failed
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        url: payload.url,
        fastSummary: payload.fastSummary || null,
        result: null,
        error: null
    };
    summarizationJobs.set(id, job);
    return job;
}

async function processJob(job) {
    job.status = 'processing';
    job.updatedAt = new Date().toISOString();
    try {
        // Attempt full extraction using the heavier pipeline (which may use Puppeteer)
        let fullText = null;
        try {
            fullText = await fetchArticleText(job.url);
        } catch (e) {
            // fallback: try fast path again
            console.warn('[processJob] fetchArticleText failed, trying fast path:', e.message);
            fullText = await fetchArticleTextFast(job.url);
        }
        const fullResult = await summarizeWithOpenRouter(fullText);
        job.result = fullResult;
        job.status = 'done';
        job.updatedAt = new Date().toISOString();
    } catch (err) {
        console.error('[processJob] summarization failed:', err.message || err);
        job.error = err.message || String(err);
        job.status = 'failed';
        job.updatedAt = new Date().toISOString();
    }
}

// POST /api/summarize-article: summarize a research article from a URL
app.post('/api/summarize-article', async (req, res) => {
    try {
        // Accept either JSON { url: 'https://...' } or a plain text body containing the URL
        let url = null;
        if (req.body) {
            if (typeof req.body === 'string') {
                const trimmed = req.body.trim();
                if (trimmed.startsWith('http')) url = trimmed;
            } else if (typeof req.body === 'object' && req.body.url) {
                url = req.body.url;
            }
        }
        if (!url || typeof url !== 'string' || !url.startsWith('http')) {
            return res.status(400).json({ success: false, error: 'Missing or invalid "url" in request body. Send JSON {"url": "https://..."} or raw text body with the URL.' });
        }
        // Fast path: extract text quickly (no Puppeteer) and return extractive summary immediately
        let fastText;
        try {
            fastText = await fetchArticleTextFast(url);
        } catch (fastErr) {
            console.warn('Fast extraction failed:', fastErr.message);
            // as fallback, try the heavy extraction once to avoid failing fast for sites that need rendering
            try {
                fastText = await fetchArticleText(url);
            } catch (heavyErr) {
                console.error('Heavy extraction also failed:', heavyErr.message);
                return res.status(400).json({ success: false, error: 'Could not extract sufficient text from the article.' });
            }
        }

        const fastSummary = extractiveSummary(fastText, 3);

        // Create a background job to produce a full LLM summary and store state in memory
        const job = createJob({ url, fastSummary });
        // Schedule processing (fire-and-forget)
        process.nextTick(() => processJob(job));

        // Return fast summary and job id immediately
        res.json({ success: true, url, fastSummary, jobId: job.id, message: 'Fast summary returned. Full summary is being generated in background; poll /api/summarize-status/:jobId' });
    } catch (error) {
        console.error('Summarization error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to summarize article', message: error.message });
    }
});

// Polling endpoint for background summarization job status/result
app.get('/api/summarize-status/:jobId', (req, res) => {
    const jobId = req.params.jobId;
    const job = summarizationJobs.get(jobId);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    res.json({ success: true, job });
});

// Rate limiting helper
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

async function waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastRequestTime = Date.now();
}

// Main search function using Semantic Scholar API with retry logic
async function searchSemanticScholar(keyword, numResults = 10, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await waitForRateLimit();

            const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(keyword)}&limit=${numResults}&fields=title,authors,year,abstract,url`;
            const response = await axios.get(url, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'AstroBioNavigator/1.0'
                }
            });

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
            console.error(`Attempt ${attempt} failed:`, error.message);

            if (error.response?.status === 429) {
                if (attempt === retries) {
                    throw new Error('Rate limit exceeded. Please wait a few minutes before trying again.');
                }
                // Exponential backoff for rate limit errors
                const backoffTime = Math.pow(2, attempt) * 2000; // 4s, 8s, 16s
                console.log(`Rate limited. Waiting ${backoffTime}ms before retry ${attempt + 1}...`);
                await new Promise(resolve => setTimeout(resolve, backoffTime));
                continue;
            }

            if (attempt === retries) {
                throw new Error(error.message || 'Failed to fetch results from Semantic Scholar');
            }

            // Wait before retry for other errors
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
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

        // Handle specific error types
        if (error.message.includes('Rate limit exceeded')) {
            return res.status(429).json({
                success: false,
                error: 'Rate limit exceeded',
                message: 'Too many requests. Please wait a few minutes before trying again.',
                retryAfter: 300 // seconds
            });
        }

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

// Supabase-backed endpoints for profiles table
app.get('/api/profiles', async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) return res.status(503).json({ success: false, error: 'Supabase not configured on server.' });

        const { data, error } = await supabase.from('profiles').select('*').limit(100);
        if (error) {
            console.error('Supabase error (profiles):', error.message || error);
            return res.status(500).json({ success: false, error: 'Failed to fetch profiles from Supabase', details: error.message || error });
        }
        res.json({ success: true, count: (data || []).length, profiles: data });
    } catch (err) {
        console.error('Profiles fetch error:', err.message || err);
        res.status(500).json({ success: false, error: 'Internal server error', message: err.message });
    }
});

app.get('/api/profiles/:id', async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) return res.status(503).json({ success: false, error: 'Supabase not configured on server.' });

        const id = req.params.id;
        const { data, error } = await supabase.from('profiles').select('*').eq('id', id).limit(1).single();
        if (error) {
            console.error('Supabase error (profile by id):', error.message || error);
            return res.status(500).json({ success: false, error: 'Failed to fetch profile', details: error.message || error });
        }
        if (!data) return res.status(404).json({ success: false, error: 'Profile not found' });
        res.json({ success: true, profile: data });
    } catch (err) {
        console.error('Profile fetch error:', err.message || err);
        res.status(500).json({ success: false, error: 'Internal server error', message: err.message });
    }
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
