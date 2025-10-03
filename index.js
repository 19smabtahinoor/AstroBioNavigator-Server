// index.js
// Paper Search + Summarization server using Semantic Scholar + Google Gemini
// - Summarization uses Google Generative Language API (Gemini model)
// - Fast extraction pipeline with Readability + cheerio
// - Search powered by Semantic Scholar API
// - No Supabase included
// - In-memory summarization jobs (polling)

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DEBUG = process.env.DEBUG === 'true' || false;

app.use(cors({ origin: "*", credentials: true, methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: ['text/*'], limit: '12mb' }));

if (DEBUG) app.use((req, res, next) => { console.log(`${req.method} ${req.path}`); next(); });

// --- Utils ---
function toPositiveInt(value, fallback) {
    const n = typeof value === 'number' ? value : parseInt(String(value || ''), 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 120;
async function waitForRateLimit() {
    const now = Date.now();
    const since = now - lastRequestTime;
    if (since < MIN_REQUEST_INTERVAL_MS) await new Promise(r => setTimeout(r, MIN_REQUEST_INTERVAL_MS - since));
    lastRequestTime = Date.now();
}

// --- Semantic Scholar search ---
async function searchSemanticScholar(keyword, numResults = 10) {
    if (!keyword) return [];
    await waitForRateLimit();
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(keyword)}&limit=${numResults}&fields=title,authors,year,abstract,url,citationCount`;
    const res = await axios.get(url, { timeout: 10000, headers: { 'User-Agent': 'PaperSearch/1.0' } });
    if (!res?.data?.data) return [];
    return res.data.data.map(p => ({
        title: p.title || 'No title',
        link: p.url || null,
        abstract: p.abstract || 'No abstract',
        authors: (p.authors || []).map(a => a.name).join(', ') || 'N/A',
        publishYear: p.year || 'N/A',
        citationCount: p.citationCount || 0
    }));
}

// --- Fetch article text (fast path) ---
async function fetchArticleTextFast(url) {
    const res = await axios.get(url, { timeout: 12000, responseType: 'text', maxRedirects: 5, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PaperSearch/1.0)' } });
    const ct = (res.headers['content-type'] || '').toLowerCase();
    if (!ct.includes('html')) throw new Error('Fast path supports only HTML articles');
    const html = res.data;
    try {
        const dom = new JSDOM(html, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        if (article && article.textContent && article.textContent.trim().length > 120) {
            return ((article.title || '') + '\n\n' + article.textContent).replace(/\s+/g, ' ').trim();
        }
    } catch (e) {
        if (DEBUG) console.warn('Readability failed:', e.message);
    }
    const $ = cheerio.load(html);
    let text = $('article').text() || $('main').text() || $('#content').text() || $('body').text();
    text = (text || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length < 120) throw new Error('Insufficient text extracted');
    return text;
}

// --- Gemini integration ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAIRB1OkjBwUZzj85uarPbRDd8cpx0bRfI';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'models/gemini-1.5-mini';

async function callGeminiSummarize(prompt, maxOutputTokens = 800) {
    if (!GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY');
    const url = `https://generativelanguage.googleapis.com/v1beta2/${GEMINI_MODEL}:generate?key=${GEMINI_API_KEY}`;
    const body = {
        prompt: { text: prompt },
        maxOutputTokens,
        temperature: 0.15,
        topP: 0.95
    };
    const res = await axios.post(url, body, { timeout: 20000 });
    const candidates = res.data?.candidates || [];
    if (candidates.length > 0) return candidates.map(c => c.output).join('\n\n');
    if (res.data?.output) return res.data.output;
    throw new Error('No output from Gemini');
}

// --- Summarization jobs ---
const summarizationJobs = new Map();
function createJob(url, fastSummary = null) {
    const id = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const job = { id, status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), url, fastSummary, result: null, error: null };
    summarizationJobs.set(id, job);
    return job;
}

async function processJob(job) {
    job.status = 'processing'; job.updatedAt = new Date().toISOString();
    try {
        let text = await fetchArticleTextFast(job.url);
        const maxPromptChars = 28000;
        if (text.length > maxPromptChars) text = text.slice(0, maxPromptChars);
        const instruction = `You are an expert academic summarizer. Provide a detailed, structured summary of the article below. Include: (1) Main objective, (2) Methods, (3) Key results/findings with specifics, (4) Conclusions and implications, (5) Any limitations mentioned. Keep it concise but complete; use subheadings.`;
        const prompt = `${instruction}\n\nArticle:\n${text}`;
        const geminiOutput = await callGeminiSummarize(prompt, 800);
        job.result = geminiOutput;
        job.status = 'done';
        job.updatedAt = new Date().toISOString();
    } catch (err) {
        job.error = err.message || String(err);
        job.status = 'failed';
        job.updatedAt = new Date().toISOString();
    }
}

// --- Routes ---
app.get('/api/health', (req, res) => res.json({ success: true, ts: new Date().toISOString() }));

app.post('/api/search-papers', async (req, res) => {
    try {
        const body = req.body || {};
        const keyword = (typeof body === 'string' && body.trim()) ? body.trim() : (body.keyword || '').toString();
        if (!keyword) return res.status(400).json({ success: false, error: 'Keyword required' });
        const limit = Math.min(100, toPositiveInt(body.limit, 10));
        const results = await searchSemanticScholar(keyword, limit);
        return res.json({ success: true, keyword, totalResults: results.length, papers: results });
    } catch (err) {
        console.error('/api/search-papers', err.message || err);
        if (err.response?.status === 429 || (err.message || '').toLowerCase().includes('rate limit')) {
            return res.status(429).json({ success: false, error: 'Rate limited by Semantic Scholar. Try again in a bit.' });
        }
        return res.status(500).json({ success: false, error: err.message || 'Search failed' });
    }
});

app.post('/api/trending-papers', async (req, res) => {
    try {
        const { keywords, limit = 3 } = req.body || {};
        if (!Array.isArray(keywords) || keywords.length === 0) return res.status(400).json({ success: false, error: 'keywords must be a non-empty array' });
        const parsedLimit = Math.min(20, toPositiveInt(limit, 3));
        const promises = keywords.map(k => searchSemanticScholar(k, parsedLimit).then(papers => ({ keyword: k, papers })).catch(e => ({ keyword: k, papers: [], error: e.message })));
        const results = await Promise.all(promises);
        return res.json({ success: true, results });
    } catch (err) {
        console.error('/api/trending-papers', err.message || err);
        return res.status(500).json({ success: false, error: err.message || 'Failed' });
    }
});

app.post('/api/summarize-article', async (req, res) => {
    try {
        let url = null;
        if (typeof req.body === 'string' && req.body.trim().startsWith('http')) url = req.body.trim();
        else if (req.body && typeof req.body === 'object' && req.body.url) url = req.body.url;
        if (!url) return res.status(400).json({ success: false, error: 'Missing or invalid url' });

        let fastText;
        try { fastText = await fetchArticleTextFast(url); }
        catch (e) { return res.status(400).json({ success: false, error: 'Fast extraction failed: ' + e.message }); }

        const fastSummary = (() => {
            const sentences = fastText.match(/[^.!?]+[.!?]+/g) || [fastText];
            return sentences.slice(0, 3).map(s => s.trim()).join(' ');
        })();

        const job = createJob(url, fastSummary);
        process.nextTick(() => processJob(job));

        return res.json({ success: true, url, fastSummary, jobId: job.id, message: 'Fast summary returned. Poll /api/summarize-status/:jobId for full Gemini summary.' });
    } catch (err) {
        console.error('/api/summarize-article', err.message || err);
        return res.status(500).json({ success: false, error: err.message || 'Failed' });
    }
});

app.get('/api/summarize-status/:jobId', (req, res) => {
    const job = summarizationJobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    return res.json({ success: true, job });
});

app.use((req, res) => res.status(404).json({ success: false, error: 'Not found' }));

app.listen(PORT, () => console.log(`\n🚀 Server running on http://localhost:${PORT} (Gemini model: ${GEMINI_MODEL})\n`));
