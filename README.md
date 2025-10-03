# Astro Bio Navigator Server API

> **Base URL:** https://astro-bio-navigator-server.vercel.app

This server provides a simple academic paper search API using the [Semantic Scholar API](https://api.semanticscholar.org/). It is designed for easy integration with Flutter and other frontend apps.

---

## 🚀 Quick Start

### 1. API Endpoint

**POST** `/api/search-papers`
**POST** `/api/trending-papers-by-keywords`

**Full URL:**

```
https://astro-bio-navigator-server.vercel.app/api/search-papers
```

````
https://astro-bio-navigator-server.vercel.app/api/trending-papers-by-keywords```


### 2. Request Format

- **Method:** POST
- **Content-Type:** application/json (**required**)

#### Example Request Body

```json
{
  "keyword": "biology",
  "limit": 100
}
````

| Field   | Type                                      | Required | Description                               |
| ------- | ----------------------------------------- | -------- | ----------------------------------------- |
| ---     | ----------------------------------------- |
| keyword | string                                    | Yes      | Search term (e.g. "biology", "exoplanet") |
| limit   | number                                    | No       | Number of results (default: 10, max: 20)  |

---

### 3. Response Format

**Success Example:**

```json
{
  "success": true,
  "keyword": "biology",
  "totalResults": 10,
  "papers": [
    {
      "title": "The biology of ...",
      "link": "https://www.semanticscholar.org/paper/xxxx",
      "abstract": "This paper discusses ...",
      "authors": "Smith J, Doe A",
      "publishYear": 2022,
      "publicationInfo": "",
      "pdfLink": null
    }
    // ...more papers
  ]
}
```

**Error Example:**

```json
{
  "success": false,
  "error": "Keyword is required and must be a non-empty string."
}
```

---

## 🔥 Trending Papers by Keywords

### POST `/api/trending-papers-by-keywords`

Use this endpoint to get trending (most cited, recent) papers for each keyword/topic you provide.

**Request:**

- Method: POST
- Content-Type: application/json (required)
- Body:

```json
{
  "keywords": ["astrobiology", "microgravity", "life detection"]
}
```

| Field    | Type     | Required | Description                                   |
| -------- | -------- | -------- | --------------------------------------------- |
| keywords | string[] | Yes      | Array of topics/keywords to search            |
| limit    | number   | No       | Number of top papers per keyword (default: 3) |
| yearFrom | number   | No       | Only include papers from this year onward     |

**Response:**

```json
{
  "success": true,
  "yearFrom": 2021,
  "limit": 5,
  "results": [
    {
      "keyword": "astrobiology",
      "papers": [
        {
          "title": "...",
          "link": "...",
          "abstract": "...",
          "authors": "...",
          "publishYear": 2022,
          "citationCount": 123,
          "pdfLink": null
        }
        // ...more papers
      ]
    }
    // ...more keywords
  ]
}
```

**Error Example:**

```json
{
  "success": false,
  "error": "Request body must include a non-empty \"keywords\" array."
}
```

**Example (curl):**

```sh
curl -X POST https://astro-bio-navigator-server.vercel.app/api/trending-papers-by-keywords \
  -H "Content-Type: application/json" \
  -d '{"keywords": ["astrobiology", "microgravity"], "limit": 5, "yearFrom": 2021}'
```

---

## 📱 Flutter Integration Example

### 1. Add Dependencies

Add to your `pubspec.yaml`:

```yaml
dependencies:
	http: ^1.1.0
```

### 2. Dart Service Example

Create `lib/services/paper_service.dart`:

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class PaperService {
	static const String baseUrl = 'https://astro-bio-navigator-server.vercel.app/api';

	Future<List<Paper>> searchPapers({required String keyword, int limit = 10}) async {
		final url = Uri.parse('$baseUrl/search-papers');
		final response = await http.post(
			url,
			headers: {'Content-Type': 'application/json'},
			body: jsonEncode({'keyword': keyword, 'limit': limit}),
		);
		if (response.statusCode == 200) {
			final data = jsonDecode(response.body);
			if (data['success'] == true && data['papers'] != null) {
				return (data['papers'] as List).map((e) => Paper.fromJson(e)).toList();
			} else {
				throw Exception(data['error'] ?? 'Unknown error');
			}
		} else {
			throw Exception('Failed to fetch papers');
		}
	}

	Future<List<TrendingPaper>> trendingPapersByKeywords({required List<String> keywords, int limit = 3, int yearFrom = 2020}) async {
		final url = Uri.parse('$baseUrl/trending-papers-by-keywords');
		final response = await http.post(
			url,
			headers: {'Content-Type': 'application/json'},
			body: jsonEncode({'keywords': keywords, 'limit': limit, 'yearFrom': yearFrom}),
		);
		if (response.statusCode == 200) {
			final data = jsonDecode(response.body);
			if (data['success'] == true && data['results'] != null) {
				return (data['results'] as List).map((e) => TrendingPaper.fromJson(e)).toList();
			} else {
				throw Exception(data['error'] ?? 'Unknown error');
			}
		} else {
			throw Exception('Failed to fetch trending papers');
		}
	}
}

class Paper {
	final String title;
	final String link;
	final String abstract;
	final String authors;
	final dynamic publishYear;
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

	factory Paper.fromJson(Map<String, dynamic> json) => Paper(
		title: json['title'] ?? '',
		link: json['link'] ?? '',
		abstract: json['abstract'] ?? '',
		authors: json['authors'] ?? '',
		publishYear: json['publishYear'] ?? '',
		publicationInfo: json['publicationInfo'] ?? '',
		pdfLink: json['pdfLink'],
	);
}

class TrendingPaper {
	final String keyword;
	final List<Paper> papers;

	TrendingPaper({
		required this.keyword,
		required this.papers,
	});

	factory TrendingPaper.fromJson(Map<String, dynamic> json) => TrendingPaper(
		keyword: json['keyword'] ?? '',
		papers: (json['papers'] as List).map((e) => Paper.fromJson(e)).toList(),
	);
}
```

### 3. Usage Example

```dart
final service = PaperService();
final papers = await service.searchPapers(keyword: 'biology', limit: 5);
print(papers.first.title);

final trending = await service.trendingPapersByKeywords(keywords: ['astrobiology', 'microgravity'], limit: 5, yearFrom: 2021);
print(trending.first.keyword);
```

---

## 🛠️ Troubleshooting

- Always set `Content-Type: application/json` in your POST requests.
- If you get an error, check the `error` field in the response.
- If you get zero results, try a different keyword or lower the limit.

---

## ℹ️ Notes

- This API uses the [Semantic Scholar API](https://api.semanticscholar.org/) for academic search.
- For production, respect the Semantic Scholar API rate limits and terms of use.
- The server does not store or log your queries or results.

---

## 📞 Support

For questions or issues, open an issue on the project repository or contact the maintainer.
