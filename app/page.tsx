'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';
import SearchBar from '../components/SearchBar'; // <-- Upewnij się, że ścieżka do komponentu jest poprawna!

// --- KARTA PREMIUM (Zoptymalizowana pod ciemne tło) ---
const FeaturedAdCard = ({ item }: { item: any }) => (
  <Link href={`/ogloszenie/${item.id}`} className="block w-56 md:w-64 shrink-0 snap-start group cursor-pointer bg-white rounded-[2rem] p-3 shadow-lg hover:shadow-2xl hover:shadow-amber-500/20 hover:-translate-y-2 transition-all duration-400 border border-transparent hover:border-amber-200">
    <div className="w-full aspect-[4/3] bg-gray-50 rounded-2xl overflow-hidden mb-4 relative">
      {item.image_url ? (
        <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
           <span className="text-3xl">📸</span>
        </div>
      )}
      {/* Ekskluzywny Tag Promowania */}
      <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-1.5 rounded-lg uppercase shadow-lg flex items-center gap-1.5 z-10 border border-white/10">
        <span className="text-amber-400 text-sm leading-none">★</span> Premium
      </div>
    </div>
    <div className="px-2 pb-1">
      <p className="text-[10px] font-black text-green-600 uppercase truncate mb-1 tracking-widest">{item.category}</p>
      <h4 className="text-base font-bold text-gray-900 leading-snug mb-3 line-clamp-2">{item.title}</h4>
      <div className="flex justify-between items-end mt-auto">
        <p className="text-xl font-black text-gray-900">{item.price} <span className="text-xs font-bold text-gray-400">PLN</span></p>
        <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-amber-400 group-hover:text-black transition-colors text-gray-400">
          <span className="text-sm font-bold transform -rotate-45">➔</span>
        </div>
      </div>
    </div>
  </Link>
);

// Eleganckie kategorie z tłami
const categoryStyles: Record<string, { icon: string, bg: string, color: string }> = {
  'Węże': { icon: '🐍', bg: 'bg-emerald-50', color: 'text-emerald-600' },
  'Jaszczurki': { icon: '🦎', bg: 'bg-lime-50', color: 'text-lime-600' },
  'Pająki': { icon: '🕷️', bg: 'bg-stone-50', color: 'text-stone-600' },
  'Żaby i Płazy': { icon: '🐸', bg: 'bg-teal-50', color: 'text-teal-600' },
  'Owady': { icon: '🦗', bg: 'bg-amber-50', color: 'text-amber-600' },
  'Akcesoria': { icon: '📦', bg: 'bg-blue-50', color: 'text-blue-600' },
  'Terraria': { icon: '🏜️', bg: 'bg-orange-50', color: 'text-orange-600' },
  'Pokarm': { icon: '🍎', bg: 'bg-red-50', color: 'text-red-600' },
};

export default function Home() {
  const [loading, setLoading] = useState(true);
  
  const [recentListings, setRecentListings] = useState<any[]>([]);
  const [featuredListings, setFeaturedListings] = useState<any[]>([]);
  const [mainCategories, setMainCategories] = useState<any[]>([]);

  useEffect(() => {
    const fetchHomeData = async () => {
      const { data: cats } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .is('parent_id', null) 
        .order('name');
      
      if (cats) setMainCategories(cats);

      const { data: ads } = await supabase
        .from('listings')
        .select('*, seller:profiles!fk_seller_profile(username, store_address, is_verified_seller), species(latin_name)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(20);

      if (ads) {
        setRecentListings(ads);
        const verifiedAds = ads.filter(ad => ad.seller?.is_verified_seller);
        setFeaturedListings(verifiedAds.length > 0 ? verifiedAds : ads.slice(0, 6)); 
      }
      
      setLoading(false);
    };

    fetchHomeData();
  }, []);

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
      {/* USUNĄŁEM overflow-hidden z głównego tagu section! */}
      <section className="bg-white pt-20 pb-32 px-4 md:px-6 text-center relative rounded-b-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.02)] z-30">
        
        {/* Zamiast tego, włożyłem ten świecący background do osobnego, przyciętego kontenera (klatka na tło) */}
        <div className="absolute inset-0 overflow-hidden rounded-b-[3rem] pointer-events-none -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-green-50 rounded-full blur-3xl opacity-50"></div>
        </div>
        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
          
          <div className="mb-6 inline-flex items-center gap-2 bg-green-50 border border-green-100 px-4 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-xs font-black text-green-800 uppercase tracking-widest">Ponad {recentListings.length * 10}+ ogłoszeń</span>
          </div>

          <h1 className="text-5xl md:text-[5.5rem] font-black mb-6 tracking-tighter leading-[1.1] text-gray-900">
            Egzotyka <br className="md:hidden" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-emerald-700">
              na wyciągnięcie ręki.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-500 font-medium mb-12 max-w-2xl leading-relaxed">
            Odkrywaj fascynujący świat terrarystyki. Kupuj i sprzedawaj bezpiecznie w największej społeczności w Polsce.
          </p>
          
      
        </div>
      </section>

      {/* --- STREFA VIP (POTĘŻNY CIEMNY PANEL) --- */}
      {featuredListings.length > 0 && (
        <section className="max-w-[1400px] mx-auto px-4 md:px-8 -mt-16 relative z-20 mb-20">
          <div className="bg-gray-900 rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-gray-800 relative overflow-hidden">
            
            {/* Abstrakcyjny Glow w tle panelu */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[300px] bg-amber-500/15 blur-[100px] rounded-full pointer-events-none"></div>
            
            <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
                  <span className="text-amber-400 text-3xl animate-pulse">★</span> Oferty Premium
                </h2>
                <p className="text-gray-400 font-medium mt-2 max-w-md leading-relaxed">
                  Wyselekcjonowane ogłoszenia od sprawdzonych hodowców. Złap najlepsze okazje.
                </p>
              </div>
              <Link href="/szukaj" className="text-amber-400 hover:text-amber-300 bg-white/5 hover:bg-white/10 px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 backdrop-blur-md border border-white/10">
                Zobacz wszystkie <span className="text-lg">➔</span>
              </Link>
            </div>

            {/* Slider z ujemnymi marginesami dla gładkiego przewijania */}
            <div className="relative z-10 flex gap-5 overflow-x-auto pb-6 pt-2 custom-scrollbar snap-x snap-mandatory hide-scrollbar -mx-6 px-6 md:-mx-10 md:px-10">
              {featuredListings.map(ad => <FeaturedAdCard key={ad.id} item={ad} />)}
            </div>
            
          </div>
        </section>
      )}

      {/* --- KATEGORIE (CZYSTY GRID) --- */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 mb-24">
        <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-8">
          Przeglądaj kategorie
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {mainCategories.map(cat => {
            const style = categoryStyles[cat.name] || { icon: '🦎', bg: 'bg-gray-50', color: 'text-gray-600' };
            
            return (
              <Link 
                key={cat.id} 
                href={`/szukaj?category=${encodeURIComponent(cat.name)}`}
                className="bg-white rounded-[2rem] p-6 flex flex-col items-center justify-center text-center shadow-sm hover:shadow-xl border border-gray-100 hover:border-transparent transition-all duration-300 group"
              >
                <div className={`w-20 h-20 ${style.bg} rounded-full flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500 ease-out`}>
                  <span className="text-4xl">
                    {style.icon}
                  </span>
                </div>
                <span className="font-bold text-gray-900 text-base group-hover:text-green-600 transition-colors">
                  {cat.name}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* --- NAJNOWSZE OGŁOSZENIA (GRID) --- */}
      <section className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="flex justify-between items-end mb-10">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-2">
              Świeżo dodane
            </h2>
            <p className="text-gray-500 font-medium hidden md:block text-lg">Odkryj najnowsze okazy na giełdzie.</p>
          </div>
          <Link href="/szukaj" className="text-sm font-black text-gray-900 bg-white border border-gray-200 px-6 py-3 rounded-full hover:border-black hover:shadow-md transition-all flex items-center gap-2">
            Wszystkie <span className="hidden md:inline">ogłoszenia</span> ➔
          </Link>
        </div>

        {recentListings.length === 0 ? (
          <div className="bg-white p-12 rounded-[2.5rem] border border-gray-100 text-center shadow-sm">
            <p className="text-gray-500 font-medium">Brak aktywnych ogłoszeń.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
            {recentListings.map(ad => (
              <Link 
                key={ad.id} 
                href={`/ogloszenie/${ad.id}`} 
                className="group bg-white rounded-3xl border border-gray-100 overflow-hidden hover:shadow-2xl hover:border-gray-200 hover:-translate-y-2 transition-all duration-500 flex flex-row md:flex-col relative shadow-sm"
              >
                {/* ZDJĘCIE */}
                <div className="w-36 sm:w-48 md:w-full aspect-square bg-gray-50 relative overflow-hidden shrink-0">
                  {ad.image_url ? (
                    <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                      <span className="text-4xl mb-1">📸</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 hidden md:block"></div>
                  
                  {ad.cites_certificate && (
                    <div className="absolute top-3 left-3 bg-blue-600/90 backdrop-blur-sm text-white text-[9px] font-black px-2.5 py-1 rounded-md uppercase shadow-lg flex items-center gap-1 z-10">
                      <span>📜</span> CITES
                    </div>
                  )}
                </div>

                {/* TREŚĆ KARTY */}
                <div className="p-4 md:p-6 flex flex-col flex-1 min-w-0">
                  
                  {/* TAGI: Kategoria i Stan */}
                  <div className="mb-3 flex flex-wrap gap-2 items-center">
                    <span className="text-[10px] font-black uppercase text-green-600 tracking-widest truncate max-w-[120px]">
                      {ad.category}
                    </span>
                    {ad.condition && (
                      <span className="text-gray-300 mx-1">•</span>
                    )}
                    {ad.condition && (
                      <span className={`text-[10px] font-bold uppercase truncate ${ad.condition === 'new' ? 'text-gray-500' : 'text-orange-500'}`}>
                        {ad.condition === 'new' ? 'Nowy' : ad.condition === 'used' ? 'Używany' : 'Uszk.'}
                      </span>
                    )}
                  </div>
                  
                  {/* TYTUŁ */}
                  <h3 className="text-base md:text-lg font-bold text-gray-900 leading-snug mb-1 group-hover:text-green-600 transition-colors line-clamp-2 break-words">
                    {ad.title}
                  </h3>
                  
                  {/* NAZWA ŁACIŃSKA */}
                  {ad.species?.latin_name && (
                    <p className="text-xs text-gray-400 italic mb-3 truncate">
                      {ad.species.latin_name}
                    </p>
                  )}
                  
                  {/* LOKALIZACJA */}
                  <div className="mt-auto pt-2 flex items-center gap-1.5 text-gray-400 text-xs">
                    <span className="shrink-0">📍</span> 
                    <span className="truncate font-medium">{ad.seller?.store_address || 'Polska'}</span>
                  </div>

                  {/* CENA */}
                  <div className="pt-3 mt-3 border-t border-gray-50 flex justify-between items-end">
                    <p className="text-xl md:text-2xl font-black text-gray-900 leading-none truncate">
                      {ad.price} <span className="text-xs md:text-sm text-gray-400 font-bold">PLN</span>
                    </p>
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-green-500 group-hover:text-white transition-colors duration-300 hidden md:flex">
                      <span className="font-bold text-sm transform -rotate-45">➔</span>
                    </div>
                  </div>

                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Poprawka składni React (dangerouslySetInnerHTML) */}
      <style dangerouslySetInnerHTML={{ __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

    </main>
  );
}