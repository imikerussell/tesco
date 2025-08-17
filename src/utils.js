export function parseQuery(query) {
    const trimmedQuery = query.trim();
    
    const productUrlRegex = /(?:https?:\/\/)?(?:www\.)?tesco\.com\/groceries\/[^\/]+\/products\/(\d+)/i;
    const categoryUrlRegex = /(?:https?:\/\/)?(?:www\.)?tesco\.com\/groceries\/[^\/]+\/shop\/(.*?)(?:\?|$)/i;
    const productIdRegex = /^(\d{8,10})$/;
    const reviewsRegex = /^(\d{8,10})\/reviews$/i;
    
    let match;
    
    if (match = trimmedQuery.match(reviewsRegex)) {
        return {
            type: 'reviews',
            productId: match[1],
            originalQuery: trimmedQuery
        };
    }
    
    if (match = trimmedQuery.match(productUrlRegex)) {
        return {
            type: 'product',
            productId: match[1],
            originalQuery: trimmedQuery
        };
    }
    
    if (match = trimmedQuery.match(categoryUrlRegex)) {
        const categoryPath = match[1]
            .split('/')
            .filter(Boolean)
            .map(segment => decodeURIComponent(segment))
            .map(segment => segment.replace(/-/g, ' '))
            .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
            .join('|');
        
        return {
            type: 'category',
            categoryPath,
            originalQuery: trimmedQuery
        };
    }
    
    if (match = trimmedQuery.match(productIdRegex)) {
        return {
            type: 'product',
            productId: match[1],
            originalQuery: trimmedQuery
        };
    }
    
    return {
        type: 'search',
        query: trimmedQuery,
        originalQuery: trimmedQuery
    };
}

export function encodeCategoryFacet(categoryPath) {
    return Buffer.from(`b;${categoryPath}`).toString('base64');
}

export function decodeCategoryFacet(encodedFacet) {
    const decoded = Buffer.from(encodedFacet, 'base64').toString('utf-8');
    return decoded.replace(/^b;/, '');
}