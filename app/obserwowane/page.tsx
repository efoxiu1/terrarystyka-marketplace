'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

export default function Obserwowane() {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFavorites = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('favorites')
        .select(`
          id,
          listing_id,
          listings (
            id, title, price, image_url, status
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (data) {
        const validFavorites = data.filter((fav: any) => fav.listings !== null);
        setFavorites(validFavorites);
      }
      setLoading(false);
    };

    fetchFavorites();
  }, []);

  const removeFavorite = async (favoriteId: string) => {
    // Płynne zniknięcie dzięki filtracji stanu
    setFavorites(favorites.filter(fav => fav.id !== favoriteId));
    await supabase.from('favorites').delete().eq('id', favoriteId);
  };

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto p-6 mt-16 mb-32 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-black rounded-full animate-spin mb-4"></div>
        <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Synchronizacja schowka...</p>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto p-6 mt-12 mb-32 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* --- NAGŁÓWEK PREMIUM --- */}
      <div className="mb-12 border-b border-gray-100 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl md:text-6xl font-black text-gray-900 tracking-tight mb-2">
            Obserwowane
          </h1>
          <p className="text-lg text-gray-500 font-medium max-w-xl">
            Twoja osobista kolekcja wyselekcjonowanych ogłoszeń. Śledź ceny i nie przegap najlepszych okazji.
          </p>
        </div>
        <div className="bg-gray-50 px-6 py-3 rounded-2xl border border-gray-100 shadow-inner inline-flex items-center gap-3">
          <span className="text-2xl animate-pulse">❤️</span>
          <span className="font-black text-gray-900 text-xl">{favorites.length}</span>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Zapisanych</span>
        </div>
      </div>

      {/* --- STAN PUSTY (EMPTY STATE) --- */}
      {favorites.length === 0 ? (
        <div className="bg-gradient-to-b from-gray-50 to-white border-2 border-dashed border-gray-200 rounded-[3rem] p-16 md:p-24 text-center flex flex-col items-center justify-center">
          <div className="w-32 h-32 bg-white rounded-full shadow-xl flex items-center justify-center mb-8 relative">
            <span className="text-6xl absolute transform -rotate-12 transition hover:rotate-0 duration-300">🕵️</span>
            <div className="absolute -bottom-2 -right-2 bg-red-100 w-10 h-10 rounded-full flex items-center justify-center border-4 border-white">
              <span className="text-red-500 text-sm">❤️</span>
            </div>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">Twój schowek świeci pustkami</h2>
          <p className="text-gray-500 mb-10 text-lg max-w-md mx-auto">
            Przeglądaj giełdę, klikaj w serduszka przy ciekawych ofertach i stwórz swoją wymarzoną hodowlę.
          </p>
          <Link href="/" className="bg-black text-white px-10 py-5 rounded-2xl font-black text-lg hover:bg-gray-800 hover:-translate-y-1 transition-all duration-300 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]">
            Odkryj zwierzęta na Giełdzie
          </Link>
        </div>
      ) : (
        
        /* --- SIATKA OGŁOSZEŃ (GRID) --- */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {favorites.map((fav) => {
            const ad = fav.listings;
            const isInactive = ad.status !== 'active';

            return (
              <div 
                key={fav.id} 
                className={`group relative bg-white rounded-3xl overflow-hidden flex flex-col transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 border border-gray-100 ${isInactive ? 'opacity-60 grayscale hover:grayscale-0' : ''}`}
              >
                
                {/* 🛡️ Przycisk usuwania (Glassmorphism) */}
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    removeFavorite(fav.id);
                  }} 
                  className="absolute top-4 right-4 z-20 w-12 h-12 bg-white/70 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg hover:bg-red-50 text-red-500 hover:scale-110 transition-all duration-300 group/btn"
                  title="Usuń z obserwowanych"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 group-hover/btn:scale-90 transition-transform">
                    <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                  </svg>
                </button>

                <Link href={`/ogloszenie/${ad.id}`} className="flex flex-col h-full relative z-10">
                  
                  {/* Sekcja Zdjęcia */}
                  <div className="aspect-[4/3] bg-gray-50 relative overflow-hidden">
                    {ad.image_url ? (
                      <img 
                        src={ad.image_url} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" 
                        alt={ad.title} 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-6xl">🦎</div>
                    )}
                    
                    {/* Nakładka (Gradient) dla lepszej widoczności jeśli nałożysz tekst na dół zdjęcia */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                    {isInactive && (
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10">
                        <span className="bg-black text-white font-black uppercase tracking-widest px-6 py-3 rounded-xl text-xs transform -rotate-3 shadow-xl">
                          Niedostępne
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Sekcja Informacji (Karta) */}
                  <div className="p-6 flex-1 flex flex-col bg-white">
                    <h2 className="font-bold text-gray-900 text-lg leading-snug line-clamp-2 mb-3 group-hover:text-blue-600 transition-colors">
                      {ad.title}
                    </h2>
                    
                    <div className="mt-auto flex justify-between items-end pt-4 border-t border-gray-50">
                      <div>
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-0.5">Cena</p>
                        <span className="text-2xl font-black text-green-600">{ad.price} PLN</span>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors duration-300">
                        <span className="font-black transform -rotate-45">➔</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}