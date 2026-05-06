'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

// --- KARTA PREMIUM (Zoptymalizowana pod ciemne tło) ---
const FeaturedAdCard = ({ item }: { item: any }) => (
  <Link href={`/ogloszenie/${item.id}`} className="block w-56 md:w-64 shrink-0 snap-start group cursor-pointer bg-white/5 backdrop-blur-xl rounded-[2rem] p-3 shadow-2xl hover:bg-white/10 hover:-translate-y-2 transition-all duration-500 border border-white/10 hover:border-amber-400/50 relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/0 via-amber-500/0 to-amber-500/0 group-hover:to-amber-500/10 transition-colors duration-500"></div>
    
    <div className="w-full aspect-[4/3] bg-gray-900 rounded-2xl overflow-hidden mb-4 relative border border-white/5">
      {item.image_url ? (
        <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out opacity-90 group-hover:opacity-100" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-gray-700">
           <span className="text-3xl">📸</span>
        </div>
      )}
      <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-1.5 rounded-lg uppercase shadow-lg flex items-center gap-1.5 z-10 border border-amber-500/30">
        <span className="text-amber-400 text-sm leading-none animate-pulse">★</span> Premium
      </div>
    </div>
    <div className="px-2 pb-1 relative z-10">
      <p className="text-[10px] font-black text-amber-400 uppercase truncate mb-1 tracking-widest">{item.category}</p>
      <h4 className="text-base font-bold text-white leading-snug mb-3 line-clamp-2 group-hover:text-amber-100 transition-colors">{item.title}</h4>
      <div className="flex justify-between items-end mt-auto">
        <p className="text-xl font-black text-white">{item.price} <span className="text-xs font-bold text-gray-400">PLN</span></p>
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-amber-400 group-hover:text-black transition-all duration-300 text-white">
          <span className="text-sm font-bold transform -rotate-45">➔</span>
        </div>
      </div>
    </div>
  </Link>
);

const categoryStyles: Record<string, { icon: string, bg: string, color: string, border: string }> = {
  'Węże': { icon: '🐍', bg: 'bg-emerald-50', color: 'text-emerald-600', border: 'hover:border-emerald-200' },
  'Jaszczurki': { icon: '🦎', bg: 'bg-lime-50', color: 'text-lime-600', border: 'hover:border-lime-200' },
  'Pająki': { icon: '🕷️', bg: 'bg-stone-50', color: 'text-stone-600', border: 'hover:border-stone-200' },
  'Żaby i Płazy': { icon: '🐸', bg: 'bg-teal-50', color: 'text-teal-600', border: 'hover:border-teal-200' },
  'Owady': { icon: '🦗', bg: 'bg-amber-50', color: 'text-amber-600', border: 'hover:border-amber-200' },
  'Akcesoria': { icon: '📦', bg: 'bg-blue-50', color: 'text-blue-600', border: 'hover:border-blue-200' },
  'Terraria': { icon: '🏜️', bg: 'bg-orange-50', color: 'text-orange-600', border: 'hover:border-orange-200' },
  'Pokarm': { icon: '🍎', bg: 'bg-red-50', color: 'text-red-600', border: 'hover:border-red-200' },
};

// 🔥 FUNKCJA WAŻONEGO LOSOWANIA 🔥
const getWeightedRandomSample = (items: any[], sampleSize: number) => {
  const actualSampleSize = Math.min(items.length, sampleSize);
  if (actualSampleSize === 0) return [];

  let pool = items.map(item => ({
    ...item,
    weight: Math.max(1, item.ranking_score || 0) 
  }));

  const selected = [];
  
  for (let i = 0; i < actualSampleSize; i++) {
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (let j = 0; j < pool.length; j++) {
      random -= pool[j].weight;
      if (random <= 0) {
        selected.push(pool[j]);
        pool.splice(j, 1); 
        break;
      }
    }
  }
  return selected;
};

const ITEMS_PER_PAGE = 20;

export default function Home() {
  const [loading, setLoading] = useState(true);
  
  const [featuredListings, setFeaturedListings] = useState<any[]>([]);
  const [mainCategories, setMainCategories] = useState<any[]>([]);
  const [randomStrips, setRandomStrips] = useState<{category: string, listings: any[]}[]>([]);

  // 🔥 STANY NIESKOŃCZONEGO PRZEWIJANIA (INFINITE SCROLL)
  const [allCatalogListings, setAllCatalogListings] = useState<any[]>([]); // Pełna, zmieszana pula
  const [displayedCatalog, setDisplayedCatalog] = useState<any[]>([]);     // Ogłoszenia aktualnie widoczne
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchHomeData = async () => {
      // 1. Kategorie
      const { data: cats } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .is('parent_id', null) 
        .order('name');
      
      if (cats) setMainCategories(cats);

      // 2. Pobieramy SZEROKĄ pulę aktywnych ogłoszeń (300 sztuk do mieszania)
      const { data: ads } = await supabase
        .from('listings')
        .select('*, seller:profiles!fk_seller_profile(username, store_address, is_verified_seller), species(latin_name)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(300);

      if (ads && ads.length > 0) {
        
        // --- A: OFERTY PREMIUM ---
        const verifiedAds = ads.filter(ad => ad.seller?.is_verified_seller);
        const topPremium = verifiedAds.sort((a, b) => (b.ranking_score || 0) - (a.ranking_score || 0)).slice(0, 10);
        setFeaturedListings(topPremium.length > 0 ? topPremium : ads.sort((a, b) => (b.ranking_score || 0) - (a.ranking_score || 0)).slice(0, 8));

        // --- B: DOLNA SIATKA (Przygotowanie Pełnej, Zmieszanej Puli pod Scrolla) ---
        // Mieszamy absolutnie WSZYSTKIE pobrane ogłoszenia i zapisujemy do ukrytego bufora
        const shuffledCatalog = getWeightedRandomSample(ads, ads.length);
        setAllCatalogListings(shuffledCatalog);
        
        // Wrzucamy do widoku tylko pierwsze 20 sztuk
        setDisplayedCatalog(shuffledCatalog.slice(0, ITEMS_PER_PAGE));
        setHasMore(shuffledCatalog.length > ITEMS_PER_PAGE);

        // --- C: ALGORYTM: LOSOWE PASKI KATEGORII ---
        const groupedByCategory: Record<string, any[]> = {};
        ads.forEach(ad => {
          if (!groupedByCategory[ad.category]) groupedByCategory[ad.category] = [];
          groupedByCategory[ad.category].push(ad);
        });

        let validCategories = Object.keys(groupedByCategory).filter(cat => groupedByCategory[cat].length >= 3);
        if (validCategories.length < 2) validCategories = Object.keys(groupedByCategory);
        
        const shuffledCats = validCategories.sort(() => 0.5 - Math.random()).slice(0, 2);
        const generatedStrips = shuffledCats.map(cat => ({
          category: cat,
          listings: getWeightedRandomSample(groupedByCategory[cat], 8)
        }));

        setRandomStrips(generatedStrips);
      }
      
      setLoading(false);
    };

    fetchHomeData();
  }, []);

  // 🔥 OBSERWATOR NIESKOŃCZONEGO PRZEWIJANIA 🔥
  // Laser, który sprawdza czy zjechaliśmy na sam dół strony
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) {
        setPage((prevPage) => prevPage + 1); // Zwiększamy numer strony
      }
    }, { threshold: 0.1 });

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    return () => observer.disconnect();
  }, [hasMore]);

  // Kiedy numer strony się zwiększy, dociągamy kolejne z bufora (Błyskawicznie!)
  useEffect(() => {
    if (page > 1) {
      const startIndex = (page - 1) * ITEMS_PER_PAGE;
      const endIndex = startIndex + ITEMS_PER_PAGE;
      const nextItems = allCatalogListings.slice(startIndex, endIndex);
      
      if (nextItems.length > 0) {
        setDisplayedCatalog(prev => [...prev, ...nextItems]);
      }
      
      if (endIndex >= allCatalogListings.length) {
        setHasMore(false); // Koniec ogłoszeń w naszej wylosowanej paczce 300 sztuk
      }
    }
  }, [page, allCatalogListings]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <div className="w-12 h-12 border-4 border-gray-100 border-t-green-500 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Przygotowujemy giełdę...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] pb-24 overflow-x-hidden font-sans">
      
      {/* --- HERO SECTION --- */}
      <section className="bg-white pt-24 pb-36 px-4 md:px-6 text-center relative rounded-b-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.02)] z-30">
        <div className="absolute inset-0 overflow-hidden rounded-b-[3rem] pointer-events-none -z-10">
          <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-green-200/40 rounded-full blur-[100px] mix-blend-multiply opacity-70 animate-pulse"></div>
          <div className="absolute top-[20%] right-[10%] w-[600px] h-[600px] bg-emerald-100/40 rounded-full blur-[120px] mix-blend-multiply opacity-70"></div>
          <div className="absolute bottom-[-20%] left-[40%] w-[700px] h-[400px] bg-teal-50/50 rounded-full blur-[100px] mix-blend-multiply opacity-50"></div>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMCwwLDAsMC4wMykiLz48L3N2Zz4=')] [mask-image:linear-gradient(to_bottom,white,transparent)]"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
          <div className="mb-8 inline-flex items-center gap-2 bg-white/80 backdrop-blur-md border border-gray-100 px-4 py-2 rounded-full shadow-sm hover:shadow-md transition-shadow">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-xs font-black text-gray-800 uppercase tracking-widest">Aktywna społeczność</span>
          </div>

          <h1 className="text-5xl md:text-[6rem] font-black mb-6 tracking-tighter leading-[1.05] text-gray-900 drop-shadow-sm">
            Egzotyka <br className="md:hidden" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 via-emerald-600 to-teal-700">
              na wyciągnięcie ręki.
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-500 font-medium mb-12 max-w-2xl leading-relaxed">
            Odkrywaj fascynujący świat terrarystyki. Kupuj i sprzedawaj bezpiecznie w największej i najnowocześniejszej społeczności w Polsce.
          </p>
        </div>
      </section>

      {/* --- STREFA VIP (CIEMNY PANEL) --- */}
      {featuredListings.length > 0 && (
        <section className="max-w-[1400px] mx-auto px-4 md:px-8 -mt-20 relative z-40 mb-20">
          <div className="bg-gray-950 rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-10 shadow-[0_30px_60px_rgba(0,0,0,0.4)] border border-gray-800 relative overflow-hidden group">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[300px] bg-gradient-to-r from-amber-600/20 to-orange-500/20 blur-[100px] rounded-full pointer-events-none group-hover:opacity-100 opacity-70 transition-opacity duration-700"></div>
            
            <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3 tracking-tight">
                  <span className="text-amber-400 text-3xl animate-pulse drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]">★</span> Oferty Premium
                </h2>
                <p className="text-gray-400 font-medium mt-2 max-w-md leading-relaxed">
                  Wyselekcjonowane ogłoszenia od zweryfikowanych hodowców. Złap najlepsze okazje.
                </p>
              </div>
              <Link href="/szukaj" className="text-amber-400 hover:text-amber-300 bg-white/5 hover:bg-white/10 px-6 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 backdrop-blur-md border border-white/10 hover:border-amber-400/30 shadow-lg">
                Zobacz wszystkie <span className="text-lg transform group-hover:translate-x-1 transition-transform">➔</span>
              </Link>
            </div>

            <div className="relative z-10 flex gap-5 overflow-x-auto pb-6 pt-2 custom-scrollbar snap-x snap-mandatory hide-scrollbar -mx-6 px-6 md:-mx-10 md:px-10">
              {featuredListings.map(ad => <FeaturedAdCard key={ad.id} item={ad} />)}
            </div>
          </div>
        </section>
      )}

      {/* --- KATEGORIE (GRID) --- */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 mb-24">
        <div className="flex justify-between items-end mb-8">
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">
            Przeglądaj działy
          </h2>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {mainCategories.map(cat => {
            const style = categoryStyles[cat.name] || { icon: '🦎', bg: 'bg-gray-50', color: 'text-gray-600', border: 'hover:border-gray-200' };
            
            return (
              <Link 
                key={cat.id} 
                href={`/kategoria/${encodeURIComponent(cat.name.toLowerCase())}`}
                className={`bg-white rounded-[2rem] p-6 flex flex-col items-center justify-center text-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-gray-100 ${style.border} transition-all duration-500 group hover:-translate-y-1 relative overflow-hidden`}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                <div className={`relative z-10 w-20 h-20 ${style.bg} rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 ease-out shadow-sm`}>
                  <span className="text-4xl drop-shadow-sm">
                    {style.icon}
                  </span>
                </div>
                <span className={`relative z-10 font-black text-gray-800 text-base md:text-lg ${style.color} transition-colors tracking-tight`}>
                  {cat.name}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* --- DYNAMICZNE, LOSOWE PASKI KATEGORII --- */}
      {randomStrips.map((strip, idx) => (
        <section key={idx} className="max-w-[1400px] mx-auto px-4 md:px-8 mb-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <span className="text-3xl">{categoryStyles[strip.category]?.icon || '✨'}</span>
                Odkryj sekcję: <span className="text-green-600">{strip.category}</span>
              </h2>
              <p className="text-gray-500 font-medium mt-1">Wybrane oferty z dużą uwagą na wysoko oceniane hodowle.</p>
            </div>
            <Link href={`/kategoria/${encodeURIComponent(strip.category.toLowerCase())}`} className="text-sm font-bold text-gray-600 bg-white border border-gray-200 px-5 py-2.5 rounded-xl hover:text-black hover:border-black transition-all flex items-center gap-2 w-max">
              Więcej z tego działu <span>➔</span>
            </Link>
          </div>

          <div className="flex gap-5 overflow-x-auto pb-6 pt-2 custom-scrollbar snap-x snap-mandatory hide-scrollbar -mx-4 px-4 md:-mx-4 md:px-4">
            {strip.listings.map(ad => (
              <Link 
                key={ad.id} 
                href={`/ogloszenie/${ad.id}`} 
                className="w-60 md:w-[280px] shrink-0 snap-start group bg-white rounded-3xl border border-gray-100 overflow-hidden hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] hover:border-gray-200 hover:-translate-y-2 transition-all duration-500 flex flex-col relative"
              >
                <div className="w-full aspect-[4/3] bg-gray-50 relative overflow-hidden shrink-0 border-b border-gray-100">
                  {ad.image_url ? (
                    <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 bg-gray-100/50">
                      <span className="text-4xl mb-1">📸</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 hidden md:block"></div>
                  
                  {ad.seller?.is_verified_seller && (
                    <div className="absolute top-3 left-3 bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-black px-2 py-1 rounded-md uppercase shadow-sm flex items-center gap-1 z-10">
                      <svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      Zweryfikowany
                    </div>
                  )}
                </div>

                <div className="p-5 flex flex-col flex-1 min-w-0 bg-white relative z-10">
                  <div className="mb-2 flex flex-wrap gap-2 items-center">
                    {ad.condition && (
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md truncate ${ad.condition === 'new' ? 'bg-gray-100 text-gray-600' : 'bg-orange-50 text-orange-600'}`}>
                        {ad.condition === 'new' ? 'Nowy' : ad.condition === 'used' ? 'Używany' : 'Uszk.'}
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-base font-bold text-gray-900 leading-snug mb-1 group-hover:text-green-600 transition-colors line-clamp-2 break-words">
                    {ad.title}
                  </h3>
                  
                  <div className="mt-auto pt-3 flex items-center gap-1.5 text-gray-400 text-xs">
                    <span className="shrink-0">📍</span> 
                    <span className="truncate font-medium">{ad.seller?.store_address || 'Polska'}</span>
                  </div>

                  <div className="pt-3 mt-3 border-t border-gray-100 flex justify-between items-end">
                    <p className="text-xl font-black text-gray-900 leading-none truncate tracking-tight">
                      {ad.price} <span className="text-xs text-gray-400 font-bold">PLN</span>
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {/* --- OSTATNIO DODANE (Z INFINITE SCROLL) --- */}
      <section className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="flex justify-between items-end mb-10">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-2 tracking-tight">
              Katalog okazów
            </h2>
            <p className="text-gray-500 font-medium hidden md:block text-lg">Mieszanka najciekawszych ogłoszeń z całej giełdy.</p>
          </div>
          <Link href="/szukaj" className="text-sm font-black text-gray-900 bg-white border-2 border-gray-100 px-6 py-3 rounded-2xl hover:border-black hover:shadow-lg transition-all duration-300 flex items-center gap-2 group">
            Wszystkie <span className="hidden md:inline">oferty</span> 
            <span className="transform group-hover:translate-x-1 transition-transform">➔</span>
          </Link>
        </div>

        {displayedCatalog.length === 0 ? (
          <div className="bg-white p-16 rounded-[3rem] border border-gray-100 text-center shadow-sm">
            <span className="text-6xl mb-4 block opacity-20">📭</span>
            <p className="text-gray-500 font-medium text-lg">Brak aktywnych ogłoszeń w tym momencie.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
              {displayedCatalog.map(ad => (
                <Link 
                  key={ad.id} 
                  href={`/ogloszenie/${ad.id}`} 
                  className="group bg-white rounded-3xl border border-gray-100 overflow-hidden hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] hover:border-gray-200 hover:-translate-y-2 transition-all duration-500 flex flex-row md:flex-col relative"
                >
                  {/* ZDJĘCIE */}
                  <div className="w-36 sm:w-48 md:w-full aspect-square bg-gray-50 relative overflow-hidden shrink-0 border-r md:border-r-0 md:border-b border-gray-100">
                    {ad.image_url ? (
                      <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 bg-gray-100/50">
                        <span className="text-4xl mb-1">📸</span>
                      </div>
                    )}
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 hidden md:block"></div>
                    
                    {ad.cites_certificate && (
                      <div className="absolute top-3 left-3 bg-blue-600/95 backdrop-blur-md text-white text-[9px] font-black px-2.5 py-1.5 rounded-lg uppercase shadow-lg flex items-center gap-1 z-10 border border-white/20">
                        <span>📜</span> CITES
                      </div>
                    )}
                  </div>

                  {/* TREŚĆ KARTY */}
                  <div className="p-4 md:p-6 flex flex-col flex-1 min-w-0 bg-white relative z-10">
                    
                    <div className="mb-3 flex flex-wrap gap-2 items-center">
                      <span className="text-[10px] font-black uppercase text-green-600 tracking-widest truncate max-w-[120px] bg-green-50 px-2 py-1 rounded-md">
                        {ad.category}
                      </span>
                      {ad.condition && (
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md truncate ${ad.condition === 'new' ? 'bg-gray-100 text-gray-600' : 'bg-orange-50 text-orange-600'}`}>
                          {ad.condition === 'new' ? 'Nowy' : ad.condition === 'used' ? 'Używany' : 'Uszk.'}
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-base md:text-lg font-bold text-gray-900 leading-snug mb-1 group-hover:text-green-600 transition-colors line-clamp-2 break-words">
                      {ad.title}
                    </h3>
                    
                    {ad.species?.latin_name && (
                      <p className="text-[11px] text-gray-400 italic mb-3 truncate font-medium">
                        {ad.species.latin_name}
                      </p>
                    )}
                    
                    <div className="mt-auto pt-3 flex items-center gap-1.5 text-gray-400 text-xs">
                      <span className="shrink-0">📍</span> 
                      <span className="truncate font-medium">{ad.seller?.store_address || 'Polska'}</span>
                    </div>

                    <div className="pt-3 mt-3 border-t border-gray-100 flex justify-between items-end">
                      <p className="text-xl md:text-2xl font-black text-gray-900 leading-none truncate tracking-tight">
                        {ad.price} <span className="text-xs md:text-sm text-gray-400 font-bold">PLN</span>
                      </p>
                      <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center group-hover:bg-black group-hover:border-black group-hover:text-white transition-all duration-300 hidden md:flex shadow-sm">
                        <span className="font-bold text-sm transform -rotate-45">➔</span>
                      </div>
                    </div>

                  </div>
                </Link>
              ))}
            </div>

            {/* LASER OBSERWATORA */}
            <div ref={observerTarget} className="w-full py-16 flex justify-center items-center">
              {hasMore ? (
                <div className="w-8 h-8 border-4 border-gray-200 border-t-green-600 rounded-full animate-spin"></div>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-400 bg-gray-100 px-6 py-3 rounded-full border border-gray-200">
                    Przejrzałeś wszystkie wylosowane oferty! <Link href="/szukaj" className="text-green-600 ml-1 hover:underline">Szukaj dalej ➔</Link>
                  </p>
                </div>
              )}
            </div>

          </div>
        )}
      </section>

      <style dangerouslySetInnerHTML={{ __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

    </main>
  );
}