# Tesco Grocery Scraper

A high-performance Apify Actor that scrapes product data from Tesco.com using their internal GraphQL API. This scraper bypasses HTML parsing entirely, directly accessing the same API endpoints that power the Tesco website for maximum speed and reliability.

## Features

- **API-First Approach**: Direct interaction with Tesco's GraphQL API for fast, reliable data extraction
- **Multi-Region Support**: Scrape from both UK and Ireland stores
- **Flexible Input**: Accepts search keywords, category URLs, product URLs, or product IDs
- **Comprehensive Data**: Extract product listings, full details, nutrition, ingredients, and customer reviews
- **Smart Pagination**: Automatically handles pagination for large result sets
- **Efficient Processing**: Concurrent request handling with built-in retry logic
- **Proxy Support**: Full integration with Apify Proxy for reliable scraping

## Input Configuration

### `queries` (Required)
An array of search queries. Each query can be:
- **Search keyword**: `"milk"`, `"bread"`, `"organic vegetables"`
- **Category URL**: `"https://www.tesco.com/groceries/en-GB/shop/fresh-food/all"`
- **Product URL**: `"https://www.tesco.com/groceries/en-GB/products/303837409"`
- **Product ID**: `"303837409"`
- **Reviews query**: `"303837409/reviews"` (fetches reviews for a specific product)

### `region` (Required)
- `"UK"`: United Kingdom (default)
- `"IE"`: Ireland

### `maxItems` (Optional)
Maximum number of products to scrape per query. Leave empty to scrape all available products.
- Type: Integer
- Minimum: 1
- Maximum: 10000

### `includeProductDetails` (Optional)
When enabled, fetches comprehensive details for each product found in search/category results.
- Type: Boolean
- Default: `false`

### `includeReviews` (Optional)
When enabled, fetches customer reviews for each product (requires `includeProductDetails` to be true).
- Type: Boolean
- Default: `false`

### `proxyConfiguration` (Optional)
Proxy settings for the scraper. Recommended for production use.
- Default: `{ "useApifyProxy": true }`

## Example Input

```json
{
    "queries": [
        "organic milk",
        "https://www.tesco.com/groceries/en-GB/shop/fresh-food/all",
        "303837409",
        "303837409/reviews"
    ],
    "region": "UK",
    "maxItems": 100,
    "includeProductDetails": true,
    "includeReviews": false,
    "proxyConfiguration": {
        "useApifyProxy": true
    }
}
```

## Output Data Structure

### Product Listing (Basic)
```json
{
    "id": "303837409",
    "tpnb": "083643687",
    "tpnc": "303837409",
    "gtin": "5000169057230",
    "title": "Tesco British Semi Skimmed Milk 2.272L/4 Pints",
    "brand": "TESCO",
    "description": "Fresh British semi-skimmed milk",
    "productUrl": "https://www.tesco.com/groceries/en-GB/products/303837409",
    "imageUrl": "https://digitalcontent.api.tesco.com/v2/media/ghs/...",
    "price": {
        "value": 1.45,
        "currency": "GBP",
        "clubcardPrice": 1.30,
        "unitPrice": "64p/litre",
        "unitOfMeasure": "litre"
    },
    "availability": {
        "status": "Available",
        "isAvailable": true,
        "maxQuantity": 20,
        "minQuantity": 1
    },
    "region": "UK",
    "scrapedAt": "2024-01-15T10:30:00.000Z"
}
```

### Product Details (When `includeProductDetails` is enabled)
```json
{
    "id": "303837409",
    "tpnb": "083643687",
    "title": "Tesco British Semi Skimmed Milk 2.272L/4 Pints",
    "brand": "TESCO",
    "description": "Fresh British semi-skimmed milk...",
    "productUrl": "https://www.tesco.com/groceries/en-GB/products/303837409",
    "imageUrl": "https://digitalcontent.api.tesco.com/v2/media/...",
    "price": {
        "value": 1.45,
        "currency": "GBP",
        "clubcardPrice": 1.30,
        "wasPrice": 1.65,
        "unitPrice": "64p/litre"
    },
    "availability": {
        "status": "Available",
        "isAvailable": true,
        "maxQuantity": 20
    },
    "details": {
        "ingredients": "Semi Skimmed Milk",
        "nutrition": {
            "nutrients": [
                {
                    "name": "Energy",
                    "valuePer100g": "206kJ/49kcal",
                    "valuePerServing": "516kJ/123kcal",
                    "dailyValue": "6%"
                },
                {
                    "name": "Fat",
                    "valuePer100g": "1.8g",
                    "valuePerServing": "4.5g",
                    "dailyValue": "6%"
                }
            ],
            "servingSize": "250ml",
            "servingsPerContainer": "9"
        },
        "allergens": ["Milk"],
        "storage": "Keep refrigerated. Once opened use within 3 days.",
        "manufacturer": {
            "name": "Tesco Stores Ltd",
            "address": "Welwyn Garden City AL7 1GA"
        },
        "netContents": "2.272L",
        "packSize": "4 pints",
        "recycling": {
            "text": "Bottle - Plastic - Check Local Recycling"
        }
    },
    "reviews": {
        "count": 245,
        "averageRating": 4.5,
        "distribution": [
            {"rating": 5, "count": 180},
            {"rating": 4, "count": 45},
            {"rating": 3, "count": 15},
            {"rating": 2, "count": 3},
            {"rating": 1, "count": 2}
        ]
    },
    "promotions": [
        {
            "id": "CLUB_2024_01",
            "type": "CLUBCARD",
            "description": "Clubcard Price £1.30",
            "startDate": "2024-01-01",
            "endDate": "2024-01-31"
        }
    ],
    "superDepartment": "Fresh Food",
    "department": "Milk, Butter & Eggs",
    "aisle": "Milk",
    "shelf": "Fresh Semi Skimmed Milk",
    "isDetailedData": true,
    "region": "UK",
    "scrapedAt": "2024-01-15T10:30:00.000Z"
}
```

### Reviews Output (When querying reviews)
```json
{
    "productId": "303837409",
    "region": "UK",
    "page": 1,
    "totalReviews": 245,
    "reviews": [
        {
            "id": "review-123456",
            "rating": 5,
            "title": "Great milk",
            "text": "Always fresh and great value for money...",
            "author": "John D.",
            "date": "2024-01-10",
            "isVerified": true,
            "helpfulCount": 12,
            "unhelpfulCount": 1,
            "merchantResponse": null
        }
    ],
    "scrapedAt": "2024-01-15T10:30:00.000Z"
}
```

## Use Cases

### 1. Search for Products
```json
{
    "queries": ["organic milk", "gluten free bread", "vegan cheese"],
    "region": "UK",
    "maxItems": 50
}
```

### 2. Scrape Entire Categories
```json
{
    "queries": [
        "https://www.tesco.com/groceries/en-GB/shop/fresh-food/all",
        "https://www.tesco.com/groceries/en-GB/shop/bakery/all"
    ],
    "region": "UK",
    "includeProductDetails": true
}
```

### 3. Get Specific Product Details
```json
{
    "queries": ["303837409", "299426810", "305787312"],
    "region": "UK"
}
```

### 4. Collect Product Reviews
```json
{
    "queries": ["303837409/reviews", "299426810/reviews"],
    "region": "UK"
}
```

### 5. Market Research
```json
{
    "queries": ["protein bars", "energy drinks", "sports nutrition"],
    "region": "UK",
    "maxItems": 100,
    "includeProductDetails": true,
    "includeReviews": true
}
```

## Deployment

### Using Apify CLI

1. Install the Apify CLI:
```bash
npm install -g apify-cli
```

2. Login to your Apify account:
```bash
apify login
```

3. Push the actor to Apify platform:
```bash
apify push
```

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/yourusername/tesco-scraper.git
cd tesco-scraper
```

2. Install dependencies:
```bash
npm install
```

3. Create a local input file:
```bash
echo '{"queries":["milk"],"region":"UK"}' > apify_storage/key_value_stores/default/INPUT.json
```

4. Run locally:
```bash
npm start
```

## Technical Details

### Architecture
- **Framework**: Built with Apify SDK and Crawlee
- **HTTP Client**: Uses `got-scraping` for resilient HTTP requests
- **Concurrency**: Handles multiple requests in parallel
- **Error Handling**: Automatic retries with exponential backoff

### API Endpoints
- **Base URL**: `https://xapi.tesco.com/`
- **Operations**: 
  - `GetCategoryProducts`: Product search and category listings
  - `GetProductDetails`: Comprehensive product information
  - `GetProductReviews`: Customer reviews and ratings

### Rate Limiting
The actor implements intelligent rate limiting and request management:
- Automatic retry on rate limit errors
- Configurable concurrency settings
- Proxy rotation for distributed requests

## Limitations

- Maximum 10,000 products per query
- Reviews are paginated (10 per page)
- Some product details may not be available for all items
- Regional availability varies between UK and Ireland

## Support

For issues, questions, or feature requests, please create an issue in the GitHub repository.

## License

This project is licensed under the Apache License 2.0 - see the LICENSE file for details.

## Disclaimer

This scraper is for educational and research purposes only. Users are responsible for complying with Tesco's Terms of Service and applicable laws. Always respect robots.txt and implement responsible scraping practices.