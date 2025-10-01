# Astro Bio Navigator - Server API

A Node.js server that provides academic paper search functionality by scraping Google Scholar. This API allows you to search for academic papers related to astronomy, biology, and other scientific fields.

## 🚀 Server Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
```

### Running the Server

```bash
node index.js
```

The server will start on `http://localhost:3000`

## 📚 API Endpoints

### 1. Health Check

**GET** `/api/health`

Check if the API is running.

**Response:**

```json
{
  "success": true,
  "status": "API is running",
  "timestamp": "2025-10-02T10:30:00.000Z"
}
```

### 2. Search Papers

**POST** `/api/search-papers`

Search for academic papers on Google Scholar.

## 📋 API Request Guidelines

### Request Format

- **Method:** POST
- **Content-Type:** application/json
- **URL:** `http://localhost:3000/api/search-papers`

### Required Data Structure

```json
{
  "keyword": "string (required)",
  "limit": "number (optional, default: 10, max: 20)"
}
```

#### Parameters:

- `keyword` (string, required): The search term for academic papers
  - Must not be empty or only whitespace
  - Examples: "black holes", "protein folding", "climate change"
- `limit` (number, optional): Number of results to return
  - Default: 10
  - Range: 1-20
  - Invalid values will return an error

### Example Request Body:

```json
{
  "keyword": "exoplanets habitability",
  "limit": 15
}
```

## 📤 API Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "keyword": "exoplanets habitability",
  "totalResults": 15,
  "papers": [
    {
      "title": "The habitability of exoplanets around red dwarf stars",
      "link": "https://example.com/paper-link",
      "abstract": "This paper discusses the potential for life on exoplanets...",
      "authors": "Smith, J., Johnson, A., et al.",
      "publishYear": "2023",
      "publicationInfo": "Smith, J., Johnson, A. - Nature Astronomy, 2023",
      "pdfLink": "https://example.com/pdf-link"
    }
  ]
}
```

### Error Responses

#### 400 Bad Request - Missing Keyword

```json
{
  "success": false,
  "error": "Keyword is required"
}
```

#### 400 Bad Request - Invalid Limit

```json
{
  "success": false,
  "error": "Limit must be between 1 and 20"
}
```

#### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Failed to search papers",
  "message": "Detailed error message"
}
```

## 🎯 Paper Object Structure

Each paper in the response contains:

| Field             | Type           | Description                            |
| ----------------- | -------------- | -------------------------------------- |
| `title`           | string         | Paper title                            |
| `link`            | string         | Link to the paper (or "Not available") |
| `abstract`        | string         | Paper abstract/snippet                 |
| `authors`         | string         | Authors list                           |
| `publishYear`     | string         | Publication year (or "N/A")            |
| `publicationInfo` | string         | Full publication information           |
| `pdfLink`         | string \| null | Direct PDF link if available           |

## 📱 Flutter Integration

### Add Dependencies

Add these dependencies to your `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  http: ^1.1.0
  provider: ^6.0.5

dev_dependencies:
  flutter_test:
    sdk: flutter
```

### API Service Implementation

Create `lib/services/paper_service.dart`:

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class PaperService {
  static const String baseUrl = 'http://localhost:3000/api';

  // For Android emulator, use: http://10.0.2.2:3000/api
  // For physical device, use your computer's IP: http://192.168.1.XXX:3000/api

  Future<ApiResponse<List<Paper>>> searchPapers({
    required String keyword,
    int limit = 10,
  }) async {
    try {
      final url = Uri.parse('$baseUrl/search-papers');
      final headers = {
        'Content-Type': 'application/json',
      };

      final body = json.encode({
        'keyword': keyword,
        'limit': limit,
      });

      final response = await http.post(
        url,
        headers: headers,
        body: body,
      );

      final Map<String, dynamic> responseData = json.decode(response.body);

      if (response.statusCode == 200 && responseData['success'] == true) {
        final List<dynamic> papersJson = responseData['papers'];
        final papers = papersJson.map((json) => Paper.fromJson(json)).toList();

        return ApiResponse.success(
          data: papers,
          message: 'Papers fetched successfully',
        );
      } else {
        return ApiResponse.error(
          message: responseData['error'] ?? 'Unknown error occurred',
        );
      }
    } catch (e) {
      return ApiResponse.error(
        message: 'Network error: ${e.toString()}',
      );
    }
  }

  Future<ApiResponse<String>> checkHealth() async {
    try {
      final url = Uri.parse('$baseUrl/health');
      final response = await http.get(url);

      if (response.statusCode == 200) {
        final Map<String, dynamic> responseData = json.decode(response.body);
        return ApiResponse.success(
          data: responseData['status'],
          message: 'API is healthy',
        );
      } else {
        return ApiResponse.error(message: 'API health check failed');
      }
    } catch (e) {
      return ApiResponse.error(
        message: 'Health check failed: ${e.toString()}',
      );
    }
  }
}
```

### Data Models

Create `lib/models/paper.dart`:

```dart
class Paper {
  final String title;
  final String link;
  final String abstract;
  final String authors;
  final String publishYear;
  final String publicationInfo;
  final String? pdfLink;

  Paper({
    required this.title,
    required this.link,
    required this.abstract,
    required this.authors,
    required this.publishYear,
    required this.publicationInfo,
    this.pdfLink,
  });

  factory Paper.fromJson(Map<String, dynamic> json) {
    return Paper(
      title: json['title'] ?? '',
      link: json['link'] ?? '',
      abstract: json['abstract'] ?? '',
      authors: json['authors'] ?? '',
      publishYear: json['publishYear'] ?? '',
      publicationInfo: json['publicationInfo'] ?? '',
      pdfLink: json['pdfLink'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'title': title,
      'link': link,
      'abstract': abstract,
      'authors': authors,
      'publishYear': publishYear,
      'publicationInfo': publicationInfo,
      'pdfLink': pdfLink,
    };
  }
}

class ApiResponse<T> {
  final bool success;
  final T? data;
  final String message;

  ApiResponse({
    required this.success,
    this.data,
    required this.message,
  });

  factory ApiResponse.success({T? data, required String message}) {
    return ApiResponse(
      success: true,
      data: data,
      message: message,
    );
  }

  factory ApiResponse.error({required String message}) {
    return ApiResponse(
      success: false,
      data: null,
      message: message,
    );
  }
}
```

### Provider for State Management

Create `lib/providers/paper_provider.dart`:

```dart
import 'package:flutter/foundation.dart';
import '../models/paper.dart';
import '../services/paper_service.dart';

class PaperProvider with ChangeNotifier {
  final PaperService _paperService = PaperService();

  List<Paper> _papers = [];
  bool _isLoading = false;
  String _errorMessage = '';
  String _lastSearchKeyword = '';

  List<Paper> get papers => _papers;
  bool get isLoading => _isLoading;
  String get errorMessage => _errorMessage;
  String get lastSearchKeyword => _lastSearchKeyword;

  Future<void> searchPapers(String keyword, {int limit = 10}) async {
    if (keyword.trim().isEmpty) {
      _errorMessage = 'Please enter a search keyword';
      notifyListeners();
      return;
    }

    _isLoading = true;
    _errorMessage = '';
    _lastSearchKeyword = keyword;
    notifyListeners();

    try {
      final response = await _paperService.searchPapers(
        keyword: keyword,
        limit: limit,
      );

      if (response.success && response.data != null) {
        _papers = response.data!;
        _errorMessage = '';
      } else {
        _papers = [];
        _errorMessage = response.message;
      }
    } catch (e) {
      _papers = [];
      _errorMessage = 'An unexpected error occurred: ${e.toString()}';
    }

    _isLoading = false;
    notifyListeners();
  }

  void clearResults() {
    _papers = [];
    _errorMessage = '';
    _lastSearchKeyword = '';
    notifyListeners();
  }
}
```

### UI Implementation

Create `lib/screens/search_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/paper_provider.dart';
import '../models/paper.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({Key? key}) : super(key: key);

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  int _selectedLimit = 10;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Astro Bio Navigator'),
        backgroundColor: Colors.indigo,
        foregroundColor: Colors.white,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            _buildSearchForm(),
            const SizedBox(height: 20),
            Expanded(child: _buildResultsList()),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchForm() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _searchController,
              decoration: const InputDecoration(
                labelText: 'Search for academic papers',
                hintText: 'e.g., exoplanets, protein folding, climate change',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.search),
              ),
              onSubmitted: (_) => _performSearch(),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                const Text('Results limit: '),
                const SizedBox(width: 10),
                DropdownButton<int>(
                  value: _selectedLimit,
                  onChanged: (value) {
                    setState(() {
                      _selectedLimit = value!;
                    });
                  },
                  items: [5, 10, 15, 20]
                      .map((limit) => DropdownMenuItem(
                            value: limit,
                            child: Text(limit.toString()),
                          ))
                      .toList(),
                ),
                const Spacer(),
                ElevatedButton.icon(
                  onPressed: _performSearch,
                  icon: const Icon(Icons.search),
                  label: const Text('Search'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.indigo,
                    foregroundColor: Colors.white,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildResultsList() {
    return Consumer<PaperProvider>(
      builder: (context, provider, child) {
        if (provider.isLoading) {
          return const Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                CircularProgressIndicator(),
                SizedBox(height: 16),
                Text('Searching for papers...'),
              ],
            ),
          );
        }

        if (provider.errorMessage.isNotEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.error_outline,
                  size: 64,
                  color: Colors.red[300],
                ),
                const SizedBox(height: 16),
                Text(
                  'Error: ${provider.errorMessage}',
                  style: const TextStyle(color: Colors.red),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () {
                    provider.clearResults();
                  },
                  child: const Text('Try Again'),
                ),
              ],
            ),
          );
        }

        if (provider.papers.isEmpty) {
          return const Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.article_outlined,
                  size: 64,
                  color: Colors.grey,
                ),
                SizedBox(height: 16),
                Text(
                  'Enter a keyword to search for academic papers',
                  style: TextStyle(fontSize: 16, color: Colors.grey),
                ),
              ],
            ),
          );
        }

        return ListView.builder(
          itemCount: provider.papers.length,
          itemBuilder: (context, index) {
            final paper = provider.papers[index];
            return _buildPaperCard(paper);
          },
        );
      },
    );
  }

  Widget _buildPaperCard(Paper paper) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12.0),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              paper.title,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Authors: ${paper.authors}',
              style: TextStyle(
                color: Colors.grey[600],
                fontSize: 14,
              ),
            ),
            Text(
              'Year: ${paper.publishYear}',
              style: TextStyle(
                color: Colors.grey[600],
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              paper.abstract,
              style: const TextStyle(fontSize: 14),
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                if (paper.link != 'Not available')
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () {
                        // Open paper link
                        _showLinkDialog(context, 'Paper Link', paper.link);
                      },
                      icon: const Icon(Icons.link, size: 16),
                      label: const Text('View Paper'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blue,
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ),
                if (paper.link != 'Not available' && paper.pdfLink != null)
                  const SizedBox(width: 8),
                if (paper.pdfLink != null)
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () {
                        // Open PDF link
                        _showLinkDialog(context, 'PDF Link', paper.pdfLink!);
                      },
                      icon: const Icon(Icons.picture_as_pdf, size: 16),
                      label: const Text('View PDF'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.red,
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _performSearch() {
    final keyword = _searchController.text.trim();
    if (keyword.isNotEmpty) {
      context.read<PaperProvider>().searchPapers(
            keyword,
            limit: _selectedLimit,
          );
    }
  }

  void _showLinkDialog(BuildContext context, String title, String link) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: SelectableText(link),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
          TextButton(
            onPressed: () {
              // Here you would typically use url_launcher to open the link
              // For now, just close the dialog
              Navigator.of(context).pop();
            },
            child: const Text('Open'),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }
}
```

### Main App Setup

Update your `lib/main.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/paper_provider.dart';
import 'screens/search_screen.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => PaperProvider()),
      ],
      child: MaterialApp(
        title: 'Astro Bio Navigator',
        theme: ThemeData(
          primarySwatch: Colors.indigo,
          useMaterial3: true,
        ),
        home: const SearchScreen(),
        debugShowCheckedModeBanner: false,
      ),
    );
  }
}
```

## 🔧 Important Notes for Flutter Integration

### Network Configuration

1. **Android Emulator**: Use `http://10.0.2.2:3000` instead of `localhost`
2. **Physical Device**: Use your computer's IP address (e.g., `http://192.168.1.100:3000`)
3. **iOS Simulator**: `http://localhost:3000` should work

### Add Internet Permission (Android)

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

### Add Network Security Config (Android API 28+)

Create `android/app/src/main/res/xml/network_security_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">192.168.1.0/24</domain>
    </domain-config>
</network-security-config>
```

Then update your `AndroidManifest.xml`:

```xml
<application
    android:networkSecurityConfig="@xml/network_security_config"
    ...>
```

## 🛠️ Testing the Integration

1. Start your Node.js server: `node index.js`
2. Run your Flutter app
3. Try searching for terms like:
   - "exoplanets"
   - "protein structure"
   - "machine learning astronomy"
   - "climate change biology"

## 📝 Error Handling

The Flutter app handles various error scenarios:

- Network connectivity issues
- Invalid server responses
- Empty search results
- Server errors

## 🚀 Next Steps

Consider implementing:

- Offline caching of search results
- Favorite papers functionality
- Advanced search filters
- PDF viewer integration
- User authentication
- Search history

## 📞 Support

If you encounter any issues with the API or Flutter integration, check:

1. Server is running on the correct port
2. Network configuration is correct
3. CORS is properly configured
4. Request format matches the API specification
