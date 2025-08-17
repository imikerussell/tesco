import { Actor } from 'apify';
import { HttpCrawler, log } from 'crawlee';
import { router } from './routes.js';
import { parseQuery } from './utils.js';

await Actor.init();

const input = await Actor.getInput();
const {
    queries = [],
    region = 'UK',
    maxItems,
    includeProductDetails = false,
    includeReviews = false,
    proxyConfiguration = { useApifyProxy: true }
} = input;

if (!queries || queries.length === 0) {
    throw new Error('No queries provided. Please provide at least one search keyword, URL, or product ID.');
}

log.info(`Starting Tesco scraper with ${queries.length} queries for region: ${region}`);

const proxyConfig = await Actor.createProxyConfiguration(proxyConfiguration);

const crawler = new HttpCrawler({
    proxyConfiguration: proxyConfig,
    requestHandler: router,
    maxRequestRetries: 3,
    requestHandlerTimeoutSecs: 60,
    navigationTimeoutSecs: 60,
    additionalMimeTypes: ['application/json'],
    preNavigationHooks: [
        async ({ request }, gotOptions) => {
            gotOptions.headers = {
                ...gotOptions.headers,
                'accept': 'application/json',
                'accept-language': 'en-GB,en;q=0.9',
                'content-type': 'application/json',
                'origin': 'https://www.tesco.com',
                'referer': 'https://www.tesco.com/',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'x-apikey': 'ukLiveGroceriesApi',
                'x-application': 'ukLiveWeb',
                'x-request-origin': 'gi',
                'region': region
            };
        }
    ],
    failedRequestHandler: async ({ request }, error) => {
        log.error(`Request ${request.url} failed ${request.retryCount} times.`, error);
    }
});

const requests = [];
let queryIndex = 0;

for (const query of queries) {
    const parsedQuery = parseQuery(query);
    
    const userData = {
        region,
        maxItems,
        includeProductDetails,
        includeReviews,
        queryIndex: queryIndex++,
        totalQueries: queries.length,
        itemsScraped: 0,
        ...parsedQuery
    };

    if (parsedQuery.type === 'product' || parsedQuery.type === 'reviews') {
        requests.push({
            url: 'https://xapi.tesco.com/',
            method: 'POST',
            label: parsedQuery.type === 'reviews' ? 'REVIEWS' : 'PRODUCT',
            userData,
            uniqueKey: `${parsedQuery.type}-${parsedQuery.productId}-${region}`
        });
    } else if (parsedQuery.type === 'category' || parsedQuery.type === 'search') {
        requests.push({
            url: 'https://xapi.tesco.com/',
            method: 'POST',
            label: 'CATEGORY',
            userData: {
                ...userData,
                page: 1
            },
            uniqueKey: `${parsedQuery.type}-${parsedQuery.query || parsedQuery.categoryPath}-${region}-page-1`
        });
    }
}

log.info(`Adding ${requests.length} initial requests to the queue`);
await crawler.addRequests(requests);

await crawler.run();

const stats = await crawler.requestQueue.getInfo();
log.info('Scraping finished!', {
    totalRequests: stats.totalRequestCount,
    handledRequests: stats.handledRequestCount,
    pendingRequests: stats.pendingRequestCount
});

await Actor.exit();