import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingCart, Zap, Clock, CheckCircle, TrendingUp, Shield,
  Sparkles, X, Loader2, ArrowRight, Home, Target, ArrowDown, Check, Info, Moon, Sun, Instagram
} from 'lucide-react';

// --- 1. INLINED HOOK: Dark Mode ---
const useDarkMode = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const newMode = !prev;
      if (newMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
      return newMode;
    });
  };

  return { isDarkMode, toggleDarkMode };
};

// --- 2. API CONFIGURATION & HELPERS ---
const apiKey = "AIzaSyCXreOO7XfbcHLL15wXdv9DFFjw7gKHeZQ";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
const THROTTLE_DELAY_MS = 2000;

const fetchGeminiComparison = async (prompt, lastRequestTimeRef) => {
    const now = Date.now();
    if (now - lastRequestTimeRef.current < THROTTLE_DELAY_MS) {
        console.warn("Request throttled to prevent 429 errors.");
        return null;
    }
    lastRequestTimeRef.current = now;

    const makeRequest = async (retries = 0) => {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2000,
                    }
                })
            });

            if (response.status === 429 && retries < 3) {
                const delay = 1000 * Math.pow(2, retries);
                console.log(`Hit 429. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return makeRequest(retries + 1);
            }

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error("Malformed API response");
            return text;
        } catch (error) {
            console.error("API Request Failed:", error);
            throw error;
        }
    };

    return makeRequest();
};

// [Keep all your existing parseComparisonResult, StageLoader, ResultModal functions exactly as they are]
// I'm keeping them unchanged from your original code

const parseComparisonResult = (text, isDarkMode) => {
  if (!text) return { overallSummary: 'No comparison analysis available.', product1: null, product2: null };

  const textColor = isDarkMode ? 'text-gray-200' : 'text-gray-700';
  const dividerColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';
  const generalTextColor = isDarkMode ? 'text-gray-300' : 'text-gray-600';

  const formatProductContent = (content, isDarkMode) => {
    if (!content) return '';
    
    let formattedContent = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    let html = '';
    
    const innerSplitRegex = /(<strong>.*?<\/strong>)/g;
    const innerParts = formattedContent.split(innerSplitRegex).filter(part => part.trim() !== '');

    let processedBlocks = [];

    for (let i = 0; i < innerParts.length; i++) {
        let part = innerParts[i].trim();
        
        if (part.startsWith('<strong>') && part.endsWith('</strong>') && part.includes(':')) {
            const heading = part.replace(/<\/?strong>/g, '').trim().slice(0, -1); 
            const content = innerParts[i + 1] ? innerParts[i + 1].trim() : ''; 
            processedBlocks.push({ heading, content });
            i++; 
        } else if (part) {
            processedBlocks.push({ heading: null, content: part });
        }
    }

    processedBlocks.forEach(block => {
        const itemTextColor = isDarkMode ? 'text-gray-300' : 'text-gray-700';
        const itemBorderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';
        
        if (block.heading) {
            const heading = block.heading;
            let contentBody = block.content;

            let IconSvg, iconColor, badgeBg, badgeText;
            const lowerHeading = heading.toLowerCase();

            if (lowerHeading.includes('pro') || lowerHeading.includes('good') || lowerHeading.includes('benefit') || lowerHeading.includes('value')) {
                iconColor = 'text-green-500';
                badgeBg = 'bg-green-500/10';
                badgeText = 'text-green-400';
                IconSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 ${iconColor} flex-shrink-0 mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            } else if (lowerHeading.includes('con') || lowerHeading.includes('issue') || lowerHeading.includes('drawback') || lowerHeading.includes('weakness')) {
                iconColor = 'text-red-500';
                badgeBg = 'bg-red-500/10';
                badgeText = 'text-red-400';
                IconSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 ${iconColor} flex-shrink-0 mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
            } else {
                iconColor = 'text-blue-400';
                badgeBg = 'bg-blue-500/10';
                badgeText = 'text-blue-400';
                IconSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 ${iconColor} flex-shrink-0 mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
            }

            html += `<div class="mt-6 mb-4">`;
            html += `<span class="inline-flex items-center px-4 py-1.5 rounded-full text-lg font-extrabold ${badgeBg} ${badgeText} mb-4">${heading}</span>`;
            
            if (contentBody.includes('\n') || contentBody.includes('*') || contentBody.includes('-') || contentBody.includes('•')) {
                html += `<ul class="space-y-3 list-none pl-0 pt-2">`;
                
                contentBody.split(/[\n*\-•]/)
                   .map(item => item.trim())
                   .filter(item => item.length > 0)
                   .forEach(item => {
                       const itemClass = isDarkMode ? `bg-gray-800/20 hover:bg-gray-800 border-l-4 ${iconColor.replace('text', 'border')}` : `hover:bg-gray-50 border-l-4 ${iconColor.replace('text', 'border')}`;
                       html += `<li class="flex items-start gap-3 p-3 rounded-md transition-all duration-200 ${itemTextColor} font-medium leading-relaxed ${itemClass}">
                                  ${IconSvg}
                                  <span>${item}</span>
                                </li>`;
                   });

                html += `</ul>`;
            } else {
                html += `<p class="${itemTextColor} leading-relaxed mt-2">${contentBody}</p>`;
            }
            html += `</div>`;
        } else {
            html += `<p class="${generalTextColor} leading-relaxed mt-4">${block.content}</p>`;
        }
    });
    return html;
  };

  const productRegex = /(\*\*Product [12]:(.*?)\*\*)/g;
  const parts = text.split(productRegex).filter(part => part && part.trim());

  let overallSummary = parts[0] || 'Detailed comparison below.';
  let product1 = { title: 'Product 1', contentHtml: '' };
  let product2 = { title: 'Product 2', contentHtml: '' };

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (part.startsWith('**Product 1:')) {
      product1.title = parts[i+1].trim();
      product1.contentHtml = formatProductContent(parts[i+2], isDarkMode);
      i += 2;
    } else if (part.startsWith('**Product 2:')) {
      product2.title = parts[i+1].trim();
      product2.contentHtml = formatProductContent(parts[i+2], isDarkMode);
      i += 2;
    }
  }

  product1.title = product1.title.replace(/\*\*/g, '').trim();
  product2.title = product2.title.replace(/\*\*/g, '').trim();
  
  return { overallSummary: overallSummary, product1, product2 };
};

const StageLoader = ({ onComplete }) => {
    const stages = [
        { id: 1, text: 'Stage 1: Collecting up-to-date product data...', icon: ShoppingCart },
        { id: 2, text: 'Stage 2: Analyzing features, reviews, and value...', icon: TrendingUp },
        { id: 3, text: 'Stage 3: Generating the final structured comparison...', icon: Sparkles },
    ];
    const [currentStage, setCurrentStage] = useState(0);

    useEffect(() => {
        if (currentStage < stages.length) {
            const timer = setTimeout(() => {
                setCurrentStage(currentStage + 1);
            }, 1500);
            return () => clearTimeout(timer);
        } else if (currentStage === stages.length) {
            const finalTimer = setTimeout(onComplete, 500);
            return () => clearTimeout(finalTimer);
        }
    }, [currentStage, stages.length, onComplete]);

    return (
        <div className="flex flex-col items-center justify-center p-16 bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 text-white shadow-2xl min-h-[400px] animate-fade-in max-w-4xl mx-auto">
            <Zap className="w-20 h-20 text-yellow-400 mb-6 animate-pulse" />
            <h3 className="text-4xl font-black mb-10 text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
                AI Comparison in Progress...
            </h3>

            <div className="w-full max-w-lg space-y-6">
                {stages.map((stage, index) => {
                    const isActive = currentStage === index;
                    const isCompleted = currentStage > index;
                    const IconComponent = stage.icon;

                    return (
                        <div key={stage.id} className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${
                                isCompleted ? 'bg-green-500' : isActive ? 'bg-pink-500 ring-4 ring-pink-300' : 'bg-white/20'
                            }`}>
                                {isCompleted ? <Check className="w-4 h-4 text-white" /> : <IconComponent className={`w-4 h-4 ${isActive ? 'text-white animate-pulse' : 'text-white/70'}`} />}
                            </div>
                            <p className={`text-lg font-semibold transition-colors duration-500 ${isCompleted ? 'text-green-300' : isActive ? 'text-white' : 'text-white/50'}`}>
                                {stage.text}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const ResultModal = ({ result, onClose, isMainDarkMode }) => {
    const parsedData = parseComparisonResult(result, isMainDarkMode);
    const isDarkMode = isMainDarkMode;
    const modalBg = isDarkMode ? 'bg-gray-900' : 'bg-white';
    const headerBorder = isDarkMode ? 'border-gray-700' : 'border-gray-100';
    const mainText = isDarkMode ? 'text-white' : 'text-gray-800';
    const subText = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const iconBg = isDarkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200';
    const closeBtnText = isDarkMode ? 'text-gray-400 hover:text-red-400' : 'text-gray-500';
    const productCardBg = isDarkMode ? 'bg-gray-800/70 border-gray-700' : 'bg-gray-50 border-gray-200';
    const productCardTitleBg = 'bg-gradient-to-r from-purple-700 to-pink-600'; 
    const summaryCardBg = isDarkMode ? 'bg-gray-800 border-yellow-500/50' : 'bg-yellow-50 border-yellow-300/50';

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className={`${modalBg} rounded-3xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-y-auto p-10 transform transition-colors duration-300`}>
                <div className={`flex justify-between items-start border-b ${headerBorder} pb-4 mb-6 sticky top-0 ${modalBg} z-10 transition-colors duration-300`}>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 border border-gray-200">
                            <Sparkles className="w-7 h-7 text-purple-600" />
                        </div>
                        <div>
                            <h3 className={`text-3xl font-black ${mainText} mb-1 transition-colors duration-300`}>AI Comparison Complete!</h3>
                            <p className={subText}>Your detailed analysis, structured for clarity.</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className={`p-3 rounded-full ${iconBg} ${closeBtnText} transition-colors focus:outline-none focus:ring-4 focus:ring-purple-200`}
                        title="Close"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="space-y-8">
                    <div className={`${summaryCardBg} rounded-2xl p-6 border-2 transition-colors duration-300`}>
                        <div className="flex items-center gap-3 mb-4">
                            <Info className="w-6 h-6 text-yellow-500" />
                            <h4 className={`text-xl font-bold ${isDarkMode ? 'text-yellow-400' : 'text-gray-800'}`}>Overall Verdict</h4>
                        </div>
                        <p className={isDarkMode ? 'text-gray-200' : 'text-gray-700'} dangerouslySetInnerHTML={{ __html: parsedData.overallSummary.replace(/\*\*/g, '<strong>').replace(/<\/?strong>/g, '</strong>') }} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {parsedData.product1.contentHtml && (
                            <div className={`${productCardBg} rounded-2xl shadow-xl border transition-colors duration-300`}>
                                <div className={`p-4 rounded-t-2xl ${productCardTitleBg} text-white font-black text-xl text-center shadow-lg`}>
                                    {parsedData.product1.title}
                                </div>
                                <div className="p-6">
                                    <div dangerouslySetInnerHTML={{ __html: parsedData.product1.contentHtml }} />
                                </div>
                            </div>
                        )}
                        
                        {parsedData.product2.contentHtml && (
                            <div className={`${productCardBg} rounded-2xl shadow-xl border transition-colors duration-300`}>
                                <div className={`p-4 rounded-t-2xl ${productCardTitleBg} text-white font-black text-xl text-center shadow-lg`}>
                                    {parsedData.product2.title}
                                </div>
                                <div className="p-6">
                                    <div dangerouslySetInnerHTML={{ __html: parsedData.product2.contentHtml }} />
                                </div>
                            </div>
                        )}

                        {!parsedData.product1.contentHtml && !parsedData.product2.contentHtml && (
                            <div className="lg:col-span-2 text-center p-10">
                                <p className={subText}>Could not generate a structured side-by-side comparison. Displaying raw text:</p>
                                <pre className={`${isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-700'} p-4 mt-4 rounded-lg overflow-auto text-sm`}>
                                    {result}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
                
                <div className={`mt-10 pt-4 border-t ${headerBorder} text-center transition-colors duration-300`}>
                    <p className={subText}>Analysis provided by Findlee AI. Always verify details with the retailer before purchasing.</p>
                </div>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
const ComparisonPage = () => {
    const getUrlParameter = (name) => {
        name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
        const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
        const results = regex.exec(window.location.search);
        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    };

    const initialMode = getUrlParameter('mode') === 'select' ? 'select' : 'prompt';
    const [comparisonMode, setComparisonMode] = useState(initialMode);
    
    const [promptText, setPromptText] = useState('');
    const [selectedProducts, setSelectedProducts] = useState([null, null]);
    const [loading, setLoading] = useState(false);
    const [comparisonResult, setComparisonResult] = useState(null);
    const [availableProducts, setAvailableProducts] = useState([]);
    const [showResultModal, setShowResultModal] = useState(false);

    const lastRequestTime = useRef(0);
    const { isDarkMode, toggleDarkMode } = useDarkMode();

    useEffect(() => {
        const storedProducts = localStorage.getItem('shopmate_products');
        if (storedProducts) {
          try {
            const products = JSON.parse(storedProducts);
            setAvailableProducts(products);
          } catch (e) {
            console.error('Error parsing stored products:', e);
          }
        }
    }, []);

    const scrollToCompare = () => {
        const compareSection = document.getElementById("compare");
        if (compareSection) {
            const targetPosition = compareSection.offsetTop;
            const scrollOffset = 150;
            window.scrollTo({
                top: targetPosition + scrollOffset,
                behavior: "smooth",
            });
        }
    };

    useEffect(() => {
        if (comparisonMode === 'select') {
            const timer = setTimeout(scrollToCompare, 100);
            return () => clearTimeout(timer);
        }
    }, [comparisonMode]);

    const startComparison = (result) => {
        setLoading(false);
        setComparisonResult(result);
        setShowResultModal(true);
    };

    const handlePromptCompare = async () => {
        if (!promptText.trim() || loading) return;
        setComparisonResult(null);
        setLoading(true);

        const prompt = `Compare these products or options: ${promptText}. Provide a CONCISE summary, key pros and cons for each option, and a clear, single best recommendation.

        STRUCTURE MUST BE:
        [OVERALL SUMMARY AND RECOMMENDATION]
        **Product 1: [Product Name 1]**
        **Pros:**
        * Point 1
        * Point 2
        **Cons:**
        * Point 1
        * Point 2
        **Features:**
        * Point 1

        **Product 2: [Product Name 2]**
        **Pros:**
        * Point 1
        * Point 2
        **Cons:**
        * Point 1

        The first paragraph must be the general summary/recommendation. Use a clear, bold title for the product and bold headings for sections like **Pros:** and **Cons:**.`;

        try {
            const result = await fetchGeminiComparison(prompt, lastRequestTime);
            if (result) {
                 setTimeout(() => startComparison(result), 4500);
            } else {
                setLoading(false);
            }
        } catch (error) {
            setLoading(false);
            alert('Failed to generate comparison. Please try again.');
        }
    };

    const handleProductSelect = (product, index) => {
        const newSelected = [...selectedProducts];
        newSelected[index] = product;
        setSelectedProducts(newSelected);
    };

    const handleProductCompare = async () => {
        if (!selectedProducts[0] || !selectedProducts[1]) return;
        setComparisonResult(null);
        setLoading(true);

        const prompt = `Compare these two products in detail and provide a CONCISE breakdown:

        Product 1: ${selectedProducts[0].title}
        Price: ₹${selectedProducts[0].price}
        Store: ${selectedProducts[0].store}
        Rating: ${selectedProducts[0].rating}/5

        Product 2: ${selectedProducts[1].title}
        Price: ₹${selectedProducts[1].price}
        Store: ${selectedProducts[1].store}
        Rating: ${selectedProducts[1].rating}/5

        STRUCTURE MUST BE:
        [OVERALL SUMMARY AND RECOMMENDATION]
        **Product 1: ${selectedProducts[0].title}**
        **Pros:**
        * Point 1
        * Point 2
        **Cons:**
        * Point 1
        * Point 2
        **Features:**
        * Point 1

        **Product 2: ${selectedProducts[1].title}**
        **Pros:**
        * Point 1
        * Point 2
        **Cons:**
        * Point 1

        The first paragraph must be the general summary/recommendation. Use a clear, bold title for the product and bold headings for sections like **Pros:** and **Cons:**.`;

        try {
            const result = await fetchGeminiComparison(prompt, lastRequestTime);
            if (result) {
                setTimeout(() => startComparison(result), 4500);
            } else {
                 setLoading(false);
            }
        } catch (error) {
            setLoading(false);
            alert('Failed to generate comparison. Please try again.');
        }
    };

    const goToMainPage = () => {
        window.location.href = './index.html';
    };

    const handlePromptKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handlePromptCompare();
        }
    };

    const ToggleIcon = isDarkMode ? Sun : Moon;

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${isDarkMode ? 'bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900' : 'bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500'}`}>
      
      {/* Header */}
      <header className={`backdrop-blur-lg border-b sticky top-0 z-50 transition-colors duration-300 ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/10 border-white/20'}`}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={goToMainPage}
              className="flex items-center gap-3 cursor-pointer group focus:outline-none"
            >
              <img
                src="/logoicon.png"
                alt="Shopping Cart"
                className="w-10 h-10 group-hover:scale-110 transition-transform"
                onError={(e) => e.target.style.display='none'}
              />
              <h1 className="text-3xl font-bold text-white group-hover:text-yellow-300 transition-colors">Findlee</h1>
            </button>

            <div className="flex items-center gap-4">
              <button
                onClick={toggleDarkMode}
                className={`p-2 rounded-xl backdrop-blur-lg font-semibold transition-all ${isDarkMode ? 'bg-gray-700/50 text-yellow-300 hover:bg-gray-600/50' : 'bg-white/20 text-white hover:bg-white/30'}`}
                title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
              >
                <ToggleIcon className="w-5 h-5" />
              </button>
              <button
                onClick={goToMainPage}
                className={`flex items-center gap-2 px-4 py-2 backdrop-blur-lg rounded-xl font-semibold transition-all ${isDarkMode ? 'bg-gray-700/50 text-white hover:bg-gray-600/50' : 'bg-white/20 text-white hover:bg-white/30'}`}
              >
                <Home className="w-5 h-5" />
                Main Page
              </button>
              <div className="flex items-center gap-2 px-4 py-2 backdrop-blur-lg rounded-xl font-semibold transition-all text-white">💰Save time, Save Money💸</div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="flex-grow">
        <section className="min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden">
          {/* Breathing gradient background */}
          <div className="absolute inset-0 overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br from-transparent via-transparent ${isDarkMode ? 'to-gray-900/90' : 'to-transparent/90'}`} />
            <div className={`absolute top-0 left-1/4 w-[800px] h-[800px] rounded-full blur-[150px] animate-pulse ${isDarkMode ? 'bg-purple-900/30' : 'bg-white/10'}`} />
            <div className={`absolute bottom-0 right-1/4 w-[600px] h-[600px] rounded-full blur-[120px] animate-pulse ${isDarkMode ? 'bg-pink-900/40' : 'bg-white/15'}`} style={{ animationDelay: "1.5s" }} />
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-[140px] animate-pulse ${isDarkMode ? 'bg-indigo-900/20' : 'bg-white/5'}`} style={{ animationDelay: "3s" }} />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto text-center space-y-16">
            <div className="space-y-6 animate-fade-in">
              <h1 className="text-7xl md:text-8xl font-black text-white mb-4 tracking-tight">
                Compare
              </h1>
              <p className="text-3xl text-white/90 max-w-4xl mx-auto leading-relaxed font-bold">
                Smart AI-Powered Comparisons
              </p>
              <p className="text-xl text-white/70 max-w-3xl mx-auto leading-relaxed">
                Get instant, intelligent comparisons using advanced AI
              </p>
            </div>

            {/* Feature cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className={`backdrop-blur-lg rounded-2xl p-6 border transition-all duration-300 transform hover:scale-105 hover:shadow-2xl cursor-pointer ${isDarkMode ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-800/70' : 'bg-white/10 border-white/20 hover:bg-white/20'}`}>
                <Target className="w-12 h-12 text-yellow-300 mx-auto mb-4" />
                <h3 className="text-white font-semibold text-lg mb-2">Accurate Results</h3>
                <p className="text-white/80 text-sm">AI-powered comparisons that understand what you really need</p>
              </div>

              <div className={`backdrop-blur-lg rounded-2xl p-6 border transition-all duration-300 transform hover:scale-105 hover:shadow-2xl cursor-pointer ${isDarkMode ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-800/70' : 'bg-white/10 border-white/20 hover:bg-white/20'}`}>
                <Zap className="w-12 h-12 text-blue-300 mx-auto mb-4" />
                <h3 className="text-white font-semibold text-lg mb-2">Smart Search</h3>
                <p className="text-white/80 text-sm">Intelligent analysis of products and options</p>
              </div>

              <div className={`backdrop-blur-lg rounded-2xl p-6 border transition-all duration-300 transform hover:scale-105 hover:shadow-2xl cursor-pointer ${isDarkMode ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-800/70' : 'bg-white/10 border-white/20 hover:bg-white/20'}`}>
                <Clock className="w-12 h-12 text-green-300 mx-auto mb-4" />
                <h3 className="text-white font-semibold text-lg mb-2">Save Time</h3>
                <p className="text-white/80 text-sm">Get instant comparisons instead of hours of research</p>
              </div>

              <div className={`backdrop-blur-lg rounded-2xl p-6 border transition-all duration-300 transform hover:scale-105 hover:shadow-2xl cursor-pointer ${isDarkMode ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-800/70' : 'bg-white/10 border-white/20 hover:bg-white/20'}`}>
                <CheckCircle className="w-12 h-12 text-pink-300 mx-auto mb-4" />
                <h3 className="text-white font-semibold text-lg mb-2">Best Choices</h3>
                <p className="text-white/80 text-sm">Clear recommendations to help you decide confidently</p>
              </div>
            </div>

            <button
              onClick={scrollToCompare}
              className="mt-16 h-20 px-16 text-xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-2xl hover:shadow-2xl transition-all duration-500 hover:scale-110 flex items-center gap-3 mx-auto"
            >
              <span>Start Comparing Now</span>
              <ArrowDown className="h-6 w-6" />
            </button>
          </div>
        </section>

        {/* Comparison Section */}
        <section id="compare" className="min-h-screen p-8 relative">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-5xl font-bold text-white text-center mb-12">Choose Your Comparison Method</h2>

            {loading ? (
              <StageLoader onComplete={() => {}} />
            ) : (
              <>
                {/* Mode Selection */}
                <div className="flex justify-center gap-4 mb-12">
                  <button
                    onClick={() => setComparisonMode('prompt')}
                    className={`px-8 py-4 rounded-2xl font-semibold transition-all ${
                      comparisonMode === 'prompt'
                        ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-2xl scale-105'
                        : isDarkMode
                          ? 'bg-gray-800 text-white hover:bg-gray-700'
                          : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    Compare by Description
                  </button>
                  <button
                    onClick={() => setComparisonMode('select')}
                    className={`px-8 py-4 rounded-2xl font-semibold transition-all ${
                      comparisonMode === 'select'
                        ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-2xl scale-105'
                        : isDarkMode
                          ? 'bg-gray-800 text-white hover:bg-gray-700'
                          : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    Select Products to Compare
                  </button>
                </div>

                {/* Prompt Mode with LIQUID GLASS */}
                {comparisonMode === 'prompt' && (
                  <div className="max-w-3xl mx-auto mb-16 relative">
                    {/* Subtle ambient glow */}
                    <div className="absolute -inset-8 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-indigo-500/20 rounded-full blur-3xl"></div>
                    
                    <div className="relative group">
                      {/* Main glass container */}
                      <div className={`relative backdrop-blur-2xl rounded-[2.5rem] p-[2px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border transition-all duration-500 group-hover:shadow-[0_20px_80px_rgba(0,0,0,0.4)] ${isDarkMode ? 'bg-white/[0.08] border-white/20' : 'bg-white/[0.15] border-white/30'}`}>
                        {/* Inner glow layer */}
                        <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-white/5 via-transparent to-white/5"></div>
                        
                        {/* Content container */}
                        <div className={`relative backdrop-blur-xl rounded-[2.4rem] p-6 ${isDarkMode ? 'bg-gradient-to-br from-gray-800/40 to-gray-900/40' : 'bg-gradient-to-br from-white/10 to-white/5'}`}>
                          <h3 className="text-2xl font-bold text-white mb-4">Enter Products to Compare</h3>
                          <p className="text-white/70 mb-6">Describe the products you want to compare. <strong className="text-yellow-300">Press Enter to Compare.</strong></p>
                          
                          <textarea
                            value={promptText}
                            onChange={(e) => setPromptText(e.target.value)}
                            onKeyDown={handlePromptKeyPress}
                            placeholder="e.g., iPhone 15 Pro vs Samsung Galaxy S24 Ultra..."
                            className={`w-full p-4 rounded-xl min-h-32 focus:outline-none focus:ring-4 mb-4 ${isDarkMode ? 'bg-gray-700 text-white placeholder-white/50 focus:ring-purple-500' : 'bg-white text-gray-800 placeholder-gray-500 focus:ring-purple-300'}`}
                          />

                          <button
                            onClick={handlePromptCompare}
                            disabled={loading || !promptText.trim()}
                            className="w-full px-10 py-4 bg-gradient-to-r from-pink-500 via-purple-500 to-purple-600 text-white rounded-2xl font-bold text-lg hover:from-pink-600 hover:via-purple-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                          >
                            <Zap className="w-6 h-6" />
                            Compare Now
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Select Mode - EXACT SAME AS YOUR ORIGINAL */}
                {comparisonMode === 'select' && (
                   <div className="space-y-8">
                      <div className={`backdrop-blur-lg rounded-3xl p-8 ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/10 border-white/20'} border`}>
                          <h3 className="text-2xl font-bold text-white mb-6">Select Two Products to Compare</h3>
                          <div className="grid grid-cols-2 gap-6 mb-6">
                              {/* Product Slot 1 */}
                              <div className={`${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-white/5 border-white/30'} rounded-2xl p-6 border-2 border-dashed`}>
                                  <h4 className="text-white font-semibold mb-4 text-center">Product 1</h4>
                                  {selectedProducts[0] ? (
                                      <div className="bg-white rounded-xl p-4 relative">
                                          <button
                                              onClick={() => handleProductSelect(null, 0)}
                                              className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                                          >
                                              <X className="w-4 h-4" />
                                          </button>
                                          <img
                                            src={selectedProducts[0].image || 'https://via.placeholder.com/150?text=No+Image'}
                                            alt={selectedProducts[0].title}
                                            className="w-full h-32 object-contain mb-3"
                                            onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=No+Image'; }}
                                          />
                                          <h5 className="font-semibold text-gray-800 mb-2 line-clamp-2 h-10">{selectedProducts[0].title}</h5>
                                          <p className="text-gray-600">₹{selectedProducts[0].price.toLocaleString()}</p>
                                          <p className="text-sm text-gray-500">{selectedProducts[0].store}</p>
                                      </div>
                                  ) : (
                                      <div className="text-center text-white/50 py-12">
                                          Select a product below
                                      </div>
                                  )}
                              </div>

                              {/* Product Slot 2 */}
                              <div className={`${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-white/5 border-white/30'} rounded-2xl p-6 border-2 border-dashed`}>
                                  <h4 className="text-white font-semibold mb-4 text-center">Product 2</h4>
                                  {selectedProducts[1] ? (
                                      <div className="bg-white rounded-xl p-4 relative">
                                          <button
                                              onClick={() => handleProductSelect(null, 1)}
                                              className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                                          >
                                              <X className="w-4 h-4" />
                                          </button>
                                          <img
                                            src={selectedProducts[1].image || 'https://via.placeholder.com/150?text=No+Image'}
                                            alt={selectedProducts[1].title}
                                            className="w-full h-32 object-contain mb-3"
                                            onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=No+Image'; }}
                                          />
                                          <h5 className="font-semibold text-gray-800 mb-2 line-clamp-2 h-10">{selectedProducts[1].title}</h5>
                                          <p className="text-gray-600">₹{selectedProducts[1].price.toLocaleString()}</p>
                                          <p className="text-sm text-gray-500">{selectedProducts[1].store}</p>
                                      </div>
                                  ) : (
                                      <div className="text-center text-white/50 py-12">
                                          Select a product below
                                      </div>
                                  )}
                              </div>
                          </div>

                          <button
                              onClick={handleProductCompare}
                              disabled={loading || !selectedProducts[0] || !selectedProducts[1]}
                              className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-semibold hover:from-pink-600 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                              <ArrowRight className="w-5 h-5" />
                              Compare Selected Products
                          </button>
                      </div>

                      {/* Available Products */}
                      <div>
                          <h4 className="text-2xl font-bold text-white mb-6">
                              {availableProducts.length > 0 ? 'Available Products' : 'No Products Available'}
                          </h4>
                          {availableProducts.length === 0 ? (
                              <div className={`backdrop-blur-lg rounded-2xl p-12 text-center ${isDarkMode ? 'bg-gray-800/50' : 'bg-white/10'}`}>
                                  <div className="text-6xl mb-4">🔍</div>
                                  <h5 className="text-2xl font-bold text-white mb-3">No Products to Compare</h5>
                                  <p className="text-white/70 mb-6">Search for products on the main page first to enable comparison</p>
                                  <a
                                  href="./index.html"
                                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-purple-600 rounded-xl font-semibold hover:shadow-2xl transition-all"
                                  >
                                  <Home className="w-5 h-5" />
                                  Go to Main Page
                                  </a>
                              </div>
                          ) : (
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                  {availableProducts.map((product) => (
                                  <button
                                      key={product.id}
                                      onClick={() => {
                                      const firstEmpty = selectedProducts[0] === null ? 0 : selectedProducts[1] === null ? 1 : null;
                                      if (firstEmpty !== null) {
                                          handleProductSelect(product, firstEmpty);
                                      }
                                      }}
                                      disabled={selectedProducts.some(p => p?.id === product.id)}
                                      className="bg-white rounded-xl p-4 hover:shadow-2xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                                  >
                                      <img
                                      src={product.image || 'https://via.placeholder.com/150?text=No+Image'}
                                      alt={product.title}
                                      className="w-full h-32 object-contain mb-3"
                                      onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=No+Image'; }}
                                      />
                                      <h5 className="font-semibold text-gray-800 mb-2 text-sm line-clamp-2 h-10">{product.title}</h5>
                                      <p className="text-gray-600 font-bold">₹{product.price.toLocaleString()}</p>
                                      <div className="flex items-center justify-between mt-2">
                                      <p className="text-xs text-gray-500">{product.store}</p>
                                      {product.rating > 0 && (
                                          <p className="text-xs text-yellow-600">★ {product.rating}</p>
                                      )}
                                      </div>
                                  </button>
                                  ))}
                              </div>
                          )}
                      </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {/* Comparison Result Modal */}
      {showResultModal && comparisonResult && (
        <ResultModal
          result={comparisonResult}
          onClose={() => setShowResultModal(false)}
          isMainDarkMode={isDarkMode}
        />
      )}

      {/* Footer */}
      <footer className={`${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/10 border-white/20'} backdrop-blur-lg border-t py-6 mt-auto`}>
        <div className="max-w-7xl mx-auto px-4 text-center text-white/80 text-sm">
          <p className="mb-2">© 2025 Findlee - Save Time, Save Money | Powered by AI</p>
          <a 
            href='https://www.instagram.com/findl_ee/' 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-white/90 hover:text-pink-400 transition-colors"
          >
            <Instagram className="w-5 h-5" />
            <span>@findl_ee</span>
          </a>
        </div>
      </footer>
    </div>
  );
};

export default ComparisonPage;
