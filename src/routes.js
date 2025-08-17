import { createHttpRouter } from 'crawlee';
import { Actor, log } from 'apify';
import { gotScraping } from 'got-scraping';

export const router = createHttpRouter();

async function callTescoApi(payload, region = 'UK') {
    const response = await gotScraping.post('https://xapi.tesco.com/', {
        json: payload,
        headers: {
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
        },
        responseType: 'json',
        retry: {
            limit: 3,
            methods: ['POST'],
            statusCodes: [408, 413, 429, 500, 502, 503, 504]
        }
    });

    if (response.body?.errors) {
        throw new Error(`API Error: ${JSON.stringify(response.body.errors)}`);
    }

    return response.body;
}

function extractProductData(product, isDetailed = false) {
    if (!product) return null;

    const baseData = {
        id: product.id || product.productId,
        tpnb: product.tpnb,
        tpnc: product.tpnc,
        gtin: product.gtin,
        title: product.title || product.name,
        brand: product.brand?.name || product.brand,
        description: product.description,
        productUrl: product.id ? `https://www.tesco.com/groceries/en-GB/products/${product.id}` : null,
        imageUrl: product.defaultImageUrl || product.imageUrl,
        thumbnailUrl: product.thumbnailImageUrl,
        superDepartment: product.superDepartment?.name,
        department: product.department?.name,
        aisle: product.aisle?.name,
        shelf: product.shelf?.name,
        isInSeason: product.isInSeason,
        isNew: product.isNew,
        scrapedAt: new Date().toISOString()
    };

    if (product.price) {
        baseData.price = {
            value: product.price.actual?.price || product.price.price,
            currency: product.price.actual?.currency || product.price.currency || 'GBP',
            clubcardPrice: product.price.clubcard?.price,
            wasPrice: product.price.was?.price,
            unitPrice: product.price.unitPrice,
            unitOfMeasure: product.price.unitOfMeasure
        };
    }

    if (product.availability) {
        baseData.availability = {
            status: product.availability.status,
            isAvailable: product.availability.status === 'Available',
            maxQuantity: product.availability.maxQuantity,
            minQuantity: product.availability.minQuantity
        };
    }

    if (isDetailed) {
        baseData.details = {
            ingredients: product.ingredients?.text,
            nutrition: product.nutrition,
            allergens: product.allergens,
            storage: product.storage,
            manufacturer: {
                name: product.manufacturer?.name,
                address: product.manufacturer?.address
            },
            netContents: product.netContents,
            catchWeight: product.catchWeight,
            packSize: product.packSize,
            restrictions: product.restrictions,
            ageRestriction: product.ageRestriction,
            marketingDescriptions: product.marketingDescriptions,
            features: product.features,
            healthClaims: product.healthClaims,
            recycling: product.recycling
        };

        if (product.reviews) {
            baseData.reviews = {
                count: product.reviews.count,
                averageRating: product.reviews.averageRating,
                distribution: product.reviews.distribution
            };
        }

        if (product.promotions?.length > 0) {
            baseData.promotions = product.promotions.map(promo => ({
                id: promo.id,
                type: promo.type,
                description: promo.description,
                startDate: promo.startDate,
                endDate: promo.endDate
            }));
        }
    }

    return baseData;
}

router.addHandler('CATEGORY', async ({ request, crawler, log }) => {
    const { 
        region, 
        maxItems, 
        includeProductDetails, 
        type, 
        query, 
        categoryPath, 
        page = 1,
        itemsScraped = 0,
        queryIndex,
        totalQueries
    } = request.userData;

    log.info(`[${queryIndex + 1}/${totalQueries}] Processing ${type} page ${page}: ${query || categoryPath}`);

    try {
        const variables = {
            page,
            count: 48,
            sortBy: 'RELEVANCE'
        };

        if (type === 'search') {
            variables.query = query;
        } else if (type === 'category' && categoryPath) {
            const encodedFacet = Buffer.from(`b;${categoryPath}`).toString('base64');
            variables.facet = encodedFacet;
        }

        const payload = {
            operationName: 'GetCategoryProducts',
            variables,
            query: `
                query GetCategoryProducts($query: String, $facet: String, $page: Int!, $count: Int!, $sortBy: String) {
                    productSearch(query: $query, facet: $facet, page: $page, count: $count, sortBy: $sortBy) {
                        pageInformation {
                            totalCount
                            pageCount
                            currentPage
                        }
                        results {
                            id
                            tpnb
                            tpnc
                            gtin
                            title
                            brand {
                                name
                            }
                            defaultImageUrl
                            price {
                                actual {
                                    price
                                    currency
                                }
                                clubcard {
                                    price
                                }
                                unitPrice
                                unitOfMeasure
                            }
                            availability {
                                status
                            }
                            isInSeason
                            isNew
                        }
                    }
                }
            `
        };

        const response = await callTescoApi(payload, region);
        const searchResults = response?.data?.productSearch;

        if (!searchResults) {
            log.warning(`No search results found for ${type}: ${query || categoryPath}`);
            return;
        }

        const { results = [], pageInformation } = searchResults;
        let newItemsScraped = itemsScraped;

        for (const product of results) {
            if (maxItems && newItemsScraped >= maxItems) {
                log.info(`Reached maximum items limit (${maxItems}) for query ${queryIndex + 1}`);
                break;
            }

            const productData = extractProductData(product, false);
            productData.queryType = type;
            productData.query = query || categoryPath;
            productData.region = region;
            productData.pageNumber = page;

            await Actor.pushData(productData);
            newItemsScraped++;

            if (includeProductDetails && product.id) {
                await crawler.addRequests([{
                    url: 'https://xapi.tesco.com/',
                    method: 'POST',
                    label: 'PRODUCT',
                    userData: {
                        productId: product.id,
                        region,
                        queryIndex,
                        totalQueries,
                        fromCategory: true
                    },
                    uniqueKey: `product-detail-${product.id}-${region}`
                }]);
            }
        }

        log.info(`Scraped ${results.length} products from page ${page} (Total: ${newItemsScraped}/${pageInformation.totalCount})`);

        const hasNextPage = page < pageInformation.pageCount;
        const shouldContinue = !maxItems || newItemsScraped < maxItems;

        if (hasNextPage && shouldContinue) {
            await crawler.addRequests([{
                url: 'https://xapi.tesco.com/',
                method: 'POST',
                label: 'CATEGORY',
                userData: {
                    ...request.userData,
                    page: page + 1,
                    itemsScraped: newItemsScraped
                },
                uniqueKey: `${type}-${query || categoryPath}-${region}-page-${page + 1}`
            }]);
        }

    } catch (error) {
        log.error(`Failed to process ${type} page ${page}`, error);
        throw error;
    }
});

router.addHandler('PRODUCT', async ({ request, log }) => {
    const { productId, region, includeReviews, queryIndex, totalQueries, fromCategory } = request.userData;

    const logPrefix = fromCategory ? '' : `[${queryIndex + 1}/${totalQueries}] `;
    log.info(`${logPrefix}Fetching product details for ID: ${productId}`);

    try {
        const payload = {
            operationName: 'GetProductDetails',
            variables: {
                id: productId
            },
            query: `
                query GetProductDetails($id: String!) {
                    product(id: $id) {
                        id
                        tpnb
                        tpnc
                        gtin
                        title
                        description
                        brand {
                            name
                        }
                        defaultImageUrl
                        thumbnailImageUrl
                        images {
                            url
                            type
                        }
                        price {
                            actual {
                                price
                                currency
                            }
                            clubcard {
                                price
                                currency
                            }
                            was {
                                price
                            }
                            unitPrice
                            unitOfMeasure
                        }
                        availability {
                            status
                            maxQuantity
                            minQuantity
                        }
                        superDepartment {
                            name
                            id
                        }
                        department {
                            name
                            id
                        }
                        aisle {
                            name
                            id
                        }
                        shelf {
                            name
                            id
                        }
                        ingredients {
                            text
                        }
                        nutrition {
                            nutrients {
                                name
                                valuePer100g
                                valuePerServing
                                dailyValue
                            }
                            servingSize
                            servingsPerContainer
                        }
                        allergens
                        storage
                        manufacturer {
                            name
                            address
                        }
                        netContents
                        catchWeight
                        packSize
                        restrictions
                        ageRestriction
                        marketingDescriptions
                        features
                        healthClaims
                        recycling {
                            text
                        }
                        promotions {
                            id
                            type
                            description
                            startDate
                            endDate
                        }
                        reviews {
                            count
                            averageRating
                            distribution {
                                rating
                                count
                            }
                        }
                        isInSeason
                        isNew
                    }
                }
            `
        };

        const response = await callTescoApi(payload, region);
        const product = response?.data?.product;

        if (!product) {
            log.warning(`Product not found: ${productId}`);
            return;
        }

        const productData = extractProductData(product, true);
        productData.region = region;
        productData.isDetailedData = true;

        await Actor.pushData(productData);
        log.info(`Successfully scraped detailed data for product: ${product.title}`);

        if (includeReviews && product.reviews?.count > 0) {
            await crawler.addRequests([{
                url: 'https://xapi.tesco.com/',
                method: 'POST',
                label: 'REVIEWS',
                userData: {
                    productId,
                    region,
                    page: 1,
                    totalReviews: product.reviews.count
                },
                uniqueKey: `reviews-${productId}-${region}-page-1`
            }]);
        }

    } catch (error) {
        log.error(`Failed to fetch product details for ID: ${productId}`, error);
        throw error;
    }
});

router.addHandler('REVIEWS', async ({ request, crawler, log }) => {
    const { productId, region, page = 1, totalReviews } = request.userData;

    log.info(`Fetching reviews page ${page} for product ID: ${productId}`);

    try {
        const payload = {
            operationName: 'GetProductReviews',
            variables: {
                productId,
                offset: (page - 1) * 10,
                limit: 10
            },
            query: `
                query GetProductReviews($productId: String!, $offset: Int!, $limit: Int!) {
                    productReviews(productId: $productId, offset: $offset, limit: $limit) {
                        total
                        reviews {
                            id
                            rating
                            title
                            text
                            author
                            date
                            verified
                            helpful
                            unhelpful
                            response {
                                text
                                date
                            }
                        }
                    }
                }
            `
        };

        const response = await callTescoApi(payload, region);
        const reviewsData = response?.data?.productReviews;

        if (!reviewsData || !reviewsData.reviews) {
            log.warning(`No reviews found for product: ${productId}`);
            return;
        }

        const reviewsOutput = {
            productId,
            region,
            page,
            totalReviews: reviewsData.total,
            reviews: reviewsData.reviews.map(review => ({
                id: review.id,
                rating: review.rating,
                title: review.title,
                text: review.text,
                author: review.author,
                date: review.date,
                isVerified: review.verified,
                helpfulCount: review.helpful,
                unhelpfulCount: review.unhelpful,
                merchantResponse: review.response ? {
                    text: review.response.text,
                    date: review.response.date
                } : null
            })),
            scrapedAt: new Date().toISOString()
        };

        await Actor.pushData(reviewsOutput);
        log.info(`Scraped ${reviewsData.reviews.length} reviews from page ${page}`);

        const hasMoreReviews = (page * 10) < reviewsData.total;
        if (hasMoreReviews) {
            await crawler.addRequests([{
                url: 'https://xapi.tesco.com/',
                method: 'POST',
                label: 'REVIEWS',
                userData: {
                    productId,
                    region,
                    page: page + 1,
                    totalReviews: reviewsData.total
                },
                uniqueKey: `reviews-${productId}-${region}-page-${page + 1}`
            }]);
        }

    } catch (error) {
        log.error(`Failed to fetch reviews for product ID: ${productId}`, error);
        throw error;
    }
});

router.addDefaultHandler(async ({ request, log }) => {
    log.warning(`Unhandled request: ${request.url} with label: ${request.label}`);
});