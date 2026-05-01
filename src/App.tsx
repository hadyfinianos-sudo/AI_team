/// <reference types="vite/client" />
import { useState, useEffect, useMemo, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Virtuoso } from 'react-virtuoso';
import { Menu, X, BookOpen, Settings, Eye, Loader2, Search, Share2, LayoutList, ChevronDown, Video } from 'lucide-react';
import Fuse from 'fuse.js';
import { Article } from './types';
import PDFViewer from './components/PDFViewer';
import AdminPanel from './components/AdminPanel';
import DynamicTheme from './components/DynamicTheme';
import { supabase, checkIsAdmin } from './lib/supabase';

// Persistence & Deployment Test - Successful Sync
const MainSite = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title-asc' | 'title-desc'>('newest');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    document.documentElement.dir = "rtl";
    document.documentElement.lang = "ar";

    const fetchData = async () => {
      try {
        if (!supabase) {
           console.error("[Sovereign] CRITICAL: Supabase environment variables are missing!");
           setData(null);
           setLoading(false);
           return;
        }

        console.log('[Sovereign] Initializing Cloud Handshake (settings table)...');
        const { data: supaData, error } = await supabase.from('settings').select('data').eq('id', 1).single();
        
        let registryData: any = null;
        if (error) {
           console.error('[Sovereign] Cloud Handshake FAILED:', error.message);
           setData(null);
        } else if (supaData && supaData.data) {
           console.log('[Sovereign] Cloud data acquired. Overwriting local state.');
           registryData = supaData.data;
           setData(registryData);
        }

        // Handle Auth with Supabase
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        
        if (session?.user?.email && registryData) {
          setIsAuthorized(checkIsAdmin(session.user.email, registryData.admins || []));
        }

        const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
          setUser(session?.user ?? null);
          if (session?.user?.email && registryData) {
            setIsAuthorized(checkIsAdmin(session.user.email, registryData.admins || []));
          } else {
            setIsAuthorized(false);
          }
        });

        // Cleanup isn't strictly necessary here as it's a root component but good practice
        return () => {
          authListener.subscription.unsubscribe();
        };

      } catch (e) {
        console.error("Critical Sovereign initialization failure:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const siteConfig = data?.siteConfig || { 
    siteTitle: 'Big Boss Archive', 
    siteDescription: 'أرشيف الوثائق الرقمي', 
    mainHeaderImage: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&q=80&w=2282',
    version: 'v1.0.0' 
  };

  useEffect(() => {
    if (siteConfig?.siteTitle) {
      document.title = selectedArticle ? `${selectedArticle.title} | ${siteConfig.siteTitle}` : siteConfig.siteTitle;
    }
  }, [siteConfig?.siteTitle, selectedArticle]);

  const categories = data?.categories || [];

  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getYoutubeId = (url?: string) => {
    if (!url) return null;
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('youtube.com')) {
        return urlObj.searchParams.get('v');
      } else if (urlObj.hostname.includes('youtu.be')) {
        return urlObj.pathname.split('/')[1];
      }
    } catch (e) {
      return null;
    }
    return null;
  };

  const articles = useMemo(() => {
    const normalize = (text: string) => {
      if (!text) return "";
      return text
        .replace(/[أإآ]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/[ى]/g, "ي")
        .replace(/[ًٌٍَُِّ]/g, "") // Remove Tashkeel
        .toLowerCase()
        .trim();
    };

    const categoriesMap = new Map<string, string>((data?.categories || []).map((c: any) => [String(c.id), String(c.title)]));

    const baseList = [...(data?.articles || [])]
      .filter((art: any) => !art.isDeleted)
      .map(art => {
        const catIds = art.categoryIds || (art.categoryId ? [art.categoryId] : []);
        const catTitles = catIds.map((id: string) => categoriesMap.get(id)).filter(Boolean);
        const catTitle = catTitles.join(' • ') || "";
        
        return { 
          ...art, 
          categoryIds: catIds,
          categoryTitle: catTitle,
          normalizedTitle: normalize(art.title), 
          normalizedContent: normalize(art.content || ""),
          normalizedCategory: normalize(catTitle)
        };
      });
    
    let list = [...baseList];

    // Smart Search with Fuse.js
    if (searchQuery.trim()) {
      const q = normalize(searchQuery);
      const fuse = new Fuse(list, {
        keys: ['normalizedTitle', 'normalizedContent', 'normalizedCategory'],
        threshold: 0.4,
        distance: 100,
        includeScore: true
      });
      
      const searchResults = fuse.search(q);
      let results = [];
      
      if (searchResults.length > 0) {
        // Sort results: 
        // 1. Matches in selectedCategory first
        // 2. Then by search score
        const sortedResults = searchResults.sort((a, b) => {
          if (selectedCategory) {
            const aInCat = (a.item.categoryIds || []).includes(selectedCategory);
            const bInCat = (b.item.categoryIds || []).includes(selectedCategory);
            if (aInCat && !bInCat) return -1;
            if (!aInCat && bInCat) return 1;
          }
          return (a.score || 0) - (b.score || 0);
        });
        
        results = sortedResults.map(res => res.item);
      } else {
        // Fallback: literal check
        results = list.filter(art => 
          art.normalizedTitle.includes(q) || 
          art.normalizedContent.includes(q) || 
          art.normalizedCategory.includes(q)
        );
        
        if (selectedCategory) {
          results.sort((a, b) => {
            const aInCat = (a.categoryIds || []).includes(selectedCategory) ? 1 : 0;
            const bInCat = (b.categoryIds || []).includes(selectedCategory) ? 1 : 0;
            return bInCat - aInCat;
          });
        }
      }

      // NO EMPTY RESULTS POLICY: If matches are few, fill with other articles
      if (results.length < 5) {
        const resultIds = new Set(results.map(r => r.id));
        const others = baseList
          .filter(a => !resultIds.has(a.id))
          .sort(() => Math.random() - 0.5) // Shuffle for diversity
          .slice(0, 8 - results.length);
        
        results = [...results, ...others];
      }
      
      list = results;
    } else {
      // No search: Traditional category filter and sort
      if (selectedCategory) {
        list = list.filter(art => (art.categoryIds || []).includes(selectedCategory));
      }
      
      list.sort((a, b) => {
        if (sortBy === 'newest') return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
        if (sortBy === 'oldest') return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
        if (sortBy === 'title-asc') return a.normalizedTitle.localeCompare(b.normalizedTitle, 'ar');
        if (sortBy === 'title-desc') return b.normalizedTitle.localeCompare(a.normalizedTitle, 'ar');
        return 0;
      });
    }

    return list;
  }, [data, searchQuery, selectedCategory, sortBy]);

  const suggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    
    const normalize = (text: string) => {
      if (!text) return "";
      return text
        .replace(/[أإآ]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/[ى]/g, "ي")
        .replace(/[ًٌٍَُِّ]/g, "")
        .toLowerCase()
        .trim();
    };

    const q = normalize(searchQuery);
    const activeArticles = (data?.articles || []).filter((art: any) => !art.isDeleted);
    
    // Fuzzy suggestions on titles
    const fuse = new Fuse(activeArticles, {
      keys: ['title'],
      threshold: 0.5,
      distance: 50
    });

    const results = fuse.search(q);
    const titles = results.map(r => (r.item as any).title);
    
    return Array.from(new Set(titles)).slice(0, 5);
  }, [data, searchQuery]);

  const handleSelectArticle = (art: Article | null) => {
    setSelectedArticle(art);
    const url = new URL(window.location.href);
    if (art) {
      url.searchParams.set('view', art.id);
    } else {
      url.searchParams.delete('view');
    }
    window.history.pushState({}, '', url.toString());
  };

  useEffect(() => {
    const handlePopState = () => {
       const params = new URLSearchParams(window.location.search);
       const viewId = params.get('view');
       if (viewId && articles) {
         const art = articles.find((a: any) => a.id === viewId);
         if (art) setSelectedArticle(art);
       } else {
         setSelectedArticle(null);
       }
    };
    window.addEventListener('popstate', handlePopState);
    
    // Initial check
    if (articles.length > 0) {
      handlePopState();
    }
    
    return () => window.removeEventListener('popstate', handlePopState);
  }, [articles]);

  useEffect(() => {
    if (!supabase) return;

    // Real-time listener for settings table to ensure data is always fresh across sessions
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'settings'
        },
        (payload) => {
          console.log('[Sovereign] Remote change detected, syncing...', payload);
          const newData = (payload.new as any)?.data;
          if (newData) {
            setData(newData);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white font-serif">
      <div className="text-center">
        <Loader2 className="w-10 h-10 text-gray-200 animate-spin mx-auto mb-4" />
        <p className="text-gray-400 italic">جاري تهيئة الأرشيف السيادي...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen font-sans selection:bg-gray-100 selection:text-black">
      <DynamicTheme config={data?.siteConfig} />

      {/* Absolute Admin Portal */}
      <div className="fixed top-4 right-6 z-[9999]">
        <Link 
          to="/admin" 
          className="bg-white/80 backdrop-blur-md px-6 py-2 rounded-2xl shadow-xl shadow-black/5 text-black font-serif text-lg border border-gray-100 hover:border-black flex items-center gap-3 transition-all duration-500 group pointer-events-auto"
        >
          إدارة
          <Settings size={14} className="opacity-0 group-hover:opacity-100 group-hover:rotate-90 transition-all duration-500" />
        </Link>
      </div>

      {/* Hero Section */}
      <section className="w-full h-[320px] sm:h-[450px] relative overflow-hidden" style={{ backgroundColor: 'var(--site-bg, #ffffff)' }}>
        <img 
          src={siteConfig.mainHeaderImage || 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&q=80&w=2282'} 
          alt="Hero"
          className="w-full h-full object-cover opacity-90 transition-all duration-1000 lg:grayscale lg:hover:grayscale-0"
        />
        <div 
          className="absolute inset-0"
          style={{ 
            background: `linear-gradient(to bottom, transparent 0%, var(--site-bg, #ffffff) 100%)`
          }}
        />
      </section>

      {/* Branding & Search */}
      <section className="max-w-4xl mx-auto px-6 -mt-24 sm:-mt-40 relative z-10 text-center space-y-4 sm:space-y-8">
        <div className="space-y-2 sm:space-y-4">
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-4xl sm:text-6xl font-bold font-serif tracking-tighter text-gray-900 drop-shadow-sm"
          >
            {siteConfig.siteTitle}
          </motion.h1>
          <p className="text-gray-500 font-serif italic text-lg sm:text-xl drop-shadow-sm">{siteConfig.siteDescription}</p>
        </div>

        {/* Universal Links & Unified Search */}
        <div className="max-w-2xl mx-auto mt-2 sm:mt-4 space-y-4 sm:space-y-8">
            {siteConfig.externalLinks && siteConfig.externalLinks.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 sm:gap-3 px-4">
                {siteConfig.externalLinks.map((link: any) => (
                  <a 
                    key={link.id} 
                    href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-white text-gray-900 px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-bold font-serif hover:bg-gray-50 hover:scale-105 transition-all border border-gray-200 shadow-sm"
                  >
                    <span>{link.title}</span>
                    <img 
                      src={`https://www.google.com/s2/favicons?domain=${link.url.replace(/^https?:\/\//, '').split('/')[0]}&sz=64`} 
                      alt=""
                      className="w-4 h-4 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </a>
                ))}
              </div>
            )}

            {/* Sorting Controls Moved Here */}
            <div className="flex items-center justify-center gap-4 px-4">
              <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest font-sans whitespace-nowrap">
                {articles.length} وثيقة
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-white/50 backdrop-blur-sm border border-gray-100 text-gray-700 text-[10px] sm:text-xs rounded-full py-1.5 px-4 outline-none focus:ring-2 focus:ring-black/5 font-sans"
              >
                <option value="newest">الأحدث أولاً</option>
                <option value="oldest">الأقدم أولاً</option>
                <option value="title-asc">الاسم (أ-ي)</option>
                <option value="title-desc">الاسم (ي-أ)</option>
              </select>
            </div>

            <div className="space-y-3 sm:space-y-4 px-4 pb-2 sm:pb-4 relative" ref={categoryDropdownRef}>
              {/* Custom Category Dropdown Window */}
              <button 
                onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                className="w-full bg-white border border-gray-100 rounded-2xl py-4 px-6 text-lg shadow-xl shadow-black/5 outline-none flex items-center justify-between text-right font-serif transition-all hover:bg-gray-50 group"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg transition-colors ${selectedCategory ? 'bg-black text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'}`}>
                    <LayoutList size={20} />
                  </div>
                  <div className="flex flex-col items-start text-right">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">تصفية حسب القسم</span>
                    <span className="text-gray-900 font-bold">
                      {selectedCategory 
                        ? categories.find(c => c.id === selectedCategory)?.title 
                        : `كافة الاقسام (${data?.articles?.filter((a: any) => !a.isDeleted).length || 0})`}
                    </span>
                  </div>
                </div>
                <ChevronDown size={20} className={`text-gray-400 transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isCategoryDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    className="absolute top-full left-4 right-4 mt-2 bg-white/95 backdrop-blur-xl border border-gray-100 rounded-3xl shadow-2xl z-[60] overflow-hidden p-3 grid grid-cols-1 sm:grid-cols-2 gap-2"
                  >
                    <button
                      onClick={() => {
                        setSelectedCategory(null);
                        setIsCategoryDropdownOpen(false);
                      }}
                      className={`text-right px-4 py-3 rounded-xl transition-all font-serif flex items-center justify-between group ${!selectedCategory ? 'bg-black text-white shadow-lg' : 'hover:bg-gray-50 text-gray-500'}`}
                    >
                      <span>كافة الاقسام</span>
                      <span className="text-xs opacity-50">{data?.articles?.filter((a: any) => !a.isDeleted).length || 0}</span>
                    </button>
                    {(categories || []).map((cat: any) => {
                      const count = data?.articles?.filter((a: any) => !a.isDeleted && (a.categoryIds || [a.categoryId]).includes(cat.id)).length || 0;
                      return (
                        <button 
                          key={cat.id}
                          onClick={() => {
                            setSelectedCategory(cat.id);
                            setIsCategoryDropdownOpen(false);
                          }}
                          className={`text-right px-4 py-3 rounded-xl transition-all font-serif flex items-center justify-between group ${selectedCategory === cat.id ? 'bg-black text-white shadow-lg' : 'hover:bg-gray-50 text-gray-500'}`}
                        >
                          <span className="truncate">{cat.title}</span>
                          <span className="text-xs opacity-50">{count}</span>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Unified Search Bar */}
              <div className="relative group max-w-2xl mx-auto">
                <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors" size={20} />
                <input 
                  type="text"
                  placeholder="ابحث في الأرشيف الموثق..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setShowSuggestions(false);
                    }
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full bg-white border border-gray-100 rounded-2xl py-5 pr-16 pl-8 text-lg shadow-xl shadow-black/5 outline-none focus:ring-2 focus:ring-black/5 transition-all text-right font-serif"
                />
                
                {/* Search Suggestions Dropdown */}
                <AnimatePresence>
                  {showSuggestions && suggestions.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white/90 backdrop-blur-xl border border-gray-100 rounded-2xl shadow-2xl z-50 overflow-hidden"
                    >
                      {suggestions.map((suggestion: any, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setSearchQuery(suggestion);
                            setShowSuggestions(false);
                          }}
                          className="w-full text-right px-6 py-4 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 font-serif text-gray-700 flex items-center justify-between group"
                        >
                          <span className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"><Search size={14} /></span>
                          <span>{suggestion}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>
           </div>
        </div>
      </section>

      {/* Main Content Grid */}
      <main className="max-w-7xl mx-auto px-6 pt-4 pb-12 sm:py-20 text-right">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-16">
          
          {/* Main Column: Latest Articles */}
          <div className="lg:col-span-8 space-y-4 sm:space-y-12">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-3 sm:pb-6 gap-2 sm:gap-4">
              <h2 className="text-2xl sm:text-3xl font-bold font-serif w-full text-center sm:text-right">{searchQuery.trim() ? 'نتائج البحث' : 'آخر الوثائق المضافة'}</h2>
            </header>

            <div className="w-full">
                {articles.length > 0 ? (
                  <Virtuoso
                    useWindowScroll
                    data={articles}
                    itemContent={(idx, art) => (
                      <div className="pb-6 md:pb-12 border-b border-gray-50 last:border-0 mb-6 md:mb-12">
                        <motion.article 
                          key={art.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 }}
                          className="group flex flex-col md:flex-row gap-4 md:gap-8 items-start p-4 md:p-0 border border-gray-100 md:border-0 rounded-2xl md:rounded-none shadow-sm md:shadow-none bg-white/50 md:bg-transparent"
                        >
                          <div 
                            className="w-full md:w-64 h-44 bg-gray-50 rounded-xl overflow-hidden shrink-0 border border-gray-100 group-hover:border-black/10 transition-all"
                          >
                            {art.videoUrl && getYoutubeId(art.videoUrl) ? (
                              <iframe 
                                src={`https://www.youtube.com/embed/${getYoutubeId(art.videoUrl)}?rel=0&modestbranding=1`}
                                className="w-full h-full border-none"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            ) : art.headerImage ? (
                              <div className="w-full h-full cursor-zoom-in" onClick={() => art.headerImage && setZoomedImage(art.headerImage)}>
                                <img src={art.headerImage} style={{ objectPosition: art.imagePosition || 'center' }} className="w-full h-full object-cover transition-all duration-700 lg:grayscale lg:group-hover:grayscale-0 hover:scale-110" alt={art.title} />
                              </div>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-200">
                                 <BookOpen size={48} />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 space-y-2 md:space-y-4 w-full">
                            <div className="flex items-center gap-2 md:gap-4 flex-wrap flex-row-reverse">
                                {(art.categoryIds || [art.categoryId]).filter(Boolean).map((catId: string) => {
                                  const cat = categories.find(c => c.id === catId);
                                  if (!cat) return null;
                                  return (
                                    <span key={catId} className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest font-sans">
                                      {cat.title}
                                    </span>
                                  );
                                })}
                               <span className="text-[10px] text-gray-400 font-bold font-sans">
                                 {art.createdAt ? new Date(art.createdAt.seconds * 1000).toLocaleDateString('ar-EG') : 'قيد المراجعة'}
                               </span>
                               {art.videoUrl && (
                                 <div className="flex items-center gap-1 bg-red-50 text-red-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest font-sans">
                                   <Video size={10} />
                                   <span>فيديو</span>
                                 </div>
                               )}
                            </div>
                            <h3 className="text-xl md:text-2xl font-bold font-serif group-hover:text-black transition-colors leading-snug">
                              <button 
                                onClick={() => handleSelectArticle(art)}
                                className="text-right hover:underline focus:outline-none"
                              >
                                 {art.title}
                              </button>
                            </h3>
                            <p className="text-gray-500 font-serif leading-snug md:leading-relaxed line-clamp-3 italic text-sm md:text-base">
                              {art.content}
                            </p>
                            <div className="flex items-center gap-4 md:gap-6 pt-2 md:pt-0">
                              <button 
                                onClick={() => handleSelectArticle(art)}
                                className="inline-flex items-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-widest text-black border-b-2 border-black pb-1 hover:gap-4 transition-all focus:outline-none"
                              >
                                عرض المستند الآمن <Eye size={14} />
                              </button>
                              <button
                                onClick={async () => {
                                  const shareUrl = `${window.location.origin}/api/share?view=${art.id}`;
                                  try {
                                    await navigator.clipboard.writeText(shareUrl);
                                    alert('تم نسخ الرابط بنجاح! يمكنك مشاركته الآن.');
                                  } catch (err) {
                                    prompt('انسخ الرابط التالي:', shareUrl);
                                  }
                                }}
                                className="inline-flex items-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-widest text-gray-400 border-b-2 border-gray-200 pb-1 hover:text-black hover:border-black hover:gap-4 transition-all focus:outline-none"
                                title="مشاركة المقال"
                              >
                                مشاركة المقال <Share2 size={14} />
                              </button>
                            </div>
                          </div>
                        </motion.article>
                      </div>
                    )}
                  />
                ) : (
                  <div className="py-40 text-center text-gray-300 font-serif italic text-xl">
                    لا توجد وثائق تطابق بحثك حالياً...
                  </div>
                )}
            </div>
          </div>

          {/* Sidebar Column: Categories */}
          <aside className="hidden lg:block lg:col-span-4 space-y-12">
            <div className="sticky top-12 space-y-12">
              <section className="space-y-6">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 font-sans px-2">
                  تصنيفات المشروع
                </h3>
                <nav className="flex flex-col gap-2">
                  <button 
                    onClick={() => setSelectedCategory(null)}
                    className={`text-right px-4 py-3 rounded-xl transition-all font-serif text-lg flex items-center justify-between ${!selectedCategory ? 'bg-black text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50 hover:text-black'}`}
                  >
                    <span>كافة الاقسام</span>
                    <span className="text-xs opacity-50">{data?.articles?.filter((a: any) => !a.isDeleted).length || 0}</span>
                  </button>
                  {categories.map((cat: any) => {
                    const count = data?.articles?.filter((a: any) => !a.isDeleted && (a.categoryIds || [a.categoryId]).includes(cat.id)).length || 0;
                    return (
                      <button 
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`text-right px-4 py-3 rounded-xl transition-all font-serif text-lg flex items-center justify-between ${selectedCategory === cat.id ? 'bg-black text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50 hover:text-black'}`}
                      >
                        <span>{cat.title}</span>
                        <span className="text-xs opacity-50">{count}</span>
                      </button>
                    );
                  })}
                </nav>
              </section>

              {/* External Links Section */}
              {siteConfig.externalLinks && siteConfig.externalLinks.length > 0 && (
                <section className="space-y-6">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 font-sans px-2">
                    روابط خارجية مفيدة
                  </h3>
                  <div className="flex flex-col gap-2">
                    {siteConfig.externalLinks.map((link: any) => (
                      <a 
                        key={link.id} 
                        href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-right px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all font-serif text-lg text-gray-600 hover:text-black border border-gray-100 flex items-center justify-between"
                      >
                        <span>{link.title}</span>
                        <img 
                          src={`https://www.google.com/s2/favicons?domain=${link.url.replace(/^https?:\/\//, '').split('/')[0]}&sz=64`} 
                          alt=""
                          className="w-4 h-4 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {/* Status Indicator */}
              <section className="p-8 bg-gray-50 rounded-3xl border border-gray-100 space-y-4">
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                   <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 font-sans">النظام متصل وآمن</span>
                </div>
                <p className="text-xs text-gray-400 font-serif leading-relaxed italic">
                  يتم تحديث الأرشيف الرقمي السيادي بصورة دورية لضمان دقة البيانات المحفوظة.
                </p>
              </section>
            </div>
          </aside>

        </div>
      </main>

      {/* PDF Reading Overlay */}
      <AnimatePresence>
        {selectedArticle && (
          <PDFViewer 
            url={selectedArticle.pdfUrl} 
            videoUrl={selectedArticle.videoUrl}
            title={selectedArticle.title}
            articleId={selectedArticle.id}
            onClose={() => handleSelectArticle(null)} 
          />
        )}
      </AnimatePresence>

      {/* Image Zoom Overlay */}
      <AnimatePresence>
        {zoomedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoomedImage(null)}
            className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 sm:p-10 cursor-zoom-out"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-7xl max-h-[90vh] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setZoomedImage(null)}
                className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors bg-white/10 p-2 rounded-full"
              >
                <X size={24} />
              </button>
              <img 
                src={zoomedImage} 
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/10"
                alt="Zoomed"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="py-20 border-t border-gray-50">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8 opacity-40 hover:opacity-100 transition-opacity grayscale hover:grayscale-0">
              <div className="text-2xl font-bold font-serif tracking-tighter">{siteConfig.siteTitle}</div>
              <div className="flex flex-col items-center md:items-end gap-2">
                  <div className="text-[10px] font-bold uppercase tracking-[0.4em] font-sans">
                      Sovereign Digital Archive • {siteConfig.version}
                  </div>
              </div>
              <div className="text-xs font-serif italic text-gray-500">
                  جميع الحقوق محفوظة © 2026
              </div>
          </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainSite />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </Router>
  );
}
