let fetch;
if (typeof globalThis.fetch === 'function') {
  fetch = globalThis.fetch;
} else {
  fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
}

const W_R = 5;
const W_P = 2;
const W_IR = 8;

// 🚀 OPTIMIZATION: Use flash-thinking for faster responses
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
// Batch size: Process products in smaller groups to avoid Token Limits
const BATCH_SIZE = 25; 
// Max retries for 429 errors
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 2000;

/**
 * Helper: Pauses execution for a given time
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Helper: Fetch with Retry Logic (Exponential Backoff)
 */
async function fetchWithRetry(url, payload, attempt = 1) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.status === 429) {
      if (attempt > MAX_RETRIES) {
        throw new Error(`Max retries reached. 429 Too Many Requests.`);
      }
      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(`⚠️  Rate limited (429). Retrying in ${delay}ms (Attempt ${attempt}/${MAX_RETRIES})...`);
      await sleep(delay);
      return fetchWithRetry(url, payload, attempt + 1);
    }

    if (!response.ok) {
      const errorDetail = await response.text();
      throw new Error(`Gemini API returned ${response.status}: ${errorDetail}`);
    }

    return response.json();
  } catch (error) {
    throw error;
  }
}

async function rankProducts(query, productCandidates) {
  const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyCXu9NEoo9lL0L5fLIPIcX3z-zAyPfusqY';
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  // 1. Basic Validation
  if (!apiKey || apiKey === 'your_gemini_api_key_here' || productCandidates.length === 0) {
    console.log('⚠️  Gemini API not configured or no products - skipping AI ranking');
    return { rankedProducts: productCandidates, crsFailed: true };
  }

  // 2. Pre-process ALL products (calculate prices, basic scores)
  const allProcessedProducts = productCandidates.map((p, index) => {
    const id = String(p.id || index);
    const price = p.price || 0;
    const titleLower = p.title ? p.title.toLowerCase() : '';

    const is_accessory = titleLower.includes('case') ||
      titleLower.includes('cable') ||
      titleLower.includes('protector') ||
      titleLower.includes('charger') ||
      titleLower.includes('adapter') ||
      titleLower.includes('cover') ||
      titleLower.includes('stand');

    const reference_price = price > 10000 ? price * 1.15 : price * 2;
    const p_score = Math.max(0, Math.min(1, 1 - (price / reference_price)));

    return {
      originalIndex: index, // Keep track of original order
      id,
      title: p.title,
      store: p.store,
      price: p.price,
      is_accessory,
      p_score
    };
  });

  // 3. Prepare Batches
  const batches = [];
  for (let i = 0; i < allProcessedProducts.length; i += BATCH_SIZE) {
    batches.push(allProcessedProducts.slice(i, i + BATCH_SIZE));
  }

  console.log(`ℹ️  Processing ${allProcessedProducts.length} products in ${batches.length} batch(es)...`);

  const systemInstruction = `You are an E-commerce Relevance Engine. Score product matches to user queries.
Score each product with:
1. **R_Score**: 0.0-1.0 (relevance to query, higher = better match)
2. **Irrelevance_Penalty**: 0.9 if accessory AND query is for primary product, else 0.0
Return ONLY JSON array. No other text.`;

  let accumulatedAiScores = [];
  let hasFailure = false;

  // 4. Process Batches Sequentially (to prevent Rate Limits)
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    // Create prompt for this specific batch
    const batchProductsJson = JSON.stringify(batch.map(p => ({ id: p.id, title: p.title, is_accessory: p.is_accessory })), null, 2);
    const userQuery = `User Query: "${query}"\n\nProducts:\n${batchProductsJson}`;

    // Calculate tokens for this specific batch
    const estimatedTokensPerProduct = 80;
    const minTokens = 2048;
    const calculatedMaxTokens = Math.max(minTokens, batch.length * estimatedTokensPerProduct);

    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              id: { type: 'STRING' },
              R_Score: { type: 'NUMBER' },
              Irrelevance_Penalty: { type: 'NUMBER' }
            },
            required: ['id', 'R_Score', 'Irrelevance_Penalty']
          }
        },
        temperature: 0.1,
        maxOutputTokens: calculatedMaxTokens
      }
    };

    try {
      // Use the retry wrapper
      const result = await fetchWithRetry(apiUrl, payload);
      const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!jsonText) throw new Error('No text returned from AI');

      let batchScores;
      try {
        batchScores = JSON.parse(jsonText);
      } catch (e) {
        // Try to clean markdown if present
        const cleanedText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
        batchScores = JSON.parse(cleanedText);
      }

      if (Array.isArray(batchScores)) {
        accumulatedAiScores = [...accumulatedAiScores, ...batchScores];
      }

      // Optional: Small delay between successful batches to be polite to API
      if (i < batches.length - 1) await sleep(500);

    } catch (error) {
      console.error(`❌ Batch ${i + 1}/${batches.length} failed:`, error.message);
      hasFailure = true;
      // If a batch completely fails after retries, we continue to the next batch
      // so we can at least score some products.
    }
  }

  // 5. Final Ranking Calculation
  const rankedProducts = productCandidates.map((p, index) => {
    const id = String(p.id || index);
    const productData = allProcessedProducts.find(item => item.id === id);
    
    // Find AI score for this product (if it exists)
    const aiData = accumulatedAiScores.find(s => String(s.id) === id);

    // If AI failed for this specific item (or batch failed), fall back to defaults
    const R_Score = aiData?.R_Score ?? 0.5; 
    const Irrelevance_Penalty = aiData?.Irrelevance_Penalty ?? 0.0;
    const P_Score = productData?.p_score ?? 0.0;

    const CRS = (W_R * R_Score) + (W_P * P_Score) - (W_IR * Irrelevance_Penalty);

    return {
      ...p,
      CRS: Math.max(0, CRS),
      R_Score,
      P_Score,
      Irrelevance_Penalty
    };
  });

  // Sort by the new score
  rankedProducts.sort((a, b) => b.CRS - a.CRS);

  console.log(`✓ Ranking complete. Scored ${accumulatedAiScores.length}/${productCandidates.length} products via AI.`);

  // Return success even if some batches failed, as long as we have the original list
  return {
    rankedProducts,
    crsFailed: accumulatedAiScores.length === 0 // Only fail totally if we got 0 AI scores
  };
}

module.exports = { rankProducts };