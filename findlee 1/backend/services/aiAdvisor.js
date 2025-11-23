let fetch;
if (typeof globalThis.fetch === 'function') {
  fetch = globalThis.fetch;
} else {
  fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
}

const GEMINI_MODEL = 'gemini-2.0-flash';

async function aiVerdict(products, crsFailureMessage = '') {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    console.log('⚠️ Gemini API not configured - using fallback summary');
    return generateFallbackSummary(products, crsFailureMessage);
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const productLines = products
      .slice(0, 5)
      .map((p, i) => {
        const details = [];
        if (p.rating > 0) details.push(`⭐ ${p.rating}`);
        if (p.discount > 0) details.push(`💰 ${p.discount}% off`);
        if (p.reviews > 0) details.push(`📝 ${p.reviews.toLocaleString()} reviews`);
        
        // 🔧 FIX: Show CRS score if available to help AI understand ranking
        if (p.CRS !== undefined) details.push(`🎯 Score: ${p.CRS.toFixed(2)}`);

        const detailsStr = details.length > 0 ? `(${details.join(', ')})` : '';
        const ranking = i === 0 ? '👑 #1 BEST MATCH' : `#${i + 1}`;
        return `${ranking}. ${p.title}\n   ₹${p.price.toLocaleString()} - ${p.store} ${detailsStr}`;
      })
      .join('\n\n');

    // 🔧 FIX: Clear instruction to endorse the #1 product
    const systemInstruction = `You are ShopMate, an AI shopping assistant. Your ONLY job is to write a compelling endorsement for whichever product is listed as "#1" (marked with 👑). You MUST recommend the #1 product - do NOT choose a different product. Explain why the #1 product is the best choice in 6-8 sentences. Be enthusiastic and concise.`;

    const topProduct = products[0];
    const userPrompt = `Write an enthusiastic endorsement for this product (which is our #1 ranked choice):

**TOP RECOMMENDATION:**
${topProduct.title} - ₹${topProduct.price.toLocaleString()} from ${topProduct.store}
${topProduct.rating > 0 ? `Rating: ⭐ ${topProduct.rating}/5` : ''}
${topProduct.reviews > 0 ? `Reviews: ${topProduct.reviews.toLocaleString()}` : ''}
${topProduct.discount > 0 ? `Discount: ${topProduct.discount}% off` : ''}

**Alternatives for comparison:**
${products.slice(1, 5).map((p, i) => `#${i + 2}. ${p.title} - ₹${p.price.toLocaleString()} from ${p.store}`).join('\n')}

${crsFailureMessage ? `\nNote: ${crsFailureMessage}\n` : ''}
Write your endorsement for the #1 product (${topProduct.store} - ${topProduct.title.slice(0, 50)}...):`;

    const requestBody = {
      contents: [{
        parts: [{
          text: userPrompt
        }]
      }],
      systemInstruction: {
        parts: [{
          text: systemInstruction
        }]
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 512, 
        topP: 0.95,
        topK: 40
      }
    };

    console.log('📤 Sending request to Gemini API...');
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error('❌ Unexpected Gemini API response structure:', JSON.stringify(data));
      throw new Error('Invalid response structure from Gemini API');
    }

    const candidate = data.candidates[0];
    
    if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION' || candidate.finishReason === 'MAX_TOKENS') {
      console.warn('⚠️ Gemini response blocked or cut off:', candidate.finishReason);
      return generateFallbackSummary(products, crsFailureMessage);
    }

    const parts = candidate.content.parts;
    if (!parts || parts.length === 0 || !parts[0].text) {
      console.error('❌ No text in Gemini response parts:', JSON.stringify(candidate));
      throw new Error('No text content in Gemini response');
    }

    const verdict = parts[0].text.trim();
    
    if (!verdict) {
      console.warn('⚠️ Empty verdict from Gemini, using fallback');
      return generateFallbackSummary(products, crsFailureMessage);
    }

    console.log('✓ AI verdict generated successfully');
    return verdict;

  } catch (error) {
    console.error('❌ Gemini API error:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    return generateFallbackSummary(products, crsFailureMessage);
  }
}

function generateFallbackSummary(products, note) {
  if (products.length === 0) {
    return 'No products available to analyze.';
  }

  // 🔧 FIX: Always use products[0] as the top recommendation
  const topProduct = products[0];
  const hasDiscount = topProduct.discount > 0;
  const hasRating = topProduct.rating > 0;
  const hasReviews = topProduct.reviews > 0;
  const otherProductsCount = products.length - 1;

  let summary = `Our **#1 top recommendation** is the **${topProduct.title}** from **${topProduct.store}** for ₹${topProduct.price.toLocaleString()}.`;

  if (hasDiscount) {
    summary += ` This fantastic deal includes a huge **${topProduct.discount}% off** the original price, making it an excellent value choice.`;
  } else {
    summary += ` It stands out as the best choice based on its competitive price and overall value.`;
  }
  
  if (hasRating) {
    summary += ` Customers love this product, giving it a high rating of **⭐ ${topProduct.rating}/5**.`;
    if (hasReviews) {
      summary += ` With ${topProduct.reviews.toLocaleString()} verified reviews, you can shop with confidence.`;
    }
  } else if (hasReviews) {
    summary += ` This product has been widely purchased and reviewed by ${topProduct.reviews.toLocaleString()} customers.`;
  }

  if (products.length > 1) {
    const secondBest = products[1];
    const priceDiff = secondBest.price - topProduct.price;
    
    if (priceDiff > 0) {
      summary += ` Compared to the #2 option at ₹${secondBest.price.toLocaleString()}, you're **saving ₹${priceDiff.toLocaleString()}** with this choice!`;
    } else if (priceDiff < 0) {
      summary += ` While there are cheaper options available, this product offers the best overall **value for money** based on quality, features, and customer satisfaction.`;
    }
  }
  
  if (note) {
    summary += ` ${note}`;
  }

  return summary;
}

module.exports = { aiVerdict };