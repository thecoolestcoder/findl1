const { searchGoogleShopping } = require('./serpapi');
const { scrapeAmazon } = require('./scrapers/amazon');
const { scrapeFlipkart } = require('./scrapers/flipkart');
const { rankProducts } = require('./product_ranker');
const { aiVerdict } = require('./aiAdvisor');

const SCRAPER_TIMEOUT = Number(process.env.SCRAPER_TIMEOUT_MS) || 6000;
const USE_SERPAPI = process.env.USE_SERPAPI === 'true';
const USE_AMAZON_FLIPKART_DIRECT = process.env.USE_AMAZON_FLIPKART_DIRECT === 'true';

/**
 * Wraps a promise with a timeout
 */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    )
  ]);
}

/**
 * Deduplicates products based on title similarity and price
 */
function deduplicateProducts(products) {
  const seen = new Map();
  return products.filter(p => {
    const key = `${p.title.toLowerCase().slice(0, 50).trim()}_${p.price}`;
    if (seen.has(key)) return false;
    seen.set(key, true);
    return true;
  });
}

/**
 * Checks if the query is for an expensive product category
 */
function isExpensiveProductQuery(query) {
    const queryLower = query.toLowerCase();
    const expensiveCategories = [
        'phone', 'iphone', 'samsung', 'oneplus', 'pixel', 'smartphone',
        'laptop', 'macbook', 'notebook', 'computer', 'pc',
        'tablet', 'ipad',
        'tv', 'television', 'smart tv',
        'camera', 'dslr', 'mirrorless',
        'watch', 'smartwatch', 'apple watch',
        'console', 'playstation', 'xbox', 'ps5',
        'refrigerator', 'fridge', 'washing machine', 'ac', 'air conditioner'
    ];
    
    return expensiveCategories.some(category => queryLower.includes(category));
}

/**
 * 🚀 OPTIMIZATION: Pre-filters products for AI ranking to reduce token usage
 * For expensive products: Filter accessories, then take diverse price range
 * For cheap products: Filter accessories and take top 30
 */
function prepareProductsForRanking(query, products) {
    const isExpensive = isExpensiveProductQuery(query);
    
    if (isExpensive) {
        // 🔧 FIX: First filter out accessories for expensive product queries
        const filtered = simpleAccessoryFilter(query, products);
        
        if (filtered.length === 0) {
            console.log('⚠️  All products filtered as accessories, using original set');
            return products.slice(0, 20);
        }
        
        // Then take a DIVERSE price range to find best deals
        const sorted = [...filtered].sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
        
        // Take products from different price segments to ensure we find the best deal
        const segment1 = sorted.slice(0, 8);  // Cheapest 8 (likely best deals)
        const segment2 = sorted.slice(Math.floor(sorted.length * 0.25), Math.floor(sorted.length * 0.25) + 5);  // Lower-mid range
        const segment3 = sorted.slice(Math.floor(sorted.length * 0.5), Math.floor(sorted.length * 0.5) + 4);   // Mid range
        const segment4 = sorted.slice(Math.floor(sorted.length * 0.75), Math.floor(sorted.length * 0.75) + 3);  // Higher range
        
        const diverseSelection = [...segment1, ...segment2, ...segment3, ...segment4];
        
        // Remove duplicates (in case of small product sets)
        const unique = Array.from(new Map(diverseSelection.map(p => [p.id || p.link, p])).values());
        
        const removedCount = products.length - filtered.length;
        if (products.length > 20) {
            console.log(`🚀 Optimization: Filtered ${removedCount} accessories, ranking ${unique.length} products across all price ranges (out of ${products.length} total)`);
            console.log(`   Price range: ₹${segment1[0]?.price.toLocaleString()} - ₹${sorted[sorted.length-1]?.price.toLocaleString()}`);
        }
        
        return unique.slice(0, 20); // Cap at 20 for performance
    } else {
        // For other products, filter accessories and take top 30 by price
        const filtered = simpleAccessoryFilter(query, products);
        const sorted = [...filtered].sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
        const top30 = sorted.slice(0, 30);
        
        if (products.length > 30) {
            console.log(`🚀 Optimization: Ranking top 30 products after filtering (out of ${products.length})`);
        }
        
        return top30;
    }
}

/**
 * [CRITICAL FALLBACK FIX] Filters out low-priced, generic accessories
 * This is ONLY used if the AI ranking fails to prevent price-sort takeover.
 */
function simpleAccessoryFilter(query, products) {
    const queryLower = query.toLowerCase();
    
    // Only apply the filter if the query is for a primary product (not an accessory itself)
    const isPrimaryQuery = !queryLower.includes('case') && 
                           !queryLower.includes('cover') &&
                           !queryLower.includes('charger') &&
                           !queryLower.includes('cable') &&
                           !queryLower.includes('protector') &&
                           !queryLower.includes('stand');

    if (!isPrimaryQuery) {
        return products; // Don't filter if the user is explicitly looking for an accessory
    }

    const filtered = products.filter(p => {
        const titleLower = p.title.toLowerCase();
        
        // Define common accessory keywords
        const isAccessory = titleLower.includes('case') || 
                            titleLower.includes('cover') ||
                            titleLower.includes('protector') || 
                            titleLower.includes('charger') ||
                            titleLower.includes('cable') ||
                            titleLower.includes('stand'); 
        
        // If it's a known accessory AND it's below a low price threshold (e.g., ₹1000), filter it out.
        if (isAccessory ) {
            return false;
        }
        
        return true;
    });

    const removedCount = products.length - filtered.length;
    if (removedCount > 0) {
        console.log(`⚠️  Applied Simple Accessory Filter: Removed ${removedCount} low-cost accessories.`);
    }

    return filtered;
}


/**
 * Main aggregation function
 * Strategy: Amazon & Flipkart direct scrapers + SerpAPI for everything else
 */
async function getProductResults(query) {
  console.log('🔍 Aggregating products for:', query);
  const startTime = Date.now();

  let items = [];
  const sources = [];

  // STEP 1: Direct scrapers for Amazon & Flipkart ONLY (guaranteed direct links)
  if (USE_AMAZON_FLIPKART_DIRECT) {
    console.log('🎯 Scraping Amazon & Flipkart directly...');
    
    const directScrapers = [
      { name: 'Amazon', fn: scrapeAmazon },
      { name: 'Flipkart', fn: scrapeFlipkart }
    ];

    const scraperPromises = directScrapers.map(({ name, fn }) =>
      withTimeout(
        fn(query).catch(err => {
          console.error(`❌ ${name} scraper error:`, err.message);
          return [];
        }),
        SCRAPER_TIMEOUT
      ).catch(err => {
        console.error(`⏱️  ${name} timeout after ${SCRAPER_TIMEOUT}ms`);
        return [];
      })
    );

    const results = await Promise.allSettled(scraperPromises);

    results.forEach((result, idx) => {
      const name = directScrapers[idx].name;
      const data = result.status === 'fulfilled' ? result.value : [];
      
      if (data.length > 0) {
        items.push(...data);
        sources.push({ name, count: data.length, type: 'direct' });
        console.log(`   ✓ ${name}: ${data.length} products (direct links)`);
      } else {
        sources.push({ name, count: 0, type: 'failed' });
        console.log(`   ⚠️  ${name}: 0 products (scraper may be blocked)`);
      }
    });

    // If both scrapers failed, log a warning
    if (items.length === 0) {
      console.log('   ⚠️  Amazon & Flipkart scrapers returned no results (likely blocked)');
      console.log('   📡 Relying on SerpAPI for all results...');
    }
  }

  // STEP 2: SerpAPI for ALL other stores (eBay, Myntra, JioMart, Walmart, etc.)
  if (USE_SERPAPI) {
    console.log('📡 Using SerpAPI for other stores (eBay, Myntra, JioMart, etc.)...');
    try {
      const serpResults = await withTimeout(
        searchGoogleShopping(query),
        SCRAPER_TIMEOUT
      );
      
      // Filter out Amazon & Flipkart from SerpAPI if we already scraped them directly
      let filteredResults = serpResults;
      if (USE_AMAZON_FLIPKART_DIRECT) {
        const directStores = ['amazon', 'flipkart'];
        filteredResults = serpResults.filter(p => {
          const store = p.store.toLowerCase();
          return !directStores.some(ds => store.includes(ds)); 
        });
        
        const filtered = serpResults.length - filteredResults.length;
        if (filtered > 0) {
          console.log(`   🔄 Filtered out ${filtered} duplicate Amazon/Flipkart items from SerpAPI`);
        }
      }
      
      const directLinks = filteredResults.filter(p => !p.link.includes('google.com')).length;
      const redirectLinks = filteredResults.length - directLinks;
      
      items.push(...filteredResults);
      sources.push({ 
        name: 'SerpAPI (Other Stores)', 
        count: filteredResults.length,
        directLinks,
        redirectLinks,
        type: 'serpapi'
      });
      console.log(`   ✓ SerpAPI: ${filteredResults.length} products (${directLinks} direct, ${redirectLinks} redirects)`);
    } catch (error) {
      console.error('❌ SerpAPI error:', error.message);
      sources.push({ name: 'SerpAPI', count: 0, error: error.message });
    }
  }

  // Filter out invalid items
  items = items.filter(item => item && item.price > 0 && item.title && item.link);

  console.log(`✓ Found ${items.length} total products in ${Date.now() - startTime}ms`);

  // Deduplicate
  const beforeDedup = items.length;
  items = deduplicateProducts(items);
  if (beforeDedup > items.length) {
    console.log(`🔄 Removed ${beforeDedup - items.length} duplicates`);
  }

  // Calculate link statistics
  const directLinks = items.filter(p => !p.link.includes('google.com')).length;
  const redirectLinks = items.length - directLinks;

  console.log(`📊 Link breakdown: ${directLinks} direct, ${redirectLinks} redirects`);

  // Handle empty results
  if (items.length === 0) {
    return {
      items: [],
      summary: getSetupMessage(),
      metadata: {
        totalResults: 0,
        rankedByAI: false,
        fetchTime: Date.now() - startTime,
        directLinks: 0,
        redirectLinks: 0,
        sources
      }
    };
  }

  // Initialize result variables
  let summary = '';
  let rankedProducts = [];
  let rankingFailed = false;

  // Attempt AI ranking FIRST (on ALL products, not pre-sorted subset)
  try {
    console.log('🤖 Attempting AI ranking on full product set...');
    
    // 🚀 OPTIMIZATION: Pre-filter products to reduce AI ranking time
    const productsToRank = prepareProductsForRanking(query, items);
    
    const rankResult = await rankProducts(query, productsToRank); 

    if (rankResult && typeof rankResult === 'object') {
      rankedProducts = rankResult.rankedProducts || [];
      rankingFailed = rankResult.crsFailed || false;
    } else if (Array.isArray(rankResult)) {
      rankedProducts = rankResult;
    }

    // If AI ranking succeeded, use the ranked list as the final list
    if (rankedProducts.length > 0 && !rankingFailed) {
      // 🔧 FIX: If we ranked a subset, keep unranked products at the end
      if (productsToRank.length < items.length) {
        const rankedIds = new Set(rankedProducts.map(p => p.id || p.link));
        const unrankedProducts = items.filter(p => !rankedIds.has(p.id || p.link));
        items = [...rankedProducts, ...unrankedProducts];
        console.log(`✅ AI ranking applied to top ${rankedProducts.length} products, ${unrankedProducts.length} kept at end`);
      } else {
        items = rankedProducts;
        console.log('✅ AI ranking applied successfully');
      }
      
      // 🔧 FIX: Log the top 3 ranked products with their CRS scores
      console.log('🏆 Top 3 AI-ranked products:');
      items.slice(0, 3).forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.title.slice(0, 60)}... - ₹${p.price} (CRS: ${p.CRS?.toFixed(2) || 'N/A'})`);
      });
    } else {
      console.log('⚠️  AI ranking failed, falling back to filtered price sort');
      rankingFailed = true;
      // Apply accessory filter and sort by price as fallback
      items = simpleAccessoryFilter(query, items);
      items.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
    }

    // 🔧 FIX: Get top products AFTER ranking is applied
    // This ensures the AI verdict sees the correctly ranked products
    const topProducts = items.slice(0, 5);
    
    const rankNote = rankingFailed
      ? ' (Note: AI ranking temporarily unavailable, results filtered and sorted by price.)'
      : '';

    console.log('💬 Getting AI verdict for top-ranked products...');
    summary = await aiVerdict(topProducts, rankNote);

  } catch (err) {
    console.error('⚠️  AI ranking/verdict error:', err.message);
    rankingFailed = true;
    
    // Fallback: apply accessory filter and sort by price
    items = simpleAccessoryFilter(query, items);
    items.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
    
    const topProduct = items[0];
    summary = `Found ${items.length} products! Best deal: ₹${topProduct.price} from ${topProduct.store}. ${topProduct.discount > 0 ? `(${topProduct.discount}% off!)` : ''}`;
  }

  return {
    items,
    summary,
    metadata: {
      totalResults: items.length,
      topPrice: items[0]?.price, 
      topStore: items[0]?.store, 
      rankedByAI: !rankingFailed && rankedProducts.length > 0,
      fetchTime: Date.now() - startTime,
      directLinks,
      redirectLinks,
      sources,
      strategy: {
        amazonFlipkartDirect: USE_AMAZON_FLIPKART_DIRECT,
        serpApiOthers: USE_SERPAPI
      }
    }
  };
}

function getSetupMessage() {
  if (!USE_SERPAPI && !USE_AMAZON_FLIPKART_DIRECT) {
    return '⚠️ No data sources enabled. Enable USE_SERPAPI and/or USE_AMAZON_FLIPKART_DIRECT in .env';
  }
  
  const apiKey = process.env.SERPAPI_KEY;
  if (USE_SERPAPI && (!apiKey || apiKey === 'your_serpapi_key_here')) {
    return '🔑 Please add SERPAPI_KEY to .env file. Get free key at: https://serpapi.com/users/sign_up';
  }
  
  return '😔 No products found. Try a different search term.';
}

module.exports = { getProductResults };