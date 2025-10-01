# Astro Bio Navigator Server API

> **Base URL:** https://astro-bio-navigator-server.vercel.app

This server provides a simple academic paper search API using the [Semantic Scholar API](https://api.semanticscholar.org/). It is designed for easy integration with Flutter and other frontend apps.

---

## 🚀 Quick Start

### 1. API Endpoint

**POST** `/api/search-papers`

**Full URL:**

```
https://astro-bio-navigator-server.vercel.app/api/search-papers
```

### 2. Request Format

- **Method:** POST
- **Content-Type:** application/json (**required**)

#### Example Request Body

```json
{
  "keyword": "biology",
  "limit": 10
}
```

| Field   | Type   | Required | Description                               |
| ------- | ------ | -------- | ----------------------------------------- |
| keyword | string | Yes      | Search term (e.g. "biology", "exoplanet") |
| limit   | number | No       | Number of results (default: 10, max: 20)  |

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
```

### 3. Usage Example

```dart
final service = PaperService();
final papers = await service.searchPapers(keyword: 'biology', limit: 5);
print(papers.first.title);
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
