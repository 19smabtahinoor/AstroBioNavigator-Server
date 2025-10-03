# AstroBioNavigator Server API

A powerful academic paper search and summarization API powered by Semantic Scholar and Google Gemini AI. This server provides fast paper discovery and intelligent summarization for academic research.

## 🚀 Live API

**Base URL:** `https://astro-bio-navigator-server.vercel.app`

## ✨ Features

- **Academic Paper Search**: Search through millions of academic papers using Semantic Scholar API
- **AI-Powered Summarization**: Intelligent paper summarization using Google Gemini
- **Fast Content Extraction**: Quick article text extraction with Mozilla Readability
- **Rate Limited**: Built-in rate limiting for API stability
- **CORS Enabled**: Ready for web and mobile app integration

## 📚 API Endpoints

### 1. Health Check

Check if the API is running properly.

```http
GET /api/health
```

**Response:**

```json
{
  "success": true,
  "ts": "2024-10-04T10:30:00.000Z"
}
```

### 2. Search Papers

Search for academic papers by keyword using Semantic Scholar.

```http
POST /api/search-papers
```

**Request Body:**

```json
{
  "keyword": "machine learning",
  "limit": 10
}
```

**Parameters:**

- `keyword` (string, required): Search term for academic papers
- `limit` (number, optional): Number of results to return (default: 30, max: 100)

**Response:**

```json
{
  "success": true,
  "keyword": "machine learning",
  "totalResults": 10,
  "papers": [
    {
      "title": "Deep Learning for Computer Vision",
      "link": "https://example.com/paper-url",
      "abstract": "This paper presents a comprehensive study...",
      "authors": "John Doe, Jane Smith",
      "publishYear": 2023,
      "citationCount": 150
    }
  ]
}
```

### 3. Trending Papers

Search for papers across multiple keywords simultaneously.

```http
POST /api/trending-papers
```

**Request Body:**

```json
{
  "keywords": ["artificial intelligence", "neural networks", "deep learning"],
  "limit": 5
}
```

**Parameters:**

- `keywords` (array, required): Array of search terms
- `limit` (number, optional): Number of results per keyword (default: 3, max: 20)

**Response:**

```json
{
  "success": true,
  "results": [
    {
      "keyword": "artificial intelligence",
      "papers": [...]
    },
    {
      "keyword": "neural networks",
      "papers": [...]
    }
  ]
}
```

### 4. Summarize Article

Generate AI-powered summaries of academic papers or articles.

```http
POST /api/summarize-article
```

**Request Body:**

```json
{
  "url": "https://example.com/article-url"
}
```

**Parameters:**

- `url` (string, required): URL of the article to summarize

**Response:**

```json
{
  "success": true,
  "url": "https://example.com/article-url",
  "fastSummary": "Quick 3-sentence summary...",
  "jobId": "1728123456789-12345",
  "message": "Fast summary returned. Poll /api/summarize-status/:jobId for full Gemini summary."
}
```

### 5. Check Summarization Status

Poll for the completion status of a summarization job.

```http
GET /api/summarize-status/:jobId
```

**Response (Processing):**

```json
{
  "success": true,
  "job": {
    "id": "1728123456789-12345",
    "status": "processing",
    "createdAt": "2024-10-04T10:30:00.000Z",
    "updatedAt": "2024-10-04T10:30:15.000Z",
    "url": "https://example.com/article-url",
    "fastSummary": "Quick summary...",
    "result": null,
    "error": null
  }
}
```

**Response (Completed):**

```json
{
  "success": true,
  "job": {
    "id": "1728123456789-12345",
    "status": "done",
    "createdAt": "2024-10-04T10:30:00.000Z",
    "updatedAt": "2024-10-04T10:31:00.000Z",
    "url": "https://example.com/article-url",
    "fastSummary": "Quick summary...",
    "result": "## Main Objective\n\nThis study aims to...\n\n## Methods\n\n...",
    "error": null
  }
}
```

## 📱 Flutter Integration

### Setup HTTP Client

Add the http package to your `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  http: ^1.1.0
```

### API Service Class

Create an API service class for your Flutter app:

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class AstroBioNavigatorAPI {
  static const String baseUrl = 'https://astro-bio-navigator-server.vercel.app';

  // Search for academic papers
  static Future<Map<String, dynamic>> searchPapers({
    required String keyword,
    int limit = 10,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/search-papers'),
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'keyword': keyword,
          'limit': limit,
        }),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Failed to search papers: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error searching papers: $e');
    }
  }

  // Get trending papers for multiple keywords
  static Future<Map<String, dynamic>> getTrendingPapers({
    required List<String> keywords,
    int limit = 3,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/trending-papers'),
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'keywords': keywords,
          'limit': limit,
        }),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Failed to get trending papers: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error getting trending papers: $e');
    }
  }

  // Start article summarization
  static Future<Map<String, dynamic>> summarizeArticle(String url) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/summarize-article'),
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'url': url,
        }),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Failed to start summarization: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error starting summarization: $e');
    }
  }

  // Check summarization status
  static Future<Map<String, dynamic>> getSummarizationStatus(String jobId) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/summarize-status/$jobId'),
        headers: {
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Failed to get status: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error getting status: $e');
    }
  }

  // Health check
  static Future<bool> healthCheck() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/health'),
      );
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }
}
```

### Data Models

Create data models for your Flutter app:

```dart
// models/paper.dart
class Paper {
  final String title;
  final String? link;
  final String abstract;
  final String authors;
  final dynamic publishYear;
  final int citationCount;

  Paper({
    required this.title,
    this.link,
    required this.abstract,
    required this.authors,
    required this.publishYear,
    required this.citationCount,
  });

  factory Paper.fromJson(Map<String, dynamic> json) {
    return Paper(
      title: json['title'] ?? 'No title',
      link: json['link'],
      abstract: json['abstract'] ?? 'No abstract',
      authors: json['authors'] ?? 'N/A',
      publishYear: json['publishYear'] ?? 'N/A',
      citationCount: json['citationCount'] ?? 0,
    );
  }
}

// models/summarization_job.dart
class SummarizationJob {
  final String id;
  final String status;
  final String createdAt;
  final String updatedAt;
  final String url;
  final String? fastSummary;
  final String? result;
  final String? error;

  SummarizationJob({
    required this.id,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    required this.url,
    this.fastSummary,
    this.result,
    this.error,
  });

  factory SummarizationJob.fromJson(Map<String, dynamic> json) {
    return SummarizationJob(
      id: json['id'],
      status: json['status'],
      createdAt: json['createdAt'],
      updatedAt: json['updatedAt'],
      url: json['url'],
      fastSummary: json['fastSummary'],
      result: json['result'],
      error: json['error'],
    );
  }

  bool get isCompleted => status == 'done';
  bool get isFailed => status == 'failed';
  bool get isProcessing => status == 'processing';
}
```

### Usage Examples

#### 1. Search Papers Screen

```dart
import 'package:flutter/material.dart';

class PaperSearchScreen extends StatefulWidget {
  @override
  _PaperSearchScreenState createState() => _PaperSearchScreenState();
}

class _PaperSearchScreenState extends State<PaperSearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  List<Paper> _papers = [];
  bool _isLoading = false;

  Future<void> _searchPapers() async {
    if (_searchController.text.trim().isEmpty) return;

    setState(() {
      _isLoading = true;
    });

    try {
      final result = await AstroBioNavigatorAPI.searchPapers(
        keyword: _searchController.text.trim(),
        limit: 20,
      );

      if (result['success']) {
        setState(() {
          _papers = (result['papers'] as List)
              .map((paper) => Paper.fromJson(paper))
              .toList();
        });
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Paper Search')),
      body: Column(
        children: [
          Padding(
            padding: EdgeInsets.all(16.0),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search for papers...',
                suffixIcon: IconButton(
                  icon: Icon(Icons.search),
                  onPressed: _searchPapers,
                ),
              ),
              onSubmitted: (_) => _searchPapers(),
            ),
          ),
          Expanded(
            child: _isLoading
                ? Center(child: CircularProgressIndicator())
                : ListView.builder(
                    itemCount: _papers.length,
                    itemBuilder: (context, index) {
                      final paper = _papers[index];
                      return Card(
                        margin: EdgeInsets.all(8.0),
                        child: ListTile(
                          title: Text(paper.title),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Authors: ${paper.authors}'),
                              Text('Year: ${paper.publishYear}'),
                              Text('Citations: ${paper.citationCount}'),
                              SizedBox(height: 4),
                              Text(
                                paper.abstract,
                                maxLines: 3,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                          onTap: () {
                            if (paper.link != null) {
                              // Navigate to summarization screen
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) => SummarizationScreen(
                                    url: paper.link!,
                                    title: paper.title,
                                  ),
                                ),
                              );
                            }
                          },
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
```

#### 2. Article Summarization Screen

```dart
import 'dart:async';
import 'package:flutter/material.dart';

class SummarizationScreen extends StatefulWidget {
  final String url;
  final String title;

  SummarizationScreen({required this.url, required this.title});

  @override
  _SummarizationScreenState createState() => _SummarizationScreenState();
}

class _SummarizationScreenState extends State<SummarizationScreen> {
  SummarizationJob? _job;
  Timer? _pollTimer;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _startSummarization();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _startSummarization() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final result = await AstroBioNavigatorAPI.summarizeArticle(widget.url);

      if (result['success']) {
        setState(() {
          _job = SummarizationJob(
            id: result['jobId'],
            status: 'processing',
            createdAt: DateTime.now().toIso8601String(),
            updatedAt: DateTime.now().toIso8601String(),
            url: widget.url,
            fastSummary: result['fastSummary'],
          );
        });

        // Start polling for completion
        _startPolling();
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _startPolling() {
    _pollTimer = Timer.periodic(Duration(seconds: 3), (timer) async {
      if (_job == null || _job!.isCompleted || _job!.isFailed) {
        timer.cancel();
        return;
      }

      try {
        final result = await AstroBioNavigatorAPI.getSummarizationStatus(_job!.id);

        if (result['success']) {
          setState(() {
            _job = SummarizationJob.fromJson(result['job']);
          });

          if (_job!.isCompleted || _job!.isFailed) {
            timer.cancel();
          }
        }
      } catch (e) {
        print('Polling error: $e');
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Article Summary')),
      body: Padding(
        padding: EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.title,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            SizedBox(height: 16),

            if (_isLoading)
              Center(child: CircularProgressIndicator())
            else if (_job != null) ...[
              // Fast Summary
              if (_job!.fastSummary != null) ...[
                Text(
                  'Quick Summary:',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                SizedBox(height: 8),
                Card(
                  child: Padding(
                    padding: EdgeInsets.all(12.0),
                    child: Text(_job!.fastSummary!),
                  ),
                ),
                SizedBox(height: 16),
              ],

              // Status
              Row(
                children: [
                  Text('Status: '),
                  Chip(
                    label: Text(_job!.status.toUpperCase()),
                    backgroundColor: _job!.isCompleted
                        ? Colors.green
                        : _job!.isFailed
                            ? Colors.red
                            : Colors.orange,
                  ),
                ],
              ),
              SizedBox(height: 16),

              // Full Summary (when completed)
              if (_job!.isCompleted && _job!.result != null) ...[
                Text(
                  'Detailed AI Summary:',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                SizedBox(height: 8),
                Expanded(
                  child: SingleChildScrollView(
                    child: Card(
                      child: Padding(
                        padding: EdgeInsets.all(12.0),
                        child: Text(_job!.result!),
                      ),
                    ),
                  ),
                ),
              ]

              // Error (when failed)
              else if (_job!.isFailed && _job!.error != null) ...[
                Text(
                  'Error:',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                SizedBox(height: 8),
                Card(
                  color: Colors.red.shade50,
                  child: Padding(
                    padding: EdgeInsets.all(12.0),
                    child: Text(_job!.error!),
                  ),
                ),
              ]

              // Processing
              else if (_job!.isProcessing) ...[
                Center(
                  child: Column(
                    children: [
                      CircularProgressIndicator(),
                      SizedBox(height: 16),
                      Text('Generating detailed summary...'),
                    ],
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}
```

## 🔧 Error Handling

The API returns structured error responses:

```json
{
  "success": false,
  "error": "Error message description"
}
```

Common error codes:

- `400`: Bad request (missing parameters)
- `404`: Resource not found
- `429`: Rate limit exceeded
- `500`: Internal server error

## 🚀 Rate Limiting

The API implements rate limiting to ensure stability:

- Minimum 120ms between requests to Semantic Scholar
- Built-in retry mechanisms
- Graceful degradation under high load

## 🔑 Environment Variables

The server requires the following environment variables:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=models/gemini-1.5-mini
PORT=3000
DEBUG=false
```

## 📦 Dependencies

- **express**: Web framework
- **axios**: HTTP client
- **cheerio**: HTML parsing
- **jsdom**: DOM implementation
- **@mozilla/readability**: Content extraction
- **cors**: Cross-origin resource sharing

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 📞 Support

For support and questions, please open an issue in the GitHub repository.

---

Built with ❤️ for the academic research community
