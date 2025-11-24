import React, { useState, useEffect } from 'react';
import { Search, ShoppingCart, TrendingUp, Shield, Zap, Filter, X, Star, Package, ExternalLink, ArrowRight, ShoppingBag, Moon, Sun, Trash2, Plus, Minus, Instagram } from 'lucide-react';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react'
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useUser } from '@clerk/clerk-react';
import useDarkMode from './useDarkMode';

// =======================================================
// 🛒 CONFIGURATION CONSTANTS
// =======================================================
const API_URL = import.meta.env.REACT_APP_API_URL || 'http://localhost:4000/api';

const ShopMate = () => {
  const { isSignedIn, user } = useUser();
  const cartData = useQuery(api.cart.getCart);
  const addItemMutation = useMutation(api.cart.addItem);
  const removeItemMutation = useMutation(api.cart.removeItem);
  const updateQuantityMutation = useMutation(api.cart.updateQuantity);
  const clearCartMutation = useMutation(api.cart.clearCart);
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const { isDarkMode, themeMode, toggleDarkMode, useSystemPreference } = useDarkMode();
  const [cartLoaded, setCartLoaded] = useState(false);

  const cart = cartData?.items || [];
  const [filters, setFilters] = useState({
    minPrice: 0,
    maxPrice: 100000,
    minRating: 0,
    category: 'all',
    dealsOnly: false,
    sort: 'relevance'
  });

  useEffect(() => {
    const loadCart = async () => {
      try {
        const result = await window.storage?.get('shopping-cart');
        if (result && result.value) {
          const savedCart = JSON.parse(result.value);
          console.log('✅ Cart loaded:', savedCart.length, 'items');
        }
      } catch (error) {
        console.log('No saved cart found or error loading cart:', error);
      } finally {
        setCartLoaded(true);
      }
    };
    loadCart();
  }, []);

  useEffect(() => {
    const saveCart = async () => {
      if (!cartLoaded) return;
      try {
        await window.storage?.set('shopping-cart', JSON.stringify(cart));
        console.log('💾 Cart saved:', cart.length, 'items');
      } catch (error) {
        console.error('Error saving cart:', error);
      }
    };
    saveCart();
  }, [cart, cartLoaded]);

  const Suraj = () => toggleDarkMode();

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setShowWelcome(false);
    try {
      const url = `${API_URL}/products?q=${encodeURIComponent(query)}`;
      console.log('🔍 Fetching from:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const fetchedProducts = data.products || [];
      setProducts(fetchedProducts);
      setSummary(data.summary || 'Search complete!');
      
      console.log('✅ Found', fetchedProducts.length, 'products');
    } catch (error) {
      console.error('Search Error:', error);
      setSummary(`Unable to fetch results. Error: ${error.message}. Make sure your backend is running at ${API_URL}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    if (p.price < filters.minPrice || p.price > filters.maxPrice) return false;
    if (p.rating < filters.minRating) return false;
    if (filters.dealsOnly && !p.discount) return false;
    return true;
  }).sort((a, b) => {
    switch (filters.sort) {
      case 'price_low': return a.price - b.price;
      case 'price_high': return b.price - a.price;
      case 'rating': return b.rating - a.rating;
      default: return 0;
    }
  });

  const resetFilters = () => {
    setFilters({
      minPrice: 0,
      maxPrice: 100000,
      minRating: 0,
      category: 'all',
      dealsOnly: false,
      sort: 'relevance'
    });
  };

  const goToComparePage = () => {
    localStorage.setItem('shopmate_products', JSON.stringify(products));
    window.location.href = './compare.html?mode=select';
  };

  const goToHome = () => {
    setQuery('');
    setProducts([]);
    setSummary('');
    setShowWelcome(true);
  };

  const addToCart = async (product) => {
    if (!isSignedIn) {
      alert("Please sign in to add items to cart");
      return;
    }

    try {
      await addItemMutation({
        id: product.id,
        productId: product.id,
        title: product.title,
        name: product.title,
        price: product.price,
        quantity: 1,
        image: product.image,
        link: product.link,
        store: product.store,
        rating: product.rating,
      });
    } catch (error) {
      console.error("Error adding to cart:", error);
      alert("Failed to add item to cart");
    }
  };

  const removeFromCart = async (productId) => {
    if (!isSignedIn) return;
    try {
      await removeItemMutation({ productId });
    } catch (error) {
      console.error("Error removing from cart:", error);
    }
  };

  const updateQuantity = async (productId, newQuantity) => {
    if (!isSignedIn) return;
    try {
      await updateQuantityMutation({ productId, quantity: newQuantity });
    } catch (error) {
      console.error("Error updating quantity:", error);
    }
  };

  const clearCart = async () => {
    if (!isSignedIn) return;
    try {
      await clearCartMutation();
    } catch (error) {
      console.error("Error clearing cart:", error);
    }
  };

  const getTotalPrice = () => cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  const getTotalItems = () => cart.reduce((total, item) => total + item.quantity, 0);

  const formatSummary = (text) => {
    if (!text) return null;
    const paragraphs = text.split('\n\n').filter(p => p.trim());
    return paragraphs.map((para, index) => {
      let formatted = para.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-purple-700 dark:text-purple-300">$1</strong>');
      formatted = formatted.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
      if (formatted.trim().startsWith('•') || formatted.trim().startsWith('-')) {
        return (
          <li key={index} className="ml-4 mb-2" dangerouslySetInnerHTML={{ __html: formatted.replace(/^[•\-]\s*/, '') }} />
        );
      }
      return (
        <p key={index} className="mb-4 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatted }} />
      );
    });
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${isDarkMode ? 'bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900' : 'bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500'}`}>
      <header className={`backdrop-blur-lg border-b sticky top-0 z-50 transition-colors duration-300 ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/10 border-white/20'}`}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={goToHome}
              className="flex items-center gap-3 group focus:outline-none"
            >
              <img 
                src="/logoicon.png" 
                alt="Shopping Cart" 
                className="w-10 h-10 group-hover:scale-110 transition-transform" 
              />
              <h1 className="text-3xl font-bold text-white group-hover:text-yellow-300 transition-colors">Findlee</h1>
            </button>
            <div className="flex items-center gap-4">
              <button
                onClick={Suraj}
                className={`p-2 rounded-xl backdrop-blur-lg font-semibold transition-all ${isDarkMode ? 'bg-gray-700/50 text-yellow-300 hover:bg-gray-600/50' : 'bg-white/20 text-white hover:bg-white/30'}`}
                title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setShowCart(!showCart)}
                className={`relative flex items-center gap-2 px-4 py-2 backdrop-blur-lg rounded-xl font-semibold transition-all ${isDarkMode ? 'bg-gray-700/50 text-white hover:bg-gray-600/50' : 'bg-white/20 text-white hover:bg-white/30'}`}
              >
                <ShoppingBag className="w-5 h-5" />
                <span>Cart</span>
                {getTotalItems() > 0 && (
                  <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center font-bold animate-pulse">
                    {getTotalItems()}
                  </span>
                )}
              </button>
              <button
                onClick={() => window.location.href = './compare.html'}
                className={`flex items-center gap-2 px-4 py-2 backdrop-blur-lg rounded-xl font-semibold transition-all ${isDarkMode ? 'bg-gray-700/50 text-white hover:bg-gray-600/50' : 'bg-white/20 text-white hover:bg-white/30'}`}
              >
                <ArrowRight className="w-5 h-5" />
                Compare
              </button>
              <div className="flex items-center gap-2 px-4 py-2 backdrop-blur-lg rounded-xl font-semibold transition-all text-white">💰Save time, Save Money💸</div>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className={`flex items-center gap-2 px-6 py-2 backdrop-blur-lg rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl transform hover:scale-105 ${isDarkMode ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700' : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Sign In
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <div className={`flex items-center gap-3 px-4 py-2 backdrop-blur-lg rounded-xl font-semibold transition-all ${isDarkMode ? 'bg-gray-700/50' : 'bg-white/20'}`}>
                  <UserButton 
                    appearance={{
                      elements: {
                        avatarBox: "w-8 h-8 ring-2 ring-white/30"
                      }
                    }}
                  />
                </div>
              </SignedIn>
            </div>
          </div>
        </div>
      </header>

      {showCart && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={() => setShowCart(false)}>
          <div 
            className={`absolute right-0 top-0 h-full w-full max-w-md shadow-2xl overflow-y-auto transition-colors duration-300 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Your Cart</h2>
                <button 
                  onClick={() => setShowCart(false)} 
                  className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                >
                  <X className={`w-6 h-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
                </button>
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`} />
                  <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Your cart is empty</p>
                  <p className={`text-sm mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Add some products to get started!</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    {cart.map((item) => (
                      <div key={item.id} className={`rounded-xl p-4 transition-colors ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <div className="flex gap-4">
                          <img 
                            src={item.image || 'https://via.placeholder.com/80?text=No+Image'} 
                            alt={item.title}
                            className="w-20 h-20 object-contain rounded-lg"
                          />
                          <div className="flex-1">
                            <h3 className={`font-semibold text-sm line-clamp-2 mb-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{item.title}</h3>
                            <p className="text-purple-600 dark:text-purple-400 font-bold mb-2">₹{item.price.toLocaleString('en-IN')}</p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${isDarkMode ? 'bg-gray-600 border-gray-500 hover:bg-gray-500' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className={`w-8 text-center font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${isDarkMode ? 'bg-gray-600 border-gray-500 hover:bg-gray-500' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="ml-auto text-red-500 hover:text-red-700 transition-colors"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                            <div className="mt-2">
                              <a
                                href={item.link} 
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`px-4 py-2 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 mt-2 w-full ${isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                title="View Deal"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className={`border-t pt-4 transition-colors ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className="flex justify-between items-center mb-4">
                      <span className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Total:</span>
                      <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">₹{getTotalPrice().toLocaleString('en-IN')}</span>
                    </div>
                    
                    <button
                      onClick={async () => {
                        if (!cart || cart.length === 0) {
                          alert('Your cart is empty — add some items first.');
                          return;
                        }

                        const lines = [];
                        lines.push('🛒 Findlee — Shared Cart');
                        lines.push('');

                        cart.forEach((item, i) => {
                          let safeLink = item.link ? item.link.replace(/\s/g, '%20') : null;
                          lines.push(`${i + 1}. ${item.title}`);
                          lines.push(`   Price: ₹${Number(item.price).toLocaleString('en-IN')}`);
                          lines.push(`   Quantity: ${item.quantity}`);
                          if (item.store) lines.push(`   Store: ${item.store}`);
                          if (safeLink) lines.push(`   Link: ${safeLink}`);
                          lines.push('');
                        });

                        lines.push(`Total Items: ${cart.reduce((t, x) => t + x.quantity, 0)}`);
                        lines.push(`Total Price: ₹${cart.reduce((t, x) => t + x.price * x.quantity, 0).toLocaleString('en-IN')}`);

                        const text = lines.join('\n');

                        try {
                          await navigator.clipboard.writeText(text);
                          alert('✅ Cart copied to clipboard! You can now paste it into WhatsApp, email, or anywhere else.');
                        } catch (err) {
                          console.error('Clipboard copy failed:', err);
                          alert('Could not copy automatically — displaying cart text instead.');
                          const w = window.open('', '_blank');
                          if (w) w.document.write(`<pre>${text.replace(/</g, '&lt;')}</pre>`);
                        }
                      }}
                      className="w-full py-3 mb-3 rounded-xl font-semibold transition-all bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center gap-2"
                      disabled={getTotalItems() === 0}
                    >
                      Share Cart ({getTotalItems()}) <ArrowRight className="w-5 h-5" />
                    </button>

                    <button 
                      onClick={clearCart}
                      className={`w-full py-3 mb-3 rounded-xl font-semibold transition-all ${isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    >
                      Clear Cart
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-grow">
        {/* WELCOME PAGE - CLEAN LIQUID GLASS SEARCH */}
        {showWelcome && (
          <div className="max-w-6xl mx-auto px-4 py-16">
            <div className="text-center mb-12 animate-fade-in">
              <h2 className="text-6xl font-bold text-white mb-4">
                Find the Best Deals, Instantly! ✨
              </h2>
              <p className="text-xl text-white/90 mb-16">
                Search across Amazon, Flipkart, eBay, and more in one place
              </p>
            </div>

            {/* 🎯 REFINED LIQUID GLASS SEARCH BAR */}
            <div className="max-w-4xl mx-auto mb-16 relative">
              {/* Subtle ambient glow */}
              <div className="absolute -inset-8 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-indigo-500/20 rounded-full blur-3xl"></div>
              
              <div className="relative group">
                {/* Main glass container */}
                <div className={`relative backdrop-blur-2xl rounded-[2.5rem] p-[2px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border transition-all duration-500 group-hover:shadow-[0_20px_80px_rgba(0,0,0,0.4)] ${isDarkMode ? 'bg-white/[0.08] border-white/20' : 'bg-white/[0.15] border-white/30'}`}>
                  {/* Inner glow layer */}
                  <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-white/5 via-transparent to-white/5"></div>
                  
                  {/* Content container */}
                  <div className={`relative backdrop-blur-xl rounded-[2.4rem] p-4 ${isDarkMode ? 'bg-gradient-to-br from-gray-800/40 to-gray-900/40' : 'bg-gradient-to-br from-white/10 to-white/5'}`}>
                    <div className="flex items-center gap-4">
                      {/* Icon with gradient */}
                      <div className="relative flex-shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl blur-lg opacity-60"></div>
                        <div className="relative flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600 rounded-2xl shadow-lg">
                          <Search className="w-8 h-8 text-white" />
                        </div>
                      </div>
                      
                      {/* Input field */}
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Search for laptops, phones, shoes, books..."
                        className={`flex-1 px-6 py-6 text-xl bg-transparent border-none outline-none font-medium ${isDarkMode ? 'text-white placeholder-white/50 caret-purple-400' : 'text-white placeholder-white/60 caret-pink-400'}`}
                      />
                      
                      {/* Search button */}
                      <button
                        onClick={handleSearch}
                        disabled={loading}
                        className="relative flex-shrink-0 px-10 py-5 bg-gradient-to-r from-pink-500 via-purple-500 to-purple-600 text-white rounded-2xl font-bold text-lg hover:from-pink-600 hover:via-purple-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-3"
                      >
                        {loading ? (
                          <>
                            <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                            Searching...
                          </>
                        ) : (
                          <>
                            Search
                            <ArrowRight className="w-6 h-6" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Subtle hint text */}
              <p className="text-center text-white/50 text-sm mt-6 font-medium">
                ✨ Press Enter or click Search to find the best deals
              </p>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
              <div className={`backdrop-blur-lg rounded-2xl p-6 border transition-all duration-300 transform hover:scale-105 hover:shadow-2xl cursor-pointer ${isDarkMode ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-800/70' : 'bg-white/10 border-white/20 hover:bg-white/20'}`}>
                <TrendingUp className="w-12 h-12 text-yellow-300 mx-auto mb-4 transition-transform duration-300 group-hover:rotate-12" />
                <h3 className="text-white font-semibold text-lg mb-2">Best Prices</h3>
                <p className="text-white/80 text-sm">Compare prices across all major stores</p>
              </div>
              
              <div className={`backdrop-blur-lg rounded-2xl p-6 border transition-all duration-300 transform hover:scale-105 hover:shadow-2xl cursor-pointer ${isDarkMode ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-800/70' : 'bg-white/10 border-white/20 hover:bg-white/20'}`}>
                <Shield className="w-12 h-12 text-green-300 mx-auto mb-4 transition-transform duration-300 group-hover:scale-110" />
                <h3 className="text-white font-semibold text-lg mb-2">Verified Deals</h3>
                <p className="text-white/80 text-sm">Only authentic offers and discounts</p>
              </div>
              
              <div className={`backdrop-blur-lg rounded-2xl p-6 border transition-all duration-300 transform hover:scale-105 hover:shadow-2xl cursor-pointer ${isDarkMode ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-800/70' : 'bg-white/10 border-white/20 hover:bg-white/20'}`}>
                <Zap className="w-12 h-12 text-blue-300 mx-auto mb-4 transition-transform duration-300 group-hover:rotate-12" />
                <h3 className="text-white font-semibold text-lg mb-2">AI Powered</h3>
                <p className="text-white/80 text-sm">Smart recommendations just for you</p>
              </div>
            </div>
          </div>
        )}

        {/* RESULTS PAGE - STICKY SEARCH BAR */}
        {!showWelcome && (
          <>
            <div className={`sticky top-[73px] z-40 backdrop-blur-lg border-b transition-colors duration-300 ${isDarkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/20 border-white/30'}`}>
              <div className="max-w-7xl mx-auto px-4 py-3">
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="Search for laptops, phones, shoes, books..."
                      className={`w-full pl-12 pr-4 py-3 rounded-xl shadow-lg text-base focus:outline-none focus:ring-2 transition-colors ${isDarkMode ? 'bg-gray-700 text-white focus:ring-purple-500' : 'bg-white focus:ring-purple-300'}`}
                    />
                  </div>
                  <button
                    onClick={handleSearch}
                    disabled={loading}
                    className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-semibold hover:from-pink-600 hover:to-purple-700 transition-all shadow-lg disabled:opacity-50"
                  >
                    {loading ? 'Searching...' : 'Search'}
                  </button>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`px-5 py-3 backdrop-blur-lg rounded-xl font-semibold transition-all flex items-center gap-2 ${isDarkMode ? 'bg-gray-700/70 text-white hover:bg-gray-600/70' : 'bg-white/30 text-white hover:bg-white/40'}`}
                  >
                    <Filter className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {showFilters && (
              <div className="max-w-7xl mx-auto px-4 py-4">
                <div className={`backdrop-blur-lg rounded-2xl p-6 border transition-colors ${isDarkMode ? 'bg-gray-800/70 border-gray-700' : 'bg-white/20 border-white/30'}`}>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-white font-semibold text-lg">Filters</h3>
                    <button onClick={resetFilters} className="text-white/80 hover:text-white text-sm">
                      Clear All
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                      <label className="text-white text-sm mb-2 block">Price Range</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={filters.minPrice}
                          onChange={(e) => setFilters({...filters, minPrice: Number(e.target.value)})}
                          className={`w-full px-3 py-2 rounded-lg text-sm ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-white'}`}
                          placeholder="Min"
                        />
                        <input
                          type="number"
                          value={filters.maxPrice}
                          onChange={(e) => setFilters({...filters, maxPrice: Number(e.target.value)})}
                          className={`w-full px-3 py-2 rounded-lg text-sm ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-white'}`}
                          placeholder="Max"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-white text-sm mb-2 block">Minimum Rating</label>
                      <select
                        value={filters.minRating}
                        onChange={(e) => setFilters({...filters, minRating: Number(e.target.value)})}
                        className={`w-full px-3 py-2 rounded-lg text-sm ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-white'}`}
                      >
                        <option value={0}>Any</option>
                        <option value={3}>3★ & above</option>
                        <option value={4}>4★ & above</option>
                        <option value={4.5}>4.5★ & above</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-white text-sm mb-2 block">Sort By</label>
                      <select
                        value={filters.sort}
                        onChange={(e) => setFilters({...filters, sort: e.target.value})}
                        className={`w-full px-3 py-2 rounded-lg text-sm ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-white'}`}
                      >
                        <option value="relevance">Relevance</option>
                        <option value="price_low">Price: Low to High</option>
                        <option value="price_high">Price: High to Low</option>
                        <option value="rating">Rating</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-white text-sm mb-2 block">Special Offers</label>
                      <label className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer ${isDarkMode ? 'bg-gray-700/50' : 'bg-white/20'}`}>
                        <input
                          type="checkbox"
                          checked={filters.dealsOnly}
                          onChange={(e) => setFilters({...filters, dealsOnly: e.target.checked})}
                          className="w-4 h-4"
                        />
                        <span className="text-white text-sm">Deals Only</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {summary && (
              <div className="max-w-7xl mx-auto px-4 py-4">
                <div className={`rounded-2xl shadow-2xl p-6 transition-colors duration-300 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className={`font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>AI Recommendation</h4>
                      <div className={`prose max-w-none ${isDarkMode ? 'text-gray-200' : 'text-gray-600'}`}>
                        {formatSummary(summary)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {filteredProducts.length > 0 && (
              <div className="max-w-7xl mx-auto px-4 py-4">
                <div className={`backdrop-blur-lg rounded-2xl p-4 border flex items-center justify-between transition-colors ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/10 border-white/20'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                      <ArrowRight className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-white font-semibold">Want to compare products?</h4>
                      <p className="text-white/70 text-sm">Select any 2 products and get AI-powered comparison</p>
                    </div>
                  </div>
                  <button
                    onClick={goToComparePage}
                    className={`px-6 py-3 rounded-xl font-semibold hover:shadow-2xl transition-all flex items-center gap-2 ${isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-white text-purple-600'}`}
                  >
                    <ArrowRight className="w-5 h-5" />
                    Compare
                  </button>
                </div>
              </div>
            )}

            <div className="max-w-7xl mx-auto px-4 pb-16 pt-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white text-xl font-semibold">{filteredProducts.length} Products Found</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProducts.map((product) => (
                  <div key={product.id} className={`rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-all hover:-translate-y-1 group ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                    <div className="relative">
                      <img src={product.image || 'https://via.placeholder.com/300x300?text=No+Image'} alt={product.title} className="w-full h-48 object-cover" />
                      <div className="absolute top-3 right-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-xs font-semibold">{product.store}</div>
                      {product.discount > 0 && (
                        <div className="absolute top-3 left-3 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">{product.discount}% OFF</div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className={`font-semibold mb-2 line-clamp-2 h-12 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{product.title}</h3>
                      <div className="flex items-center gap-1 mb-2">
                        {product.rating > 0 && (
                          <>
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{product.rating.toFixed(1)} ({product.reviews || 0})</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>₹{product.price.toLocaleString('en-IN')}</span>
                        {product.originalPrice > 0 && product.originalPrice !== product.price && (
                          <span className={`text-sm line-through ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>₹{product.originalPrice.toLocaleString('en-IN')}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <Package className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                        <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{product.shipping || 'Free Shipping'}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => addToCart(product)} className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-all flex items-center justify-center gap-2">
                          <ShoppingCart className="w-4 h-4" /> Add to Cart
                        </button>
                        <a
                          href={product.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`px-4 py-2 rounded-xl font-semibold transition-all flex items-center justify-center ${isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                          title="View Deal"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredProducts.length === 0 && !loading && (
                <div className={`text-center py-16 rounded-2xl ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                  <Search className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`} />
                  <p className={`text-xl ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>No products found matching your filters</p>
                  <button onClick={resetFilters} className="mt-4 px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-all">
                    Reset Filters
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {loading && (
          <div className="max-w-7xl mx-auto px-4 py-16">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent mb-4"></div>
              <p className="text-white text-xl font-semibold">Finding the best deals for you...</p>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER WITH INSTAGRAM ICON */}
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

export default ShopMate;
